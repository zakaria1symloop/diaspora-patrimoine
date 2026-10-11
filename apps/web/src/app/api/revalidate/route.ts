// ARC-040, NAV-042 — the API invalidates the cache tags touched by a change: POST {tags}, signed with REVALIDATE_SECRET.
// Header `X-Signature: sha256=<hex HMAC of the raw body>`. { expire: 0 }: the next visitor never sees stale data
// (a sold property must not show as available).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { env } from '@/lib/env';

const body = z.object({ tags: z.array(z.string().min(1).max(256)).min(1).max(200) });

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const given = req.headers.get('x-signature') ?? '';
  const expected = `sha256=${createHmac('sha256', env().REVALIDATE_SECRET).update(raw).digest('hex')}`;
  const ok = given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response(null, { status: 401 });
  const parsed = body.safeParse(JSON.parse(raw || '{}'));
  if (!parsed.success) return new Response(null, { status: 400 });
  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: parsed.data.tags.length });
}
