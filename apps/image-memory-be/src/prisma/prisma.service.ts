import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

// @@will work later
// used to create it: nest g service prisma --no-spec
// npm install -D prisma
// npm install @prisma/client

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get('DATABASE_URL'),
        },
      },
    });
  }

  cleanDb() {
    return this.$transaction([
      // this.bookmark.deleteMah(),
      // this.user.deleteMan(),
    ]);
  }
}
