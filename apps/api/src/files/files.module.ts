import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { MediaPipeline } from './media-pipeline.js';
import { LocalObjectStorage, OBJECT_STORAGE } from './object-storage.js';
import { PublicMediaController } from './public-media.controller.js';
import { PrivateFileResolvers, PrivateFilesController } from './private-files.js';
import { scannerFor, VIRUS_SCANNER } from './virus-scanner.js';

@Module({
  providers: [
    { provide: OBJECT_STORAGE, useFactory: () => new LocalObjectStorage() },
    { provide: VIRUS_SCANNER, useFactory: (env: Env) => scannerFor(env.APP_ENV), inject: [ENV] },
    MediaPipeline,
    PrivateFileResolvers,
  ],
  controllers: [PublicMediaController, PrivateFilesController],
  exports: [OBJECT_STORAGE, VIRUS_SCANNER, MediaPipeline, PrivateFileResolvers],
})
export class FilesModule {}
