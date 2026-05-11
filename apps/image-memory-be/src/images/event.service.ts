import { Injectable, Logger } from '@nestjs/common';
import {
  ImageRecord,
  TimelineEvent,
  MemoryStore,
} from './types/image-memory.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly MAX_GAP_MS = 2 * 60 * 60 * 1000; // 2 hour gap defines a new event

  /**
   * Re-cluster all images into temporal events.
   */
  clusterEvents(images: ImageRecord[]): TimelineEvent[] {
    if (images.length === 0) return [];

    // Sort images by timestamp
    const sorted = [...images].sort(
      (a, b) =>
        new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
    );

    const events: TimelineEvent[] = [];
    let currentEvent: TimelineEvent | null = null;

    for (const img of sorted) {
      const imgTime = new Date(img.uploadedAt).getTime();

      if (
        !currentEvent ||
        imgTime - new Date(currentEvent.endTime).getTime() > this.MAX_GAP_MS
      ) {
        // Start a new event
        currentEvent = {
          eventId: uuidv4(),
          name: `Event ${new Date(img.uploadedAt).toLocaleDateString()}`,
          description: img.analysis.scene,
          startTime: img.uploadedAt,
          endTime: img.uploadedAt,
          imageIds: [img.imageId],
          personIds: [...img.detectedPersonIds],
        };
        events.push(currentEvent);
      } else {
        // Append to current event
        currentEvent.endTime = img.uploadedAt;
        currentEvent.imageIds.push(img.imageId);
        currentEvent.personIds = Array.from(
          new Set([...currentEvent.personIds, ...img.detectedPersonIds]),
        );
        // Optionally update description if the first image was simple
        if (currentEvent.imageIds.length === 3) {
          currentEvent.name = `Activity around ${new Date(img.uploadedAt).toLocaleTimeString()}`;
        }
      }
    }

    return events;
  }
}
