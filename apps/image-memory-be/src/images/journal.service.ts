import { Injectable, Logger } from '@nestjs/common';
import { VlmService } from './vlm.service';
import { ImageMemoryStore } from './image-memory.store';
import { ImageRecord, JournalEntry } from './types/image-memory.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(
    private readonly vlm: VlmService,
    private readonly store: ImageMemoryStore,
  ) {}

  /**
   * Generate a summary for a specific day.
   */
  async generateDailyJournal(date: string): Promise<JournalEntry | null> {
    const allImages = this.store.getAllImages();
    const targetDate = new Date(date).toDateString();

    const dayImages = allImages.filter(
      (img) => new Date(img.uploadedAt).toDateString() === targetDate,
    );

    if (dayImages.length === 0) return null;

    this.logger.log(
      `Generating daily journal for ${targetDate} (${dayImages.length} images)`,
    );

    const imageSummaries = dayImages
      .map(
        (img) =>
          `- [${new Date(img.uploadedAt).toLocaleTimeString()}] ${img.analysis.scene}. Context: ${img.analysis.locationContext}. Atmospheric Vibe: ${img.analysis.atmosphere}.`,
      )
      .join('\n');

    const systemContext = `You are a warm, reflective personal biographer. Write a "Daily Journal" entry for the user based on their visual memories of the day.
    The tone should be empathetic and observational.
    
    METADATA:
    Date: ${targetDate}
    Total Memories: ${dayImages.length}
    
    MEMORIES LIST:
    ${imageSummaries}`;

    try {
      const summary = await this.vlm.queryContext(
        'Journal Mode',
        `Write a title (max 5 words) and a soulful summary (3-4 sentences) for this day. 
      Format: 
      Title: [Your Title]
      Summary: [Your Summary]`,
      );

      const titleMatch = summary.match(/Title:\s*(.*)/);
      const summaryMatch = summary.match(/Summary:\s*(.*)/s);

      const entry: JournalEntry = {
        entryId: uuidv4(),
        date: targetDate,
        title: titleMatch ? titleMatch[1].trim() : 'A Day of Memories',
        summary: summaryMatch ? summaryMatch[1].trim() : summary,
        imageIds: dayImages.map((img) => img.imageId),
        mood: this.inferDayMood(dayImages),
      };

      const existing = this.store.getAllJournals();
      // Update if same date exists
      const filtered = existing.filter((j) => j.date !== targetDate);
      this.store.setJournals([...filtered, entry]);

      return entry;
    } catch (err) {
      this.logger.error(`Failed to generate journal for ${targetDate}`, err);
      return null;
    }
  }

  private inferDayMood(images: ImageRecord[]): string {
    const moods = images.map((img) => img.analysis.atmosphere).filter(Boolean);
    if (moods.length === 0) return 'neutral';
    // Simple heuristic: pick the most frequent mood
    const counts = moods.reduce(
      (acc, mood) => {
        acc[mood] = (acc[mood] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
}
