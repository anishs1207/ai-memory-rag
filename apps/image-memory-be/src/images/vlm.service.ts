import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import {
  VlmAnalysis,
  DetectedPerson,
  Relationship,
} from './types/image-memory.types';

/**
 * VlmService wraps the Google Gemini Vision API (gemini-2.5-flash).
 * It is responsible for analysing a single image and returning
 * structured information about the people visible and their relationships.
 */
@Injectable()
export class VlmService {
  private readonly logger = new Logger(VlmService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Analyse an image file and return a fully structured VlmAnalysis object.
   */
  async analyseImage(imagePath: string): Promise<VlmAnalysis> {
    this.logger.log(`Analysing image: ${imagePath}`);

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    const prompt = `You are a world-class Visual Intelligence System. Analyze this scene with extreme precision.
Identify every visible person and describe them in a way that allows a different AI to re-recognize them in a different photo.
Extract all possible visual and atmospheric data.

Return ONLY valid JSON, no markdown, no extra text:

{
  "scene": "concise scene title",
  "atmosphere": "e.g. nostalgic, cozy, vibrant, tense, quiet",
  "locationContext": "Home, Nature, Urban, Workplace, Public Space, Unknown",
  "dominantColor": "characteristic #hex",
  "rawDescription": "deep visual description of the entire scene",
  "tags": ["tag1", "tag2"],
  "ocrText": "exact text from any visible signage, clothing, or screens",
  "detectedPeople": [
    {
      "name": "unknown or inferred",
      "descriptors": ["light blue collared shirt", "dark short hair", "silver glasses"],
      "embedText": "Detailed re-identification string describing height, clothing details, accessories, hair style, facial hair.",
      "age": "e.g. 30s",
      "gender": "male, female, neutral",
      "mood": "e.g. curious",
      "boundingBox": [ymin, xmin, ymax, xmax]
    }
  ],
  "relationships": [
    {
      "person1Index": 0,
      "person2Index": 1,
      "relation": "father, mother, son, daughter, sibling, spouse, friend, colleague, unknown",
      "confidence": 0.0-1.0,
      "evidence": "precise visual proof for this inference"
    }
  ]
}

Guidelines:
- normalized boundingBox [ymin, xmin, ymax, xmax] (0-1000). 
- mood: single word.
- atmosphere: overall vibe.
- ocrText: all visible text.
- Be exhaustive. If you see a person, document them perfectly.`;

    const result = await this.model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ]);

    const text = result.response.text().trim();
    this.logger.debug(
      `Raw VLM Response for ${path.basename(imagePath)}: ${text}`,
    );

    try {
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      const raw = JSON.parse(clean);

      const people: DetectedPerson[] = (raw.detectedPeople || []).map(
        (p: any) => ({
          personId: '',
          name: p.name || undefined,
          descriptors: p.descriptors || [],
          embedText: p.embedText || '',
          age: p.age || undefined,
          gender: p.gender || undefined,
          mood: p.mood || undefined,
          boundingBox: p.boundingBox || undefined,
        }),
      );

      const relationships: Omit<Relationship, 'person1Id' | 'person2Id'>[] = (
        raw.relationships || []
      ).map((r: any) => ({
        person1Index: r.person1Index,
        person2Index: r.person2Index,
        relation: r.relation || 'unknown',
        confidence: r.confidence ?? 0.5,
        evidence: r.evidence || '',
      }));

      return {
        scene: raw.scene || '',
        atmosphere: raw.atmosphere || '',
        locationContext: raw.locationContext || 'Unknown',
        dominantColor: raw.dominantColor || '#3b82f6',
        rawDescription: raw.rawDescription || '',
        tags: raw.tags || [],
        ocrText: raw.ocrText || '',
        detectedPeople: people,
        relationships: relationships as any, // resolved by PersonService
      };
    } catch (err) {
      this.logger.error(`Failed to parse VLM response: ${text}`, err);
      return {
        scene: 'Parse error',
        rawDescription: text,
        tags: [],
        detectedPeople: [],
        relationships: [],
      };
    }
  }

  /**
   * Ask the VLM a free-form question about the image memory context.
   */
  async queryContext(
    systemContext: string,
    userQuery: string,
  ): Promise<string> {
    const prompt = `You are an intelligent assistant with access to an image-based memory system.

MEMORY CONTEXT:
${systemContext}

USER QUESTION: ${userQuery}

Answer the question based on the memory context above. Be specific and reference actual people, relationships, and images from the context. If the answer is not in the context, say so clearly.`;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Targeted Identity Analysis:
   * Analyzes a cropped image of a person to get extremely fine-grained
   * identifiers that are missed in the wide scene scan.
   */
  async analyseIdentityCrop(
    cropPath: string,
  ): Promise<Partial<DetectedPerson>> {
    this.logger.log(`Targeted analysis for crop: ${cropPath}`);

    try {
      if (!fs.existsSync(cropPath)) {
        this.logger.warn(`Crop file not found: ${cropPath}`);
        return {};
      }

      const imageBuffer = fs.readFileSync(cropPath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `You are an Identity Recognition Expert. Analyze this close-up crop of a person.
      Provide a hyper-detailed re-identification string including: facial hair, specific accessory details (watch brand, glasses frame color), exact clothing patterns, and estimated height/build relative to typical scale.
      
      Return ONLY valid JSON:
      {
        "detailedEmbedText": "...",
        "descriptors": ["..."],
        "estimatedAge": "...",
        "mood": "..."
      }`;

      const result = await this.model.generateContent([
        prompt,
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
      ]);
      const text = result.response.text().trim();
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      return JSON.parse(clean);
    } catch (err) {
      this.logger.error(`Crop analysis failed for ${cropPath}`, err);
      return {};
    }
  }
}
