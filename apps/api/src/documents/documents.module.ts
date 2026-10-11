// Package 2.9 — the pieces of a dossier on the client side (EC-20, EC-21): list, three-step upload, versions processed
// in the background (antivirus, photos joined into a PDF), signed reading, transmission consent; the refused-deposit
// e-mail. The team's side (checklist templates, review) arrives with package 4.1; its domain functions live here.
import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { raw } from 'express';
import { CommunicationModule } from '../communication/communication.module.js';
import { FilesModule } from '../files/files.module.js';
import { ClientDocumentsController } from './client-documents.controller.js';
import { ClientDocumentsService } from './client-documents.service.js';
import { DocumentProcessing } from './document-processing.js';
import { DocumentsMailHandler } from './documents-mail.handler.js';

@Module({
  imports: [FilesModule, CommunicationModule],
  controllers: [ClientDocumentsController],
  providers: [ClientDocumentsService, DocumentProcessing, DocumentsMailHandler],
  exports: [ClientDocumentsService, DocumentProcessing],
})
export class DocumentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // API-080 step 2 (local stand-in of the direct send to the storage): one file, `documents.maxFileSizeMb` (≤ 50 MB).
    consumer.apply(raw({ type: () => true, limit: '51mb' })).forRoutes({ path: 'client/uploads/:id/content', method: RequestMethod.PUT });
  }
}
