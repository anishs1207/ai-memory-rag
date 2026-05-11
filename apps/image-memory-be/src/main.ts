import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { json, urlencoded, static as expressStatic } from 'express';

dotenv.config({
  path: '../.env',
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Serve uploaded images and crops statically at /static
  app.use('/static/crops', expressStatic(join(process.cwd(), 'data', 'crops')));
  app.use('/static', expressStatic(join(process.cwd(), 'data', 'uploads')));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`\n
    Image Memory API running at http://localhost:${port}
    POST /images/upload         — ingest an image
    GET  /images                — list all images
    GET  /images/people/all     — list all identified people
    GET  /images/relationships/all — all relationships
    POST /backend/query         — query memory in natural language
    `);
}
bootstrap();
