import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { ImageRecord } from './types/image-memory.types';

describe('EventService', () => {
  let service: EventService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventService],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  it('should cluster images into separate events if timed apart', () => {
    const images: Partial<ImageRecord>[] = [
      {
        imageId: 'img1',
        uploadedAt: '2024-01-01T10:00:00Z',
        analysis: { scene: 'First scene' } as any,
        detectedPersonIds: ['p1'],
      },
      {
        imageId: 'img2',
        uploadedAt: '2024-01-01T10:30:00Z',
        analysis: { scene: 'Second scene' } as any,
        detectedPersonIds: ['p1', 'p2'],
      },
      {
        imageId: 'img3',
        uploadedAt: '2024-01-01T14:00:00Z', // > 2 hours later
        analysis: { scene: 'Late scene' } as any,
        detectedPersonIds: ['p3'],
      },
    ];

    const clusters = service.clusterEvents(images as ImageRecord[]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].imageIds).toContain('img1');
    expect(clusters[0].imageIds).toContain('img2');
    expect(clusters[1].imageIds).toContain('img3');
    expect(clusters[0].personIds).toContain('p2');
  });
});
