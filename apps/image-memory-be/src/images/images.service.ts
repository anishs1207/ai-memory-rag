import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ImageMemoryStore } from './image-memory.store';
import { ImagePipeline } from './image.pipeline';
import { VlmService } from './vlm.service';
import {
  ImageRecord,
  PersonRecord,
  Relationship,
} from './types/image-memory.types';
import * as fs from 'fs';
import * as path from 'path';

import { VectorService } from './vector.service';
import { ImageProcessingService } from './image-processing.service';
import { JournalService } from './journal.service';
import { PredictionService } from './prediction.service';
import { HighlightService, Highlight } from './highlight.service';
import { ChatMessage } from './dto/chat-memory.dto';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly store: ImageMemoryStore,
    private readonly pipeline: ImagePipeline,
    private readonly vlm: VlmService,
    private readonly vector: VectorService,
    private readonly imageProcessing: ImageProcessingService,
    private readonly journalService: JournalService,
    private readonly predictionService: PredictionService,
    private readonly highlightService: HighlightService,
    @InjectQueue('image-processing') private readonly imageQueue: Queue,
  ) {}

  /**
   * Process a newly uploaded image through the full pipeline.
   * Now uses a background queue for resilience and bulk support.
   */
  async ingestImage(file: Express.Multer.File) {
    try {
      await this.imageQueue.add(
        'analyze',
        {
          filePath: file.path,
          filename: file.originalname,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      return {
        message: 'Image queued for processing',
        filename: file.originalname,
        status: 'queued',
      };
    } catch (err) {
      this.logger.error(
        'Redis connection failed, processing image synchronously as fallback',
        err,
      );
      // Fallback: process immediately if queue is dead
      this.pipeline.run(file.path, file.originalname);
      return {
        message:
          'Processing image synchronously (Background queue unavailable)',
        filename: file.originalname,
        status: 'processing',
      };
    }
  }

  // ─── Image endpoints ────────────────────────────────────────────────────

  getAllImages(): ImageRecord[] {
    return this.store.getAllImages();
  }

  getImage(imageId: string): ImageRecord {
    const img = this.store.getImage(imageId);
    if (!img) throw new NotFoundException(`Image ${imageId} not found`);
    return img;
  }

  getImageFile(imageId: string): { path: string; filename: string } {
    const img = this.store.getImage(imageId);
    if (!img) throw new NotFoundException(`Image ${imageId} not found`);

    let filePath = img.storagePath;
    // Fallback: if absolute path doesn't exist, try relative to current directory
    if (!fs.existsSync(filePath)) {
      filePath = path.join(
        process.cwd(),
        'data',
        'uploads',
        path.basename(img.storagePath),
      );
    }

    if (!fs.existsSync(filePath))
      throw new NotFoundException(`Image file not found on disk`);

    return { path: filePath, filename: img.filename };
  }

  // ─── People endpoints ───────────────────────────────────────────────────

  getAllPeople(): PersonRecord[] {
    return this.store.getAllPeople();
  }

  getPerson(personId: string): PersonRecord & { images: ImageRecord[] } {
    const person = this.store.getPerson(personId);
    if (!person) throw new NotFoundException(`Person ${personId} not found`);
    const images = person.imageIds
      .map((id) => this.store.getImage(id))
      .filter(Boolean);
    return { ...person, images };
  }

  updatePersonName(personId: string, name: string): PersonRecord {
    const people = this.store.getPeopleStore();
    const person = people[personId];
    if (!person) throw new NotFoundException(`Person ${personId} not found`);

    person.name = name;
    this.store.setPeople(people);
    return person;
  }

  // ─── Relationship endpoints ─────────────────────────────────────────────

  getAllRelationships(): Relationship[] {
    return this.store.getAllRelationships();
  }

  getRelationshipsForPerson(personId: string): Relationship[] {
    this.getPerson(personId); // validate existence
    return this.store.getRelationshipsForPerson(personId);
  }

  // ─── Event endpoints ────────────────────────────────────────────────────

  getAllEvents() {
    return this.store.getAllEvents();
  }

  getMoodHistory(personId: string) {
    const person = this.store.getPerson(personId);
    if (!person) throw new NotFoundException(`Person ${personId} not found`);
    return person.moodHistory || [];
  }

  // ─── Memory query endpoint ──────────────────────────────────────────────

  async queryMemory(
    query: string,
  ): Promise<{ answer: string; context: string }> {
    const context = this.store.buildMemoryContext();
    const answer = await this.vlm.queryContext(context, query);
    return { answer, context };
  }

  /**
   * Interactive Memory Assistant with full chat history awareness.
   */
  async chatWithMemory(dto: {
    query: string;
    history?: ChatMessage[];
  }): Promise<{ answer: string }> {
    const context = this.store.buildMemoryContext();
    const historyText = (dto.history || [])
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `You are an expert personal memory assistant. 
    Using the MEMORY CONTEXT below, answer the user's current question.
    
    RELEVANT MEMORY DATA:
    ${context}
    
    PREVIOUS MESSAGES:
    ${historyText}
    
    USER'S NEW QUESTION: ${dto.query}
    
    Guidelines:
    - If talking about a person, use their name if available.
    - Reference specific dates/scenes if possible.
    - Be conversational and soulful.
    - If you Don't know, state it clearly based on available context.`;

    const answer = await this.vlm.queryContext('Assistant Mode', prompt);
    return { answer };
  }

  async getPersonHighlight(personId: string): Promise<Highlight> {
    return this.highlightService.generatePersonHighlight(personId);
  }

  async getLocationHighlight(location: string): Promise<Highlight> {
    return this.highlightService.generateLocationHighlight(location);
  }

  getStats() {
    const images = this.store.getAllImages();
    const people = this.store.getAllPeople();
    const relationships = this.store.getAllRelationships();
    return {
      totalImages: images.length,
      totalPeople: people.length,
      totalRelationships: relationships.length,
      relationshipBreakdown: this.groupBy(relationships, 'relation'),
    };
  }

  async searchImages(query: string) {
    const queryEmbed = await this.vector.generateEmbedding(query);
    const allImages = this.store.getAllImages();

    const results = allImages
      .filter((img) => img.embedding)
      .map((img) => ({
        ...img,
        score: this.vector.cosineSimilarity(queryEmbed, img.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return results;
  }

  searchByText(text: string) {
    const allImages = this.store.getAllImages();
    const query = text.toLowerCase();

    return allImages.filter(
      (img) =>
        img.analysis.ocrText?.toLowerCase().includes(query) ||
        img.analysis.rawDescription.toLowerCase().includes(query) ||
        img.analysis.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  // ─── Enhanced Features ──────────────────────────────────────────────────

  /**
   * Find images visually similar to a specific image.
   */
  findSimilarImages(imageId: string, limit = 5) {
    const target = this.getImage(imageId);
    if (!target.embedding) {
      return [];
    }

    const allImages = this.store.getAllImages();
    return allImages
      .filter((img) => img.embedding && img.imageId !== imageId)
      .map((img) => ({
        ...img,
        similarity: this.vector.cosineSimilarity(
          target.embedding,
          img.embedding,
        ),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get filtered images based on various criteria.
   */
  /**
   * Get filtered images based on various criteria.
   */
  getFilteredImages(filters: {
    personId?: string;
    tag?: string;
    atmosphere?: string;
  }) {
    let images = this.store.getAllImages();

    if (filters.personId) {
      images = images.filter((img) =>
        img.detectedPersonIds.includes(filters.personId),
      );
    }

    if (filters.tag) {
      const tagLower = filters.tag.toLowerCase();
      images = images.filter((img) =>
        img.analysis.tags.some((t) => t.toLowerCase() === tagLower),
      );
    }

    if (filters.atmosphere) {
      const atmLower = filters.atmosphere.toLowerCase();
      images = images.filter((img) =>
        img.analysis.atmosphere?.toLowerCase().includes(atmLower),
      );
    }

    return images;
  }

  /**
   * Returns images grouped by event, serving as a chronological overview.
   */
  getTimeline() {
    const events = this.store.getAllEvents();
    // Enrich events with their actual image objects
    return events
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      )
      .map((ev) => ({
        ...ev,
        images: ev.imageIds
          .map((id) => this.store.getImage(id))
          .filter(Boolean),
      }));
  }

  /**
   * Today in History: Find memories from this day in previous years.
   */
  getFlashbacks() {
    const allImages = this.store.getAllImages();
    const today = new Date();
    const mm = today.getMonth();
    const dd = today.getDate();

    return allImages.filter((img) => {
      const d = new Date(img.uploadedAt);
      return (
        d.getMonth() === mm &&
        d.getDate() === dd &&
        d.getFullYear() < today.getFullYear()
      );
    });
  }

  async clearData() {
    this.store.clear();

    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    const cropsDir = path.join(process.cwd(), 'data', 'crops');

    // Helper to delete files in a directory
    const cleanDir = (dirPath: string) => {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const fullPath = path.join(dirPath, file);
          if (fs.statSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
          }
        }
      }
    };

    cleanDir(uploadsDir);
    cleanDir(cropsDir);

    return { message: 'All memory data and files have been cleared.' };
  }

  async blurStrangers(
    imageId: string,
    regions: [number, number, number, number][],
  ): Promise<Buffer> {
    const { path: filePath } = this.getImageFile(imageId);
    return this.imageProcessing.blurRegions(filePath, regions);
  }

  getGeographicImages() {
    return this.store.getAllImages().filter((img) => img.gps);
  }

  getJournals() {
    return this.store.getAllJournals();
  }

  async searchByImage(file: Express.Multer.File) {
    this.logger.log(
      `[Search] Visual search started for file: ${file.originalname}`,
    );
    const analysis = await this.vlm.analyseImage(file.path);

    if (analysis.detectedPeople.length === 0) {
      return {
        message: 'No people detected in this image to search for.',
        matches: [],
      };
    }

    const peopleStore = this.store.getPeopleStore();
    const results = [];

    for (const detected of analysis.detectedPeople) {
      const embedding = await this.vector.generateEmbedding(detected.embedText);

      let bestMatch = null;
      let highestScore = 0;

      for (const [pId, record] of Object.entries(peopleStore)) {
        if (!record.embedding) continue;
        const score = this.vector.cosineSimilarity(embedding, record.embedding);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = { person: record, score };
        }
      }

      if (bestMatch && highestScore > 0.7) {
        // Confidence threshold
        results.push({
          queryPerson: detected.name || 'Unknown',
          match: bestMatch.person,
          confidence: highestScore,
          images: this.store
            .getAllImages()
            .filter((img) =>
              img.detectedPersonIds?.includes(bestMatch.person.personId),
            ),
        });
      }
    }

    return results;
  }

  async generateJournalForDate(date: string) {
    return this.journalService.generateDailyJournal(date);
  }

  getPredictions() {
    return this.predictionService.predictFutureLocations();
  }

  async mergePeople(targetId: string, sourceId: string) {
    const people = this.store.getPeopleStore();
    const images = this.store.getImagesStore();
    const relationships = this.store.getAllRelationships();

    if (!people[targetId] || !people[sourceId]) {
      throw new NotFoundException('One or both people not found');
    }

    const target = people[targetId];
    const source = people[sourceId];

    // 1. Migrate Images
    source.imageIds.forEach((imgId) => {
      const img = images[imgId];
      if (img) {
        // Replace sourceId with targetId in detectedPersonIds
        img.detectedPersonIds = Array.from(
          new Set(
            img.detectedPersonIds.map((id) =>
              id === sourceId ? targetId : id,
            ),
          ),
        );
        // Update the analysis structure as well
        img.analysis.detectedPeople.forEach((dp) => {
          if (dp.personId === sourceId) dp.personId = targetId;
        });
      }
      if (!target.imageIds.includes(imgId)) {
        target.imageIds.push(imgId);
      }
    });

    // 2. Combine Descriptors
    target.canonicalDescriptors = Array.from(
      new Set([...target.canonicalDescriptors, ...source.canonicalDescriptors]),
    );

    // 3. Migrate Relationships
    const updatedRels = relationships.map((rel) => {
      if (rel.person1Id === sourceId) rel.person1Id = targetId;
      if (rel.person2Id === sourceId) rel.person2Id = targetId;
      return rel;
    });

    // Deduplicate relationships (same people, same relation)
    const uniqueRels = updatedRels.filter(
      (v, i, a) =>
        a.findIndex(
          (t) =>
            ((t.person1Id === v.person1Id && t.person2Id === v.person2Id) ||
              (t.person1Id === v.person2Id && t.person2Id === v.person1Id)) &&
            t.relation === v.relation,
        ) === i,
    );

    // 4. Update Store
    delete people[sourceId];
    this.store.setPeople(people);
    this.store.setRelationships(uniqueRels);

    // Stage 5: Regenerate Biography for target
    target.biography = await this.pipeline['personService'].generateBiography(
      target,
      images,
    );
    this.store.setPeople(people);

    return {
      message: `Successfully merged ${sourceId} into ${targetId}`,
      target,
    };
  }

  private groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
    return arr.reduce(
      (acc, item) => {
        const k = String(item[key]);
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}
