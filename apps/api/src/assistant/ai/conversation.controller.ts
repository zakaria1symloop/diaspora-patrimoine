// API-100, ASS-052 — routes of the conversational assistant (mode AI). `GET status` tells the site which mode the
// visitor gets; `POST messages` answers as a stream (`text/event-stream`, events of `AiStreamEvent`). Errors that come
// before the stream (OFF → 404, invalid body → 422, rate limit → 429) are ordinary API errors (API-020).
import { Body, Controller, Get, Header, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { encodeAiEvent, type AiStreamEvent, type AssistantStatusResponse } from '@dp/contracts';
import { ConversationService } from './conversation.service.js';

@Controller('public/assistant')
export class ConversationController {
  constructor(private readonly conversation: ConversationService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  async status(): Promise<AssistantStatusResponse> {
    return { mode: await this.conversation.status() };
  }

  @Post('messages')
  @HttpCode(200)
  async messages(@Req() req: Request, @Res() res: Response, @Body() body: unknown): Promise<void> {
    const prepared = await this.conversation.prepare(req, body);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // no proxy buffering: the answer is written as it comes (ASS-051)
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // The visitor leaves: the model call stops (nothing more is billed than what was written).
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    const emit = (e: AiStreamEvent) => {
      if (!res.writableEnded && !res.destroyed) res.write(encodeAiEvent(e));
    };
    await this.conversation.run(prepared, emit, abort.signal);
    if (!res.writableEnded) res.end();
  }
}
