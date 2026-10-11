// The back-office use cases built in-process, without the HTTP layer — for the commands (demo, installation) that
// must go through exactly the same services as the routes (PAR-082). Revalidation tags are collected and sent once.
import type { Env } from '../config/env.js';
import { loadEnv } from '../config/env.js';
import { Clock } from '../platform/clock.js';
import { OutboxWriter } from '../platform/outbox.js';
import { PrismaService } from '../platform/prisma.service.js';
import { SettingsService } from '../platform/settings.service.js';
import { ChangeNotifier, WebRevalidator } from '../admin/revalidation.js';
import { CatalogueCaches } from '../catalogue-admin/catalogue-caches.js';
import { CatalogueMediaService } from '../catalogue-admin/catalogue-media.service.js';
import { LotsAdminService } from '../catalogue-admin/lots-admin.service.js';
import { PartnersAdminService } from '../catalogue-admin/partners-admin.service.js';
import { ProgramsAdminService } from '../catalogue-admin/programs-admin.service.js';
import { PropertiesAdminService } from '../catalogue-admin/properties-admin.service.js';
import { PropertyPublication } from '../catalogue-admin/property-publication.js';
import { EventsAdminService } from '../events-admin/events-admin.service.js';
import { MediaPipeline } from '../files/media-pipeline.js';
import { LocalObjectStorage } from '../files/object-storage.js';
import { scannerFor } from '../files/virus-scanner.js';

/** Accumulates the tags of every committed write; `flush()` sends them in one call. */
export class CollectingNotifier extends ChangeNotifier {
  readonly tags = new Set<string>();
  constructor(private readonly target: WebRevalidator) {
    super(target);
  }
  override async committed(tags: string[]): Promise<void> {
    for (const t of tags) this.tags.add(t);
  }
  async flush(): Promise<boolean> {
    const ok = await this.target.revalidate([...this.tags]);
    this.tags.clear();
    return ok;
  }
}

export interface AdminServices {
  env: Env;
  prisma: PrismaService;
  clock: Clock;
  settings: SettingsService;
  storage: LocalObjectStorage;
  pipeline: MediaPipeline;
  notifier: CollectingNotifier;
  partners: PartnersAdminService;
  programs: ProgramsAdminService;
  properties: PropertiesAdminService;
  lots: LotsAdminService;
  media: CatalogueMediaService;
  events: EventsAdminService;
  close(): Promise<void>;
}

export async function buildAdminServices(env: Env = loadEnv()): Promise<AdminServices> {
  const prisma = new PrismaService(env);
  const clock = new Clock(env);
  const settings = new SettingsService(prisma, clock);
  await settings.all(); // applies `clock.offsetDays` where allowed (ENV-032)
  const storage = new LocalObjectStorage();
  const pipeline = new MediaPipeline(prisma, clock, storage, scannerFor(env.APP_ENV));
  const notifier = new CollectingNotifier(new WebRevalidator(env));
  const caches = new CatalogueCaches(settings, clock);
  const outbox = new OutboxWriter(clock);
  const publication = new PropertyPublication(caches, outbox);
  return {
    env,
    prisma,
    clock,
    settings,
    storage,
    pipeline,
    notifier,
    partners: new PartnersAdminService(prisma, clock, caches, notifier),
    programs: new ProgramsAdminService(prisma, clock, settings, caches, publication, notifier),
    properties: new PropertiesAdminService(prisma, clock, settings, caches, publication, notifier),
    lots: new LotsAdminService(prisma, clock, caches, notifier),
    media: new CatalogueMediaService(prisma, pipeline, caches, notifier),
    events: new EventsAdminService(prisma, clock, settings, outbox, pipeline, notifier),
    close: () => prisma.$disconnect(),
  };
}
