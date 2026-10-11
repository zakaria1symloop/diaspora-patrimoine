// EDI-001, CMS-020 — GET /public/content-blocks?group=… : the blocks of one or more page groups, never « Back-office ».
// A declared block not yet installed answers its origin value (CMS-001: keys are fixed by the code).
import { Controller, Get, Header, Query } from '@nestjs/common';
import { contentBlocks } from '@dp/contracts';
import { PrismaService } from '../platform/prisma.service.js';

const HIDDEN_GROUPS = new Set(['Back-office']);

@Controller('public/content-blocks')
export class PublicContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list(@Query('group') group?: string): Promise<{ blocks: Record<string, unknown> }> {
    const groups = (group ?? '')
      .split(',')
      .map((g) => g.trim())
      .filter((g) => g && !HIDDEN_GROUPS.has(g));
    if (groups.length === 0) return { blocks: {} };
    const rows = await this.prisma.contentBlock.findMany({
      where: { group: { in: groups }, locale: 'fr' },
      select: { key: true, value: true },
    });
    const blocks: Record<string, unknown> = {};
    for (const [key, decl] of Object.entries(contentBlocks)) {
      if (groups.includes(decl.group)) blocks[key] = decl.origin;
    }
    for (const row of rows) blocks[row.key] = row.value;
    return { blocks };
  }
}
