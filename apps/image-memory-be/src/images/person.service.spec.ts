import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PersonService } from './person.service';
import { VectorService } from './vector.service';
import { VlmService } from './vlm.service';
import { DetectedPerson, PersonRecord } from './types/image-memory.types';

describe('PersonService', () => {
  let service: PersonService;
  let vectorService: any;
  let vlmService: any;

  beforeEach(() => {
    vectorService = {
      generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
      cosineSimilarity: vi.fn().mockReturnValue(0.8),
    };
    vlmService = {
      queryContext: vi.fn().mockResolvedValue('Mocked biography'),
    };
    service = new PersonService(vectorService, vlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolvePeople', () => {
    it('should create a new person if no match is found', async () => {
      // Mock cosineSimilarity to return low score for no match
      vi.spyOn(vectorService, 'cosineSimilarity').mockReturnValue(0.1);

      const detected: DetectedPerson[] = [
        {
          personId: '',
          descriptors: ['tall', 'blue hat'],
          embedText: 'A tall person with a blue hat',
        },
      ];
      const existing: Record<string, PersonRecord> = {};
      const result = await service.resolvePeople(
        detected,
        existing,
        'img-1',
        '2024-01-01',
      );

      expect(Object.keys(result.updatedPeople)).toHaveLength(1);
      expect(result.resolvedPersonIds).toHaveLength(1);
      const newId = result.resolvedPersonIds[0];
      const newPerson = result.updatedPeople[newId];
      expect(newPerson.canonicalDescriptors).toContain('blue hat');
    });

    it('should match an existing person based on descriptor overlap', async () => {
      const personId = 'existing-1';
      const existing: Record<string, PersonRecord> = {
        [personId]: {
          personId,
          canonicalDescriptors: ['tall', 'blue hat', 'glasses'],
          embedText: 'Someone tall with blue hat and glasses',
          embedding: new Array(384).fill(0.1),
          imageIds: ['img-0'],
          firstSeen: '2024-01-01',
          lastSeen: '2024-01-01',
          moodHistory: [],
        },
      };

      const detected: DetectedPerson[] = [
        {
          personId: '',
          descriptors: ['tall', 'blue hat'], // 2/3 overlap
          embedText: 'A tall person with a blue hat',
        },
      ];

      const result = await service.resolvePeople(
        detected,
        existing,
        'img-1',
        '2024-01-02',
      );
      expect(result.resolvedPersonIds[0]).toBe(personId);
      expect(result.updatedPeople[personId].imageIds).toContain('img-1');
    });
  });
});
