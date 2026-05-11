import { Module } from '@nestjs/common';
import { ImagesController, BackendController } from './images.controller';
import { ImagesService } from './images.service';
import { ImagePipeline } from './image.pipeline';
import { VlmService } from './vlm.service';
import { PersonService } from './person.service';
import { ImageMemoryStore } from './image-memory.store';

import { VectorService } from './vector.service';
import { EventService } from './event.service';
import { ImageProcessingService } from './image-processing.service';
import { BullModule } from '@nestjs/bullmq';

import { ImageProcessor } from './image-processor';
import { JournalService } from './journal.service';
import { PredictionService } from './prediction.service';
import { HighlightService } from './highlight.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'image-processing',
    }),
  ],
  controllers: [ImagesController, BackendController],
  providers: [
    ImagesService,
    ImagePipeline,
    VlmService,
    PersonService,
    ImageMemoryStore,
    VectorService,
    EventService,
    ImageProcessingService,
    ImageProcessor,
    JournalService,
    PredictionService,
    HighlightService,
  ],
  exports: [ImagesService, ImageMemoryStore],
})
export class ImagesModule {}
