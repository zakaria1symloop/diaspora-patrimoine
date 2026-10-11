// IA-013 (assistant line of `purge`, AUT-091) — the conversations of the assistant are deleted 30 days after they
// started. Declared to the `purge` task of the scheduler (automation/scheduler.ts).
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Scheduler } from '../../automation/scheduler.js';
import { Clock } from '../../platform/clock.js';
import { PrismaService } from '../../platform/prisma.service.js';
import { log } from '../../platform/request-context.js';

@Injectable()
export class AssistantJobs implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly scheduler: Scheduler,
  ) {}

  onModuleInit(): void {
    this.scheduler.registerPurge('assistantConversations', () => this.purge());
  }

  /** Returns the number of conversations deleted. */
  async purge(): Promise<number> {
    const { count } = await this.prisma.assistantConversation.deleteMany({ where: { expiresAt: { lte: this.clock.now() } } });
    if (count) log('info', 'assistant.ai.purged', { count });
    return count;
  }
}
