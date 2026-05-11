import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly cropsDir = path.join(process.cwd(), 'data', 'crops');

  constructor() {
    if (!fs.existsSync(this.cropsDir)) {
      fs.mkdirSync(this.cropsDir, { recursive: true });
    }
  }

  /**
   * Crop an image based on normalized bounding box [ymin, xmin, ymax, xmax] (0-1000)
   * Returns the filename of the saved crop.
   */
  async cropPerson(
    sourcePath: string,
    personId: string,
    box: [number, number, number, number],
  ): Promise<string | null> {
    try {
      const metadata = await sharp(sourcePath).metadata();
      if (!metadata.width || !metadata.height) return null;

      let [ymin, xmin, ymax, xmax] = box;

      // Calculate padding (25% of width/height for better context)
      const padW = (xmax - xmin) * 0.25;
      const padH = (ymax - ymin) * 0.25;

      // Apply padding
      ymin = Math.max(0, ymin - padH);
      xmin = Math.max(0, xmin - padW);
      ymax = Math.min(1000, ymax + padH);
      xmax = Math.min(1000, xmax + padW);

      let left = Math.round((xmin / 1000) * metadata.width);
      let top = Math.round((ymin / 1000) * metadata.height);
      let width = Math.round(((xmax - xmin) / 1000) * metadata.width);
      let height = Math.round(((ymax - ymin) / 1000) * metadata.height);

      // Final clamping and safety
      left = Math.max(0, Math.min(left, metadata.width - 2));
      top = Math.max(0, Math.min(top, metadata.height - 2));
      width = Math.max(1, Math.min(width, metadata.width - left));
      height = Math.max(1, Math.min(height, metadata.height - top));

      // Ensure dimensions are positive
      if (width <= 0 || height <= 0) {
        this.logger.warn(
          `Invalid crop for person ${personId}: ${width}x${height}`,
        );
        return null;
      }

      const cropFilename = `${personId}.jpg`;
      const outputPath = path.join(this.cropsDir, cropFilename);

      await sharp(sourcePath)
        .extract({ left, top, width, height })
        .resize(300, 300, { fit: 'cover' }) // Standardized size for profile pics
        .toFile(outputPath);

      return cropFilename;
    } catch (err) {
      this.logger.error(
        `Failed to crop image for person ${personId}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Blur specific regions of an image. Useful for Privacy Mode.
   */
  async blurRegions(
    sourcePath: string,
    regions: [number, number, number, number][],
  ): Promise<Buffer> {
    try {
      const metadata = await sharp(sourcePath).metadata();
      if (!metadata.width || !metadata.height)
        throw new Error('Invalid metadata');

      const composites = await Promise.all(
        regions.map(async (box) => {
          const [ymin, xmin, ymax, xmax] = box;
          const left = Math.round((xmin / 1000) * metadata.width);
          const top = Math.round((ymin / 1000) * metadata.height);
          const width = Math.round(((xmax - xmin) / 1000) * metadata.width);
          const height = Math.round(((ymax - ymin) / 1000) * metadata.height);

          // Safety clamping
          const safeLeft = Math.max(0, Math.min(left, metadata.width - 1));
          const safeTop = Math.max(0, Math.min(top, metadata.height - 1));
          const safeWidth = Math.max(
            1,
            Math.min(width, metadata.width - safeLeft),
          );
          const safeHeight = Math.max(
            1,
            Math.min(height, metadata.height - safeTop),
          );

          const blurredPart = await sharp(sourcePath)
            .extract({
              left: safeLeft,
              top: safeTop,
              width: safeWidth,
              height: safeHeight,
            })
            .blur(30)
            .toBuffer();

          return { input: blurredPart, left: safeLeft, top: safeTop };
        }),
      );

      return await sharp(sourcePath).composite(composites).toBuffer();
    } catch (err) {
      this.logger.error(`Failed to blur image: ${err.message}`);
      throw err;
    }
  }
}
