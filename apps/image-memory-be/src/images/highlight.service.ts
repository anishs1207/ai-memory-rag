import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { VlmService } from './vlm.service';
import { ImageMemoryStore } from './image-memory.store';
import { ImageRecord, PersonRecord } from './types/image-memory.types';

export interface Highlight {
  id: string;
  type: 'person' | 'event' | 'location' | 'mood';
  title: string;
  content: string;
  imageIds: string[];
  vibe: string;
}

@Injectable()
export class HighlightService {
  private readonly logger = new Logger(HighlightService.name);

  constructor(
    private readonly vlm: VlmService,
    private readonly store: ImageMemoryStore,
  ) {}

  /**
   * Generate a highlight vignette for a specific person.
   */
  async generatePersonHighlight(personId: string): Promise<Highlight> {
    const person = this.store.getPerson(personId);
    if (!person) throw new NotFoundException(`Person ${personId} not found`);

    const images = person.imageIds
      .map((id) => this.store.getImage(id))
      .filter(Boolean);

    if (images.length === 0) {
      throw new Error(`No images found for person ${personId}`);
    }

    const context = `You are an expert biographer and storyteller. Write a short, evocative vignette about this person's "Visual Journey" through the memories captured in the system.
    
    PERSON:
    Name: ${person.name || 'Unknown Identity'}
    Age/Gender: ${person.age || 'Unknown'} / ${person.gender || 'Unknown'}
    Visual Descriptors: ${person.canonicalDescriptors.join(', ')}
    Biography: ${person.biography || 'Not yet written'}
    
    MEMORIES CONTEXT:
    Total sightings: ${images.length}
    Scenes: ${images.map((img) => img.analysis.scene).join('; ')}
    Atmospheres: ${images.map((img) => img.analysis.atmosphere).join(', ')}`;

    const response = await this.vlm.queryContext(
      'Highlight Mode',
      `${context}
    
    Write a poetic title (max 4 words) and a short "Moment Highlight" (2-3 sentences) that captures their essence across these memories.
    Format your response as:
    Title: [Title]
    Vibe: [One-word atmosphere]
    Vignette: [The Story]`,
    );

    const titleMatch = response.match(/Title:\s*(.*)/);
    const vibeMatch = response.match(/Vibe:\s*(.*)/);
    const vignetteMatch = response.match(/Vignette:\s*(.*)/s);

    return {
      id: `highlight-p-${personId}-${Date.now()}`,
      type: 'person',
      title: titleMatch
        ? titleMatch[1].trim()
        : `${person.name || 'Someone'}'s Journey`,
      vibe: vibeMatch ? vibeMatch[1].trim() : 'nostalgic',
      content: vignetteMatch ? vignetteMatch[1].trim() : response,
      imageIds: person.imageIds.slice(0, 5), // Representative images
    };
  }

  /**
   * Generate a highlight for a specific location context.
   */
  async generateLocationHighlight(location: string): Promise<Highlight> {
    const images = this.store
      .getAllImages()
      .filter(
        (img) =>
          img.analysis.locationContext?.toLowerCase() ===
          location.toLowerCase(),
      );

    if (images.length === 0)
      throw new NotFoundException(`No memories found in ${location}`);

    const context = `Write a short, cinematic description of the user's memories in "${location}". 
    Focus on the sensory details mentioned in the image analyses:
    ${images.map((img) => img.analysis.rawDescription.slice(0, 100)).join('\n---\n')}`;

    const response = await this.vlm.queryContext(
      'Location Highlight',
      `${context}
    
    Format:
    Title: [Cinematic Title]
    Vibe: [Atmosphere]
    Vignette: [Story]`,
    );

    const titleMatch = response.match(/Title:\s*(.*)/);
    const vibeMatch = response.match(/Vibe:\s*(.*)/);
    const vignetteMatch = response.match(/Vignette:\s*(.*)/s);

    return {
      id: `highlight-l-${location.toLowerCase()}-${Date.now()}`,
      type: 'location',
      title: titleMatch ? titleMatch[1].trim() : `The Spirit of ${location}`,
      vibe: vibeMatch ? vibeMatch[1].trim() : 'immersive',
      content: vignetteMatch ? vignetteMatch[1].trim() : response,
      imageIds: images.map((img) => img.imageId).slice(0, 3),
    };
  }
}
