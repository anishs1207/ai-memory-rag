import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

import { ImagesService } from './images.service';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { ChatMemoryDto } from './dto/chat-memory.dto';
import * as fs from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * ImagesController exposes all image-memory endpoints under /images.
 *
 * POST   /images/upload              — Upload and process one image
 * GET    /images                     — List all ingested images
 * GET    /images/:id                 — Get single image metadata
 * GET    /images/:id/file            — Stream the original image file
 * GET    /images/people              — List all identified people
 * GET    /images/people/:personId    — Get a person + all their photos
 * GET    /images/relationships       — All extracted relationships
 * GET    /images/relationships/:id   — Relationships for a specific person
 * GET    /images/stats               — High-level statistics
 *
 * POST   /backend/query              — Query the image memory with natural language
 */
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  // ── Upload ───────────────────────────────────────────────────────────────

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
          cb(null, unique + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file)
      throw new BadRequestException('No image file provided (field: "image")');
    return this.imagesService.ingestImage(file);
  }

  // ── Images ───────────────────────────────────────────────────────────────

  @Get()
  getAllImages() {
    return this.imagesService.getAllImages();
  }

  @Get('stats')
  getStats() {
    return this.imagesService.getStats();
  }

  @Get('search')
  async searchImages(@Query('q') query: string) {
    if (!query) throw new BadRequestException('q query param is required');
    return this.imagesService.searchImages(query);
  }

  @Get('search-by-text')
  async searchByText(@Query('q') text: string) {
    if (!text) throw new BadRequestException('q query param is required');
    return this.imagesService.searchByText(text);
  }

  @Get('timeline/events')
  getTimeline() {
    return this.imagesService.getTimeline();
  }

  @Get('geo/all')
  getGeographic() {
    return this.imagesService.getGeographicImages();
  }

  @Get('journals/all')
  getJournals() {
    return this.imagesService.getJournals();
  }

  @Get('predictions')
  getPredictions() {
    return this.imagesService.getPredictions();
  }

  @Get('flashbacks')
  getFlashbacks() {
    return this.imagesService.getFlashbacks();
  }

  @Get('filter')
  getFiltered(
    @Query('personId') personId?: string,
    @Query('tag') tag?: string,
    @Query('atmosphere') atmosphere?: string,
  ) {
    return this.imagesService.getFilteredImages({ personId, tag, atmosphere });
  }

  @Post('search-by-image')
  @UseInterceptors(FileInterceptor('image'))
  async searchByImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file is required');
    return this.imagesService.searchByImage(file);
  }

  @Get(':id')
  getImage(@Param('id') id: string) {
    return this.imagesService.getImage(id);
  }

  @Get(':id/file')
  streamFile(@Param('id') id: string, @Res() res: Response) {
    const { path: filePath, filename } = this.imagesService.getImageFile(id);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res as any);
  }

  @Get(':id/privacy')
  async streamBlurred(@Param('id') id: string, @Res() res: Response) {
    const { path: filePath } = this.imagesService.getImageFile(id);
    const img = this.imagesService.getImage(id);

    // Privacy Logic: find people with no name or name "unknown"
    const strangers = img.analysis.detectedPeople
      .filter((p) => !p.name || p.name.toLowerCase() === 'unknown')
      .map((p) => p.boundingBox)
      .filter(Boolean);

    if (strangers.length === 0) {
      const stream = fs.createReadStream(filePath);
      return stream.pipe(res as any);
    }

    const blurredBuffer = await this.imagesService.blurStrangers(id, strangers);
    res.setHeader('Content-Type', 'image/jpeg');
    res.end(blurredBuffer);
  }

  // ── People ───────────────────────────────────────────────────────────────

  @Get('people/all')
  getAllPeople() {
    return this.imagesService.getAllPeople();
  }

  @Get('people/:personId')
  getPerson(@Param('personId') personId: string) {
    return this.imagesService.getPerson(personId);
  }

  @Post('people/:personId/rename')
  @HttpCode(HttpStatus.OK)
  renamePerson(
    @Param('personId') personId: string,
    @Body('name') name: string,
  ) {
    if (!name) throw new BadRequestException('Name is required');
    return this.imagesService.updatePersonName(personId, name);
  }

  @Post('people/merge')
  @HttpCode(HttpStatus.OK)
  mergePeople(
    @Body('targetId') targetId: string,
    @Body('sourceId') sourceId: string,
  ) {
    if (!targetId || !sourceId)
      throw new BadRequestException('targetId and sourceId are required');
    return this.imagesService.mergePeople(targetId, sourceId);
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  @Get('relationships/all')
  getAllRelationships() {
    return this.imagesService.getAllRelationships();
  }

  @Get('relationships/person/:personId')
  getRelationshipsForPerson(@Param('personId') personId: string) {
    return this.imagesService.getRelationshipsForPerson(personId);
  }

  @Get('events/all')
  getAllEvents() {
    return this.imagesService.getAllEvents();
  }

  @Get('people/:personId/mood-history')
  getMoodHistory(@Param('personId') personId: string) {
    return this.imagesService.getMoodHistory(personId);
  }

  // ── Search ───────────────────────────────────────────────────────────────

  @Post('journals/generate')
  generateJournal(@Body('date') date: string) {
    if (!date) throw new BadRequestException('date field is required');
    return this.imagesService.generateJournalForDate(date);
  }

  @Get('people/:personId/highlight')
  getPersonHighlight(@Param('personId') personId: string) {
    return this.imagesService.getPersonHighlight(personId);
  }

  @Get('highlights/location')
  getLocationHighlight(@Query('name') location: string) {
    return this.imagesService.getLocationHighlight(location);
  }

  @Post('similar/:id')
  getSimilar(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.imagesService.findSimilarImages(id, limit ? Number(limit) : 5);
  }

  @Post('reset-all')
  @HttpCode(HttpStatus.OK)
  async clearAll() {
    return this.imagesService.clearData();
  }
}

/**
 * BackendController exposes the /backend route for memory querying.
 */
@Controller('backend')
export class BackendController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async queryMemory(@Body() dto: QueryMemoryDto) {
    if (!dto.query?.trim())
      throw new BadRequestException('query field is required');
    return this.imagesService.queryMemory(dto.query);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chatWithMemory(@Body() dto: ChatMemoryDto) {
    return this.imagesService.chatWithMemory(dto);
  }
}
