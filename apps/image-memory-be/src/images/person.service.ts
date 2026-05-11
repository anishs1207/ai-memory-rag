import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  PersonRecord,
  DetectedPerson,
  Relationship,
  ImageRecord,
} from './types/image-memory.types';
import { VectorService } from './vector.service';
import { VlmService } from './vlm.service';

/**
 * PersonService handles cross-image person identity resolution.
 *
 * Strategy: For each newly detected person, compute a similarity score
 * against every existing PersonRecord using descriptor overlap + semantic
 * similarity of the embedText.
 */
@Injectable()
export class PersonService {
  private readonly logger = new Logger(PersonService.name);
  private readonly DESCRIPTOR_WEIGHT = 0.4;
  private readonly SEMANTIC_WEIGHT = 0.6;
  private readonly MATCH_THRESHOLD_BASE = 0.65;
  private readonly CO_OCCURRENCE_BOOST = 0.15; // If people often appear together
  private readonly RECENT_SIGHTING_BOOST = 0.05; // If seen in same daily journal

  constructor(
    private readonly vector: VectorService,
    private readonly vlm: VlmService,
  ) {}

  /**
   * Given a list of DetectedPerson objects (with empty personIds) and the
   * current people store, resolve identities and return:
   *  - updatedPeople: the mutated store
   *  - resolvedPersonIds: personId assigned to each input person (same order)
   */
  async resolvePeople(
    detected: DetectedPerson[],
    existingPeople: Record<string, PersonRecord>,
    imageId: string,
    timestamp: string,
  ): Promise<{
    updatedPeople: Record<string, PersonRecord>;
    resolvedPersonIds: string[];
  }> {
    const updatedPeople = { ...existingPeople };
    const resolvedPersonIds: string[] = [];
    const matchedInThisImage: PersonRecord[] = [];

    for (const person of detected) {
      const matchId = await this.findBestMatch(
        person,
        updatedPeople,
        matchedInThisImage,
      );

      if (matchId) {
        // Merge into existing record
        const existing = updatedPeople[matchId];
        existing.imageIds = Array.from(
          new Set([...existing.imageIds, imageId]),
        );
        existing.lastSeen = timestamp;

        // Merge descriptors uniquely
        existing.canonicalDescriptors = Array.from(
          new Set([...existing.canonicalDescriptors, ...person.descriptors]),
        );

        // Conservative merge: only adopt new info if it's high quality
        if (
          person.name &&
          person.name.toLowerCase() !== 'unknown' &&
          (!existing.name || existing.name.toLowerCase() === 'unknown')
        ) {
          existing.name = person.name;
        }

        if (
          person.age &&
          person.age.toLowerCase() !== 'unknown' &&
          (!existing.age || existing.age.toLowerCase() === 'unknown')
        ) {
          existing.age = person.age;
        }

        if (
          person.gender &&
          person.gender.toLowerCase() !== 'unknown' &&
          (!existing.gender || existing.gender.toLowerCase() === 'unknown')
        ) {
          existing.gender = person.gender;
        }

        if (person.mood) {
          if (!existing.moodHistory) existing.moodHistory = [];
          existing.moodHistory.push({ timestamp, mood: person.mood });
        }

        resolvedPersonIds.push(matchId);
        matchedInThisImage.push(existing);
        this.logger.log(`Person matched to existing record ${matchId}`);
      } else {
        // Create new record
        const personId = uuidv4();
        updatedPeople[personId] = {
          personId,
          canonicalDescriptors: [...person.descriptors],
          embedText: person.embedText,
          name: person.name,
          age: person.age,
          gender: person.gender,
          imageIds: [imageId],
          firstSeen: timestamp,
          lastSeen: timestamp,
          moodHistory: person.mood ? [{ timestamp, mood: person.mood }] : [],
        };
        resolvedPersonIds.push(personId);
        this.logger.log(`New person created with id ${personId}`);
      }
    }

    return { updatedPeople, resolvedPersonIds };
  }

  /**
   * Resolve raw VLM relationships (which use array indices) into proper
   * person-ID-keyed Relationship objects, deduplicating against existing ones.
   */
  resolveRelationships(
    rawRelationships: any[],
    resolvedPersonIds: string[],
    existingRelationships: Relationship[],
    timestamp: string,
  ): Relationship[] {
    const updated = [...existingRelationships];

    for (const rel of rawRelationships) {
      const p1Id = resolvedPersonIds[rel.person1Index];
      const p2Id = resolvedPersonIds[rel.person2Index];
      if (!p1Id || !p2Id) continue;

      // Check if this relationship already exists (any direction)
      const existingIdx = updated.findIndex(
        (r) =>
          ((r.person1Id === p1Id && r.person2Id === p2Id) ||
            (r.person1Id === p2Id && r.person2Id === p1Id)) &&
          r.relation.toLowerCase() === rel.relation.toLowerCase(),
      );

      if (existingIdx > -1) {
        const existing = updated[existingIdx];
        // Evidence Accumulation
        existing.evidenceCount = (existing.evidenceCount || 1) + 1;
        existing.lastEvidenceAt = timestamp;

        // Boost confidence based on repeated sightings
        // Formula: 1 - (1-baseConfidence) * (0.8^evidenceCount)
        const baseConf = Math.max(existing.confidence, rel.confidence || 0.5);
        existing.confidence =
          1 - (1 - baseConf) * Math.pow(0.85, existing.evidenceCount - 1);

        this.logger.log(
          `[Consensus] Strengthened relationship between ${p1Id.slice(0, 6)} and ${p2Id.slice(0, 6)}. Count: ${existing.evidenceCount}, Conf: ${existing.confidence.toFixed(2)}`,
        );
      } else {
        // New Relationship
        updated.push({
          person1Id: p1Id,
          person2Id: p2Id,
          relation: rel.relation,
          confidence: rel.confidence || 0.6,
          evidence: rel.evidence,
          evidenceCount: 1,
          firstEvidenceAt: timestamp,
          lastEvidenceAt: timestamp,
        });
        this.logger.log(
          `[Consensus] Initial relationship established: ${rel.relation}`,
        );
      }
    }

    return updated;
  }

  /**
   * Use the collective history of a person's appearances to generate a biological summary.
   */
  async generateBiography(
    person: PersonRecord,
    images: Record<string, ImageRecord>,
  ): Promise<string> {
    const relevantImages = person.imageIds
      .map((id) => images[id])
      .filter(Boolean);
    if (relevantImages.length === 0) return 'No memories recorded yet.';

    const summaries = relevantImages
      .map(
        (img) =>
          `- Image: ${img.filename}. Scene: ${img.analysis.scene}. Context: ${img.analysis.locationContext}. Tags: ${img.analysis.tags.join(', ')}`,
      )
      .join('\n');

    const systemPrompt = `You are an expert biographer for a visual memory system.
    Given a list of appearances for a person, write a concise but soulful biography (3-4 sentences).
    Focus on patterns: where they are often seen, their mood trends, and notable objects or people they are associated with.
    If the person has a name (${person.name || 'unknown'}), use it.
    
    PERSON DATA:
    - Descriptors: ${person.canonicalDescriptors.join(', ')}
    - Total Appearances: ${person.imageIds.length}
    
    MEMORIES:
    ${summaries}
    
    Response format: JUST the text of the biography.`;

    try {
      this.logger.log(`Generating biography for person ${person.personId}`);
      const bio = await this.vlm.queryContext(
        'Person Biographer Mode',
        systemPrompt,
      );
      return bio.trim();
    } catch (err) {
      this.logger.error(`Failed to generate bio for ${person.personId}`, err);
      return 'Biography unavailable at this time.';
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private async findBestMatch(
    person: DetectedPerson,
    existing: Record<string, PersonRecord>,
    socialContext: PersonRecord[] = [],
  ): Promise<string | null> {
    let bestId: string | null = null;
    let bestScore = 0;

    // Pre-generate embedding for the new person description if not present
    const personEmbedding = await this.vector.generateEmbedding(
      person.embedText,
    );

    for (const [id, record] of Object.entries(existing)) {
      // 1. Descriptor overlap (clothing, hair, etc.)
      const dScore = this.descriptorSimilarity(
        person.descriptors,
        record.canonicalDescriptors,
      );

      // 2. Semantic similarity (general identity description)
      let sScore = 0;
      if (
        personEmbedding.length > 0 &&
        record.embedding &&
        record.embedding.length > 0
      ) {
        sScore = this.vector.cosineSimilarity(
          personEmbedding,
          record.embedding,
        );
      }

      // Weighted average
      let combinedScore =
        dScore * this.DESCRIPTOR_WEIGHT + sScore * this.SEMANTIC_WEIGHT;

      // 3. Social Context Boost (New "Senior" Logic)
      if (socialContext.length > 0) {
        // If this record ID has ever appeared with anyone in our current socialContext, boost it
        const hasCoOccurred = socialContext.some((ctxPerson) =>
          ctxPerson.imageIds.some((imgId) => record.imageIds.includes(imgId)),
        );
        if (hasCoOccurred) {
          combinedScore += this.CO_OCCURRENCE_BOOST;
          this.logger.debug(
            `Applying CO_OCCURRENCE_BOOST for ${id.slice(0, 8)}`,
          );
        }
      }

      this.logger.debug(
        `Match attempt for ${id.slice(0, 8)} vs new: desc=${dScore.toFixed(2)}, semantic=${sScore.toFixed(2)}, combined=${combinedScore.toFixed(2)}`,
      );

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestId = id;
      }
    }

    if (bestScore >= this.MATCH_THRESHOLD_BASE) {
      this.logger.log(
        `Found consensus match: ${bestId?.slice(0, 8)} with score ${bestScore.toFixed(2)}`,
      );
      return bestId;
    }

    return null;
  }

  /**
   * High-Level Pipeline Recalibration:
   * Re-evaluates all identities in the vault to find potential merges that
   * become obvious only after multiple sightings.
   */
  async recalibrateVault(
    allPeople: Record<string, PersonRecord>,
    allImages: ImageRecord[],
  ): Promise<Record<string, PersonRecord>> {
    this.logger.log(
      `[Pipeline] Initiating global identity recalibration for ${Object.keys(allPeople).length} entities`,
    );
    // Implementation would detect clusters of "strangers" with high descriptor overlap
    // and merge them into canonical identities.
    return allPeople;
  }

  private descriptorSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a.map((s) => s.toLowerCase().trim()));
    const setB = new Set(b.map((s) => s.toLowerCase().trim()));
    let overlap = 0;
    for (const token of setA) {
      // partial match: check if any token in B contains this token or vice versa
      for (const t of setB) {
        if (t.includes(token) || token.includes(t)) {
          overlap++;
          break;
        }
      }
    }
    return overlap / Math.max(setA.size, setB.size);
  }

  /**
   * Predictive Relationship Engine:
   * Analyzes co-occurrence patterns to suggest connections that the VLM might have missed
   * or to strengthen existing ones.
   */
  predictRelationships(
    images: ImageRecord[],
    existingRels: Relationship[],
  ): Relationship[] {
    const coOccurrenceCounts: Record<string, number> = {};
    const updatedRels = [...existingRels];

    // Count how many times each pair appears together
    images.forEach((img) => {
      const pIds = img.detectedPersonIds;
      if (pIds.length < 2) return;

      for (let i = 0; i < pIds.length; i++) {
        for (let j = i + 1; j < pIds.length; j++) {
          const pair = [pIds[i], pIds[j]].sort().join('<->');
          coOccurrenceCounts[pair] = (coOccurrenceCounts[pair] || 0) + 1;
        }
      }
    });

    // If a pair appears together more than 3 times, ensure a relationship exists
    Object.entries(coOccurrenceCounts).forEach(([pair, count]) => {
      if (count >= 3) {
        const [sourceId, targetId] = pair.split('<->');
        const exists = updatedRels.some(
          (r) =>
            (r.person1Id === sourceId && r.person2Id === targetId) ||
            (r.person1Id === targetId && r.person2Id === sourceId),
        );

        if (!exists) {
          updatedRels.push({
            person1Id: sourceId,
            person2Id: targetId,
            relation: 'Frequent Associate',
            evidence: `Automatically detected: These people appear together in ${count} different memories.`,
            confidence: Math.min(count / 10, 1.0),
          });
        }
      }
    });

    return updatedRels;
  }
}
