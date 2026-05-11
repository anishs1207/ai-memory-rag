export interface DetectedPerson {
  personId: string; // auto-assigned stable ID
  name?: string; // if the VLM can infer a name or label
  descriptors: string[]; // visual features for re-identification
  embedText: string; // prose summary used for fuzzy matching
  age?: string; // estimated age range e.g. "30-40"
  gender?: string;
  mood?: string; // detected emotional state
  boundingBox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

export interface Relationship {
  person1Id: string;
  person2Id: string;
  relation: string; // e.g. "father", "daughter", "sibling"
  confidence: number; // 0-1
  evidence: string; // reasoning from VLM
  evidenceCount?: number;
  firstEvidenceAt?: string;
  lastEvidenceAt?: string;
}

export interface ImageRecord {
  imageId: string;
  filename: string;
  storagePath: string;
  uploadedAt: string;
  analysis: VlmAnalysis;
  detectedPersonIds: string[];
  embedding?: number[];
  caption?: string;
  gps?: { lat: number; lng: number };
  dominantColor?: string; // Hex code for vibrant theming
}

export interface VlmAnalysis {
  scene: string;
  detectedPeople: DetectedPerson[];
  relationships: Relationship[];
  rawDescription: string;
  tags: string[];
  ocrText?: string;
  atmosphere?: string; // overall vibe/mood of the photo
  locationContext?: string; // e.g. "Indoors", "Nature", "Urban"
  dominantColor?: string; // Hex code e.g. "#3b82f6"
}

export interface PersonRecord {
  personId: string;
  canonicalDescriptors: string[];
  embedText: string;
  biography?: string; // Auto-generated life story
  name?: string;
  age?: string;
  gender?: string;
  imageIds: string[]; // all images this person appears in
  firstSeen: string;
  lastSeen: string;
  embedding?: number[];
  moodHistory?: { timestamp: string; mood: string }[];
  profileImageUrl?: string;
}

export interface TimelineEvent {
  eventId: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  imageIds: string[];
  personIds: string[];
}

export interface JournalEntry {
  entryId: string;
  date: string;
  title: string;
  summary: string;
  imageIds: string[];
  mood: string;
}

export interface MemoryStore {
  images: Record<string, ImageRecord>;
  people: Record<string, PersonRecord>;
  relationships: Relationship[];
  events: TimelineEvent[];
  journals: JournalEntry[];
}
