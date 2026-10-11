// API-100 « Pièces » — `/client/dossiers/{référence}/documents…` (EC-20, EC-21), the local stand-in of the direct send to
// the storage (`PUT /client/uploads/{id}/content`, API-080 step 2) and two consent routes proposed to API-100 (DOS-040,
// DOS-032: the consent is given from « Mes pièces » and recorded with source `dossier:documents`). Every route is a
// signed-in client's (@ClientAccess: session, kind, audience, anti-forgery header on writes); ownership in the service.
import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, Res } from '@nestjs/common';
import type {
  AnnounceUploadResponse,
  ClientDocument,
  ClientDocumentsView,
  ClientDossierParty,
  CompletedUpload,
  SignedFileUrl,
} from '@dp/contracts';
import type { Request, Response } from 'express';
import { ClientAccess, CurrentAuth } from '../identity/access.js';
import type { AuthContext } from '../identity/sessions.service.js';
import { ClientDocumentsService } from './client-documents.service.js';

const uuid = new ParseUUIDPipe();

@Controller('client')
@ClientAccess()
export class ClientDocumentsController {
  constructor(private readonly docs: ClientDocumentsService) {}

  @Get('dossiers/:reference/documents')
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string): Promise<ClientDocumentsView> {
    return this.docs.view(auth, reference);
  }

  @Get('dossiers/:reference/documents/:id')
  @Header('Cache-Control', 'private, no-store')
  one(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string, @Param('id', uuid) id: string): Promise<ClientDocument> {
    return this.docs.one(auth, reference, id);
  }

  /** API-080 step 1. */
  @Post('dossiers/:reference/documents/:id/uploads')
  announce(@CurrentAuth() auth: AuthContext, @Param('reference') reference: string, @Param('id', uuid) id: string, @Body() body: unknown): Promise<AnnounceUploadResponse> {
    return this.docs.announce(auth, reference, id, body);
  }

  /** API-080 step 3. */
  @Post('dossiers/:reference/documents/:id/uploads/:uploadId/complete')
  @HttpCode(200)
  complete(
    @CurrentAuth() auth: AuthContext,
    @Param('reference') reference: string,
    @Param('id', uuid) id: string,
    @Param('uploadId', uuid) uploadId: string,
  ): Promise<CompletedUpload> {
    return this.docs.complete(auth, reference, id, uploadId);
  }

  /** API-081 — Idempotency-Key required (API-040). */
  @Post('dossiers/:reference/documents/:id/versions')
  async version(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentAuth() auth: AuthContext,
    @Param('reference') reference: string,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<ClientDocument> {
    const r = await this.docs.createVersion(req, auth, reference, id, body);
    res.status(r.status);
    return r.body;
  }

  /** MED-030 — a signed address of 5 minutes; `disposition=inline` for the viewer, `attachment` (default) to download. */
  @Get('dossiers/:reference/documents/:id/files/:fileId')
  @Header('Cache-Control', 'private, no-store')
  file(
    @CurrentAuth() auth: AuthContext,
    @Param('reference') reference: string,
    @Param('id', uuid) id: string,
    @Param('fileId', uuid) fileId: string,
    @Query('disposition') disposition?: string,
  ): Promise<SignedFileUrl> {
    return this.docs.fileLink(auth, reference, id, fileId, disposition === 'inline' ? 'inline' : 'attachment');
  }

  /** DOS-040 — « J'accepte la transmission de mon dossier à ces partenaires. » */
  @Post('dossiers/:reference/consent')
  @HttpCode(200)
  consent(@Req() req: Request, @CurrentAuth() auth: AuthContext, @Param('reference') reference: string, @Body() body: unknown): Promise<ClientDocumentsView['consent']> {
    return this.docs.giveTransmissionConsent(req, auth, reference, body);
  }

  /** DOS-032 — « Je confirme avoir l'accord de {prénom} pour transmettre ses documents. » */
  @Post('dossiers/:reference/parties/:partyId/authorization')
  @HttpCode(200)
  authorize(
    @Req() req: Request,
    @CurrentAuth() auth: AuthContext,
    @Param('reference') reference: string,
    @Param('partyId', uuid) partyId: string,
    @Body() body: unknown,
  ): Promise<ClientDossierParty> {
    return this.docs.authorizeParty(req, auth, reference, partyId, body);
  }

  /** API-080 step 2 — local stand-in for the direct send to the storage (raw bytes, signed address). */
  @Put('uploads/:id/content')
  @HttpCode(204)
  content(@CurrentAuth() auth: AuthContext, @Param('id', uuid) id: string, @Query() query: { e?: string; s?: string }, @Body() body: unknown): Promise<void> {
    return this.docs.receiveContent(auth, id, query, body);
  }
}
