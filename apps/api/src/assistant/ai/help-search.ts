// IA-010 point 2 — the assistant answers questions about the platform from the published FAQ questions (EDI-040) and
// published pages (EDI-002) only, and cites them. A plain word search, accents and case ignored: the corpus is small
// (dozens of entries) and its texts are written by the team.
import type { AiSource } from '@dp/contracts';

export interface HelpDocument {
  kind: 'FAQ' | 'PAGE';
  slug: string;
  title: string;
  /** Plain text (HTML removed). */
  body: string;
}

export interface HelpHit {
  source: AiSource;
  excerpt: string;
}

/** Words that carry no meaning for the search (French, the language of the corpus). */
const STOP = new Set(
  'a au aux avec ce ces dans de des du elle en et est il ils je la le les leur mais me mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y est-ce quoi comment quand quel quelle quels quelles faire fait peut peux puis-je dois doit apres avant ma mes'.split(' '),
);

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function words(s: string): string[] {
  return normalise(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, 6) : w)); // a crude stem: « financement », « financer » meet on « financ »
}

/** HTML of a rich text → plain text. */
export function plainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function hrefOf(d: Pick<HelpDocument, 'kind' | 'slug'>): string {
  return d.kind === 'FAQ' ? `/faq#q-${d.slug}` : `/infos/${d.slug}`;
}

/** The three best documents for the query (a title word counts three times a body word); none under one match. */
export function searchHelp(docs: HelpDocument[], query: string, limit = 3, excerptLength = 1200): HelpHit[] {
  const wanted = [...new Set(words(query))];
  if (!wanted.length) return [];
  const scored = docs
    .map((d) => {
      const title = new Set(words(d.title));
      const body = new Set(words(d.body));
      let score = 0;
      for (const w of wanted) score += (title.has(w) ? 3 : 0) + (body.has(w) ? 1 : 0);
      return { d, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.d.title.localeCompare(b.d.title));
  return scored.slice(0, limit).map(({ d }) => ({
    source: { kind: d.kind, title: d.title, href: hrefOf(d) },
    excerpt: d.body.length > excerptLength ? `${d.body.slice(0, excerptLength)}…` : d.body,
  }));
}
