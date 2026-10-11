// CTL-080…CTL-082 — media of programmes, properties, lots, points of progress, promoters, banks and other partners,
// through the MED-020 pipeline. When a media becomes READY, the owner's caches are recalculated in the same
// transaction (MOD-220, MOD-236); a logo or a promoter's cover is a single slot: the new image replaces the previous one.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { Media, MediaKind } from '../generated/prisma/client.js';
import { AppError } from '../platform/errors.js';
import { PrismaService } from '../platform/prisma.service.js';
import type { Tx } from '../platform/tx.js';
import type { Actor } from '../admin/actor.js';
import { ChangeNotifier } from '../admin/revalidation.js';
import { MediaPipeline, sha256, type MediaHooks } from '../files/media-pipeline.js';
import { CatalogueCaches } from './catalogue-caches.js';

export type CatalogueOwnerType = 'PROGRAM' | 'PROPERTY' | 'LOT' | 'PROMOTER' | 'BANK' | 'PARTNER' | 'PROGRAM_UPDATE';

export interface AttachInput {
  ownerType: CatalogueOwnerType;
  ownerId: string;
  kind: MediaKind;
  /** Local file (demo, installation); the HTTP upload of API-080 passes the received bytes instead. */
  filePath?: string;
  body?: Buffer;
  fileName?: string;
  alt?: string | null;
  caption?: string | null;
  roomLabel?: string | null;
  isIllustration?: boolean;
  isCover?: boolean;
}

@Injectable()
export class CatalogueMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: MediaPipeline,
    private readonly caches: CatalogueCaches,
    private readonly notifier: ChangeNotifier,
  ) {}

  /** ARC-040 — the public pages a media of this owner appears on. */
  async ownerTags(ownerType: string, ownerId: string): Promise<string[]> {
    if (ownerType === 'PROGRAM') return ['catalogue', 'home', `program:${ownerId}`];
    if (ownerType === 'PROPERTY') {
      const p = await this.prisma.property.findUnique({ where: { id: ownerId }, select: { programId: true } });
      return ['catalogue', 'home', `property:${ownerId}`, ...(p?.programId ? [`program:${p.programId}`] : [])];
    }
    if (ownerType === 'LOT') {
      const lot = await this.prisma.lot.findUnique({ where: { id: ownerId }, select: { propertyId: true } });
      return lot ? ['catalogue', `property:${lot.propertyId}`] : [];
    }
    if (ownerType === 'PROGRAM_UPDATE') {
      const u = await this.prisma.programUpdate.findUnique({ where: { id: ownerId }, select: { programId: true } });
      return u ? ['catalogue', `program:${u.programId}`] : [];
    }
    return ['catalogue', 'home'];
  }

  async checkOwner(ownerType: CatalogueOwnerType, ownerId: string): Promise<void> {
    const where = { id: ownerId, deletedAt: null };
    const found =
      ownerType === 'PROGRAM' ? await this.prisma.program.findFirst({ where })
      : ownerType === 'PROPERTY' ? await this.prisma.property.findFirst({ where })
      : ownerType === 'LOT' ? await this.prisma.lot.findFirst({ where })
      : ownerType === 'PROMOTER' ? await this.prisma.promoter.findFirst({ where })
      : ownerType === 'PARTNER' ? await this.prisma.partner.findFirst({ where })
      : ownerType === 'PROGRAM_UPDATE' ? await this.prisma.programUpdate.findFirst({ where })
      : await this.prisma.bank.findFirst({ where });
    if (!found) throw AppError.notFound();
  }

  /** MOD-220 — caches touched by a media of this owner (also after a deletion or a change of kind). */
  async recalcOwner(tx: Tx, ownerType: string, ownerId: string): Promise<void> {
    if (ownerType === 'PROGRAM') await this.caches.recalcProgramTree(tx, ownerId);
    else if (ownerType === 'PROPERTY') await this.caches.recalcPropertyAndProgram(tx, ownerId);
    else if (ownerType === 'LOT') {
      const lot = await tx.lot.findUniqueOrThrow({ where: { id: ownerId }, select: { propertyId: true } });
      await this.caches.recalcPropertyAndProgram(tx, lot.propertyId);
    }
  }

  /** Single-image slots: a promoter's logo and cover, a bank's or a partner's logo — the new one replaces the old one. */
  private async fillSlot(tx: Tx, media: Media): Promise<void> {
    const slot =
      media.ownerType === 'PROMOTER' && media.kind === 'LOGO' ? 'logoMediaId'
      : media.ownerType === 'PROMOTER' && media.kind === 'PHOTO' ? 'coverMediaId'
      : (media.ownerType === 'BANK' || media.ownerType === 'PARTNER') && media.kind === 'LOGO' ? 'logoMediaId'
      : null;
    if (!slot) return;
    const data = { [slot]: media.id, updatedAt: media.updatedAt };
    if (media.ownerType === 'PROMOTER') await tx.promoter.update({ where: { id: media.ownerId }, data });
    else if (media.ownerType === 'BANK') await tx.bank.update({ where: { id: media.ownerId }, data: { logoMediaId: media.id } });
    else await tx.partner.update({ where: { id: media.ownerId }, data: { logoMediaId: media.id } });
    await tx.media.updateMany({ where: { ownerType: media.ownerType, ownerId: media.ownerId, kind: media.kind, deletedAt: null, NOT: { id: media.id } }, data: { deletedAt: media.updatedAt, updatedAt: media.updatedAt } });
  }

  /** The hooks of the pipeline for a catalogue owner (upload, retry). */
  hooks(): MediaHooks {
    return {
      onReady: async (tx, m) => {
        await this.recalcOwner(tx, m.ownerType, m.ownerId);
        await this.fillSlot(tx, m);
      },
    };
  }

  /** Idempotent on (owner, file name, checksum): a file already attached is returned as is. */
  async attach(input: AttachInput, actor: Actor): Promise<{ media: Media; created: boolean }> {
    await this.checkOwner(input.ownerType, input.ownerId);
    const body = input.body ?? (input.filePath ? await readFile(input.filePath) : null);
    if (!body) throw AppError.validation([{ field: 'file', code: 'FILE_UNREADABLE' }]);
    const fileName = input.fileName ?? (input.filePath ? basename(input.filePath) : 'image');
    const existing = await this.pipeline.findExisting(input.ownerType, input.ownerId, fileName, sha256(body));
    if (existing) return { media: existing, created: false };
    const media = await this.pipeline.ingest(
      {
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        kind: input.kind,
        body,
        fileName,
        alt: input.alt,
        caption: input.caption,
        roomLabel: input.roomLabel,
        isIllustration: input.isIllustration,
        isCover: input.isCover,
      },
      actor,
      this.hooks(),
    );
    await this.notifier.committed(await this.ownerTags(input.ownerType, input.ownerId));
    return { media, created: true };
  }
}
