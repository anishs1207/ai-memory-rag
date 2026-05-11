import { Injectable, Logger } from '@nestjs/common';
import { ImageMemoryStore } from './image-memory.store';
import { ImageRecord } from './types/image-memory.types';

export interface LocationPrediction {
  locationContext: string;
  confidence: number;
  reasoning: string;
  predictedTimeRange: string;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(private readonly store: ImageMemoryStore) {}

  /**
   * Predict likely future locations for the user or their friends.
   */
  async predictFutureLocations(): Promise<LocationPrediction[]> {
    const images = this.store
      .getAllImages()
      .filter((img) => img.gps && img.analysis.locationContext);

    if (images.length < 5) return [];

    // Analyze by Day of Week and Time of Day
    const patterns: Record<string, Record<string, number>> = {};

    images.forEach((img) => {
      const date = new Date(img.uploadedAt);
      const day = date.getDay(); // 0-6
      const hour = date.getHours(); // 0-23
      const timeSlot = this.getTimeSlot(hour);
      const loc = img.analysis.locationContext;

      const key = `${day}-${timeSlot}`;
      if (!patterns[key]) patterns[key] = {};
      patterns[key][loc] = (patterns[key][loc] || 0) + 1;
    });

    const predictions: LocationPrediction[] = [];
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const tomorrowDay = tomorrow.getDay();

    ['Morning', 'Afternoon', 'Evening', 'Night'].forEach((slot) => {
      const key = `${tomorrowDay}-${slot}`;
      const dayPatterns = patterns[key];

      if (dayPatterns) {
        const sorted = Object.entries(dayPatterns).sort((a, b) => b[1] - a[1]);
        const [bestLoc, count] = sorted[0];
        const total = Object.values(dayPatterns).reduce((a, b) => a + b, 0);

        if (count / total > 0.5) {
          predictions.push({
            locationContext: bestLoc,
            confidence: count / total,
            reasoning: `Based on ${count} images from your history on similar days and times.`,
            predictedTimeRange: `Tomorrow ${slot}`,
          });
        }
      }
    });

    return predictions;
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  }
}
