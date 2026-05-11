import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  MemoryStore,
  ImageRecord,
  PersonRecord,
  Relationship,
  TimelineEvent,
  JournalEntry,
} from './types/image-memory.types';

const STORE_PATH = path.join(process.cwd(), 'data', 'image-memory.json');

/**
 * ImageMemoryStore is the in-process, file-backed memory store.
 * All state is kept in-memory for fast access and periodically
 * flushed to disk so it survives restarts.
 *
 * In a production system you would replace this with a proper DB
 * (e.g. PostgreSQL + pgvector, or Pinecone).
 */
@Injectable()
export class ImageMemoryStore {
  private readonly logger = new Logger(ImageMemoryStore.name);
  private store: MemoryStore;

  constructor() {
    this.store = this.load();
  }

  // ─── Image records ─────────────────────────────────────────────────────────

  setImage(record: ImageRecord): void {
    this.store.images[record.imageId] = record;
    this.flush();
  }

  getImage(imageId: string): ImageRecord | undefined {
    return this.store.images[imageId];
  }

  getAllImages(): ImageRecord[] {
    return Object.values(this.store.images);
  }

  getImagesStore(): Record<string, ImageRecord> {
    return this.store.images;
  }

  // ─── People records ────────────────────────────────────────────────────────

  setPeople(people: Record<string, PersonRecord>): void {
    this.store.people = people;
    this.flush();
  }

  getPerson(personId: string): PersonRecord | undefined {
    return this.store.people[personId];
  }

  getAllPeople(): PersonRecord[] {
    return Object.values(this.store.people);
  }

  getPeopleStore(): Record<string, PersonRecord> {
    return this.store.people;
  }

  // ─── Relationships ─────────────────────────────────────────────────────────

  setRelationships(rels: Relationship[]): void {
    this.store.relationships = rels;
    this.flush();
  }

  getAllRelationships(): Relationship[] {
    return this.store.relationships;
  }

  getRelationshipsForPerson(personId: string): Relationship[] {
    return this.store.relationships.filter(
      (r) => r.person1Id === personId || r.person2Id === personId,
    );
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  setEvents(events: TimelineEvent[]): void {
    this.store.events = events;
    this.flush();
  }

  getAllEvents(): TimelineEvent[] {
    return this.store.events || [];
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private load(): MemoryStore {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      this.logger.warn(`Could not load store from disk: ${err}`);
    }
    return {
      images: {},
      people: {},
      relationships: [],
      events: [],
      journals: [],
    };
  }

  // ─── Journals ──────────────────────────────────────────────────────────────

  setJournals(journals: JournalEntry[]): void {
    this.store.journals = journals;
    this.flush();
  }

  getAllJournals(): JournalEntry[] {
    return this.store.journals || [];
  }

  private flush(): void {
    const TEMP_PATH = `${STORE_PATH}.tmp`;
    try {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });

      // Atomic snapshot: write to tmp then rename
      const data = JSON.stringify(this.store, null, 2);
      fs.writeFileSync(TEMP_PATH, data, 'utf8');
      fs.renameSync(TEMP_PATH, STORE_PATH);

      this.logger.debug(
        `[Store] Atomic snapshot successful. Size: ${(data.length / 1024).toFixed(2)} KB`,
      );
    } catch (err) {
      if (fs.existsSync(TEMP_PATH)) {
        try {
          fs.unlinkSync(TEMP_PATH);
        } catch (e) {}
      }
      this.logger.error(
        `[Store] CRITICAL: Failed to flush store to disk: ${err}`,
      );
    }
  }

  /**
   * Build a rich text context string used for LLM querying.
   */
  buildMemoryContext(): string {
    const people = this.getAllPeople();
    const images = this.getAllImages();
    const relationships = this.getAllRelationships();

    const lines: string[] = [];

    lines.push(`=== IMAGE MEMORY SYSTEM ===`);
    lines.push(`Total images: ${images.length}`);
    lines.push(`Total unique people identified: ${people.length}`);
    lines.push(`Total relationships extracted: ${relationships.length}`);
    lines.push('');

    for (const person of people) {
      lines.push(`--- Person: ${person.personId.slice(0, 8)} ---`);
      if (person.name) lines.push(`  Name: ${person.name}`);
      if (person.age) lines.push(`  Age range: ${person.age}`);
      if (person.gender) lines.push(`  Gender: ${person.gender}`);
      lines.push(
        `  Visual descriptors: ${person.canonicalDescriptors.join(', ')}`,
      );
      lines.push(`  Appears in ${person.imageIds.length} image(s)`);
      lines.push(`  Summary: ${person.embedText}`);

      const rels = this.getRelationshipsForPerson(person.personId);
      if (rels.length > 0) {
        for (const rel of rels) {
          const otherId =
            rel.person1Id === person.personId ? rel.person2Id : rel.person1Id;
          const other = this.getPerson(otherId);
          const otherDesc = other?.name || otherId.slice(0, 8);
          lines.push(
            `  Relationship: ${rel.relation} of ${otherDesc} (confidence: ${rel.confidence})`,
          );
        }
      }
      lines.push('');
    }

    for (const img of images) {
      lines.push(`--- Image: ${img.imageId.slice(0, 8)} (${img.filename}) ---`);
      lines.push(`  Scene: ${img.analysis.scene}`);
      lines.push(`  Description: ${img.analysis.rawDescription}`);
      lines.push(`  Tags: ${img.analysis.tags.join(', ')}`);
      if (img.analysis.ocrText)
        lines.push(`  Visible Text: ${img.analysis.ocrText}`);
      lines.push(`  People detected: ${img.detectedPersonIds.length}`);
      lines.push('');
    }

    return lines.join('\n');
  }
  /**
   * Clear all data from the store and disk.
   */
  clear(): void {
    this.store = {
      images: {},
      people: {},
      relationships: [],
      events: [],
      journals: [],
    };
    this.flush();
    this.logger.log('Memory store cleared.');
  }
}
