// Work packages A.5 « Assistant guidé » and A.13 « Assistant conversationnel » — 02-site-public/09 (EP-22). The
// conversational mode (ASS-050 to ASS-052) sits next to the questionnaire and falls back on it.
import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module.js';
import { ENV, type Env } from '../config/env.js';
import { AssistantController } from './assistant.controller.js';
import { GuidedSearchService } from './guided-search.service.js';
import { AssistantJobs } from './ai/assistant-jobs.js';
import { ASSISTANT_MODEL } from './ai/assistant-model.js';
import { ConversationController } from './ai/conversation.controller.js';
import { ConversationService } from './ai/conversation.service.js';
import { assistantModelFromEnv } from './ai/model-provider.js';

@Module({
  imports: [CatalogueModule],
  controllers: [AssistantController, ConversationController],
  providers: [
    GuidedSearchService,
    ConversationService,
    AssistantJobs,
    { provide: ASSISTANT_MODEL, useFactory: (env: Env) => assistantModelFromEnv(env), inject: [ENV] },
  ],
})
export class AssistantModule {}
