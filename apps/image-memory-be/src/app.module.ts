import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImagesModule } from './images/images.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';

import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        lazyConnect: true, // Prevents crash at start if Redis is down
      },
    }),
    ImagesModule,
    PrismaModule,
    UserModule,
  ],
})
export class AppModule {}
