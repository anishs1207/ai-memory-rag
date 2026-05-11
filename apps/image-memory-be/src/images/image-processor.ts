import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImagePipeline } from './image.pipeline';

@Processor('image-processing')
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(private readonly pipeline: ImagePipeline) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { filePath, filename } = job.data;
    this.logger.log(`Processing job ${job.id} for file: ${filename}`);

    try {
      const result = await this.pipeline.run(filePath, filename);
      this.logger.log(`Job ${job.id} completed successfully`);
      return result;
    } catch (err) {
      this.logger.error(`Job ${job.id} failed: ${err.message}`, err.stack);
      throw err;
    }
  }
}
