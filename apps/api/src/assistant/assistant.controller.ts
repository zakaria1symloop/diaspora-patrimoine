// API-100 — routes of the guided assistant (EP-22, ASS-010, ASS-020). Read-only: the answers travel in the address
// (codec of `@dp/contracts`, unknown values ignored, API-011). The request that may follow is `POST /public/leads`
// with the form `GUIDED_SEARCH` (ASS-030).
import { Controller, Get, Header, Query } from '@nestjs/common';
import { parseGuidedAnswers, type GuidedQuestionsResponse, type GuidedResultsResponse } from '@dp/contracts';
import { GuidedSearchService } from './guided-search.service.js';

@Controller('public/assistant')
export class AssistantController {
  constructor(private readonly guided: GuidedSearchService) {}

  /** The choices of every question, each from the earlier answers only (ASS-010). */
  @Get('questions')
  @Header('Cache-Control', 'public, max-age=30')
  questions(@Query() query: Record<string, string>): Promise<GuidedQuestionsResponse> {
    return this.guided.questions(parseGuidedAnswers(query));
  }

  /** ASS-020, ASS-021 — six cards at most, by relevance; relaxed in the order of CAT-061 when nothing matches. */
  @Get('results')
  @Header('Cache-Control', 'public, max-age=30')
  results(@Query() query: Record<string, string>): Promise<GuidedResultsResponse> {
    return this.guided.results(parseGuidedAnswers(query));
  }
}
