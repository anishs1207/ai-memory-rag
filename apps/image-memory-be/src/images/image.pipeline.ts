import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { VlmService } from './vlm.service';
import { PersonService } from './person.service';
import { ImageMemoryStore } from './image-memory.store';
import { ImageRecord, DetectedPerson } from './types/image-memory.types';
import * as path from 'path';
import * as process from 'process';

export interface PipelineResult {
  imageId: string;
  filename: string;
  scene: string;
  detectedPeopleCount: number;
  newPeopleCount: number;
  matchedPeopleCount: number;
  relationshipsExtracted: number;
  tags: string[];
  detectedPersonIds: string[];
}

/**
 * ImagePipeline orchestrates the full image ingestion flow:
 *
 *   [Upload] → [VLM Analysis] → [Person Resolution] → [Relationship Extraction] → [Store]
 *
 * Each stage is a discrete step, making it easy to swap out individual components.
 */
import { VectorService } from './vector.service';
import { EventService } from './event.service';
import { ImageProcessingService } from './image-processing.service';
import exifr from 'exifr';

@Injectable()
export class ImagePipeline {
  private readonly logger = new Logger(ImagePipeline.name);

  constructor(
    private readonly vlm: VlmService,
    private readonly personService: PersonService,
    private readonly store: ImageMemoryStore,
    private readonly vector: VectorService,
    private readonly eventService: EventService,
    private readonly imageProcessing: ImageProcessingService,
  ) {}

  async run(filePath: string, filename: string): Promise<PipelineResult> {
    const imageId = uuidv4();
    const timestamp = new Date().toISOString();

    this.logger.log(`[Pipeline] START  imageId=${imageId} file=${filename}`);

    // ── Stage 1: VLM Analysis ─────────────────────────────────────────────
    this.logger.log(`[Pipeline] Stage 1: VLM analysis`);
    const analysis = await this.vlm.analyseImage(filePath);
    this.logger.log(
      `[Pipeline] VLM detected ${analysis.detectedPeople.length} people, ` +
        `${analysis.relationships.length} raw relationships`,
    );

    // ── Stage 2: Person Resolution ────────────────────────────────────────
    this.logger.log(`[Pipeline] Stage 2: Person resolution`);
    const existingPeople = this.store.getPeopleStore();
    const beforeCount = Object.keys(existingPeople).length;

    const { updatedPeople, resolvedPersonIds } =
      await this.personService.resolvePeople(
        analysis.detectedPeople,
        existingPeople,
        imageId,
        timestamp,
      );

    const afterCount = Object.keys(updatedPeople).length;
    const newPeopleCount = afterCount - beforeCount;
    const matchedPeopleCount = analysis.detectedPeople.length - newPeopleCount;

    // Generate/Update embeddings and crops for people
    for (const [i, pId] of resolvedPersonIds.entries()) {
      const person = updatedPeople[pId];
      const detected = analysis.detectedPeople[i];

      // 1. Crop (Advanced Feature)
      if (detected.boundingBox && !person.profileImageUrl) {
        this.logger.log(`[Pipeline] Creating identity crop for person ${pId}`);
        const cropFile = await this.imageProcessing.cropPerson(
          filePath,
          pId,
          detected.boundingBox,
        );
        if (cropFile) {
          person.profileImageUrl = `/static/crops/${cropFile}`;

          // ── Stage 2.1: Targeted Refinement (The "Senior" Approach) ──
          // Perform a high-res analysis of the crop to get better re-id data
          const cropPath = path.join(process.cwd(), 'data', 'crops', cropFile);
          const refinedData: any = await this.vlm.analyseIdentityCrop(cropPath);

          if (refinedData.detailedEmbedText) {
            this.logger.log(
              `[Pipeline] Refined identity for ${pId}: ${refinedData.detailedEmbedText.slice(0, 50)}...`,
            );
            person.embedText = `${person.embedText}. Refined Details: ${refinedData.detailedEmbedText}`;
            person.canonicalDescriptors = Array.from(
              new Set([
                ...person.canonicalDescriptors,
                ...(refinedData.descriptors || []),
              ]),
            );
          }
        }
      }

      // 2. Embedding (Update if refined)
      this.logger.log(
        `[Pipeline] Updating consensus embedding for person ${pId}`,
      );
      person.embedding = await this.vector.generateEmbedding(person.embedText);
    }

    // ── Stage 2.5: Regenerate Biographies ───────────────────────────────
    this.logger.log(`[Pipeline] Stage 2.5: Regenerating biographies`);
    const allImagesForBio = this.store.getImagesStore();
    for (const pId of resolvedPersonIds) {
      const person = updatedPeople[pId];
      // Only regenerate if bios are enabled and we have at least 1 image
      person.biography = await this.personService.generateBiography(
        person,
        allImagesForBio,
      );
    }

    // Update person store
    this.store.setPeople(updatedPeople);

    // ── Stage 3: Relationship Extraction ──────────────────────────────────
    this.logger.log(`[Pipeline] Stage 3: Relationship extraction`);
    const existingRels = this.store.getAllRelationships();
    const updatedRels = this.personService.resolveRelationships(
      analysis.relationships as any,
      resolvedPersonIds,
      existingRels,
      timestamp,
    );
    this.store.setRelationships(updatedRels);
    const newRelsCount = updatedRels.length - existingRels.length;

    // ── Stage 4: Persist Image Record ─────────────────────────────────────
    this.logger.log(`[Pipeline] Stage 4: Persisting image record`);

    // Extract EXIF GPS data
    let gps: { lat: number; lng: number } | undefined = undefined;
    try {
      const exif = await exifr.gps(filePath);
      if (exif) {
        gps = { lat: exif.latitude, lng: exif.longitude };
        this.logger.log(`[Pipeline] Extracted GPS: ${gps.lat}, ${gps.lng}`);
      }
    } catch (e) {
      this.logger.warn(`[Pipeline] GPS extraction failed: ${e.message}`);
    }

    // Generate image embedding based on analysis (Google Photos style: context + people + atmosphere)
    const activePeopleStr = analysis.detectedPeople
      .map((p) => `${p.name || 'A person'} (${p.descriptors.join(', ')})`)
      .join('; ');

    const imageContentForEmbedding = `Scene: ${analysis.scene}. 
      Atmosphere: ${analysis.atmosphere}. 
      Description: ${analysis.rawDescription}. 
      People: ${activePeopleStr}. 
      Text found: ${analysis.ocrText || 'None'}. 
      Tags: ${analysis.tags.join(', ')}`;

    const imageEmbedding = await this.vector.generateEmbedding(
      imageContentForEmbedding,
    );

    const imageRecord: ImageRecord = {
      imageId,
      filename,
      storagePath: filePath,
      uploadedAt: timestamp,
      analysis: {
        ...analysis,
        detectedPeople: analysis.detectedPeople.map((p, i) => ({
          ...p,
          personId: resolvedPersonIds[i],
        })),
      },
      detectedPersonIds: resolvedPersonIds,
      embedding: imageEmbedding,
      caption: analysis.scene,
      dominantColor: analysis.dominantColor,
      gps,
    };
    this.store.setImage(imageRecord);

    // ── Stage 5: Re-cluster Events ─────────────────────────────────────────
    this.logger.log(`[Pipeline] Stage 5: Re-clustering events`);
    const allImages = this.store.getAllImages();
    const clusters = this.eventService.clusterEvents(allImages);
    this.store.setEvents(clusters);

    // predictive relationships
    const currentRels = this.store.getAllRelationships();
    const predictedRels = this.personService.predictRelationships(
      allImages,
      currentRels,
    );
    this.store.setRelationships(predictedRels);

    this.logger.log(
      `[Pipeline] DONE  imageId=${imageId} ` +
        `newPeople=${newPeopleCount} matchedPeople=${matchedPeopleCount} newRels=${newRelsCount}`,
    );

    return {
      imageId,
      filename,
      scene: analysis.scene,
      detectedPeopleCount: analysis.detectedPeople.length,
      newPeopleCount,
      matchedPeopleCount,
      relationshipsExtracted: newRelsCount,
      tags: analysis.tags,
      detectedPersonIds: resolvedPersonIds,
    };
  }
}
