// Helpers of the editorial pages (02-site-public/08): rich text sanitised again on the server with a strict
// allow-list (EDI-003, SEC-060), fields replaced in blocks (CMS-004), call link with its fallback (ACC-090).
import 'server-only';
import sanitizeHtml from 'sanitize-html';
import type { PublicSettings } from '@dp/contracts';
import { t } from './i18n';

/** EDI-003 — h2, h3, paragraphs, bold, italic, lists, links, quotes, media images, simple tables. */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['h2', 'h3', 'p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'blockquote', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'], th: ['scope'] },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https', 'http'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (_tag, attribs) => {
      const out: Record<string, string> = {};
      if (attribs.href) out.href = attribs.href;
      if (attribs.target === '_blank') {
        out.target = '_blank';
        out.rel = 'noopener noreferrer';
      }
      return { tagName: 'a', attribs: out };
    },
  },
};

export function sanitizeRich(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** A plain-text answer (no tag) becomes paragraphs; HTML is sanitised. */
export function richOrText(value: string): string {
  if (/<[a-z][\s\S]*>/i.test(value)) return sanitizeRich(value);
  const esc = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Visible text of a rich value (JSON-LD, descriptions). */
export function plainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}

/** CMS-004 — `{année}` and `{apport}`; any other braces stay as they are. */
export function fillFields(value: string, fields: { downPaymentPct?: string | number }): string {
  let out = value.replace(/\{année\}/g, String(new Date().getFullYear()));
  if (fields.downPaymentPct !== undefined) {
    const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(fields.downPaymentPct));
    out = out.replace(/\{apport\}/g, pct);
  }
  return out;
}

/** A rich block, sanitised; null when emptied by the administrator (EDI-001: the section hides). */
export function richBlock(blocks: Record<string, unknown>, key: string, fields: { downPaymentPct?: string | number } = {}): string | null {
  const v = blocks[key];
  if (typeof v !== 'string') return null;
  const html = sanitizeRich(fillFields(v, fields));
  return plainText(html) === '' ? null : html;
}

export function objBlock<T>(blocks: Record<string, unknown>, key: string, fallback: T): T {
  const v = blocks[key];
  return v && typeof v === 'object' ? (v as T) : fallback;
}

/** ACC-090 — « Être rappelé »: the window of the page, else the contact form with the subject preselected. */
export function callbackHref(settings: PublicSettings, base = ''): string {
  return settings['features.callbackRequest'] ? `${base}?rappel=1` : '/contact?objet=rappel';
}

/** NAV-032 — a title too long is cut at a word, without an ellipsis. */
export function cutAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > 0 ? cut.slice(0, at) : cut.slice(0, max)).trim();
}

/** NAV-032 — « {title} – {site} » for an editorial page, 70 characters at most. */
export function editorialTitle(title: string, settings: PublicSettings): string {
  return cutAtWord(t('ui.editorial.common.seoSuffix', { titre: title, site: settings['seo.siteName'] }), 70);
}

/** NAV-032 — « Le début du texte », 160 characters at most. */
export function description(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  return cutAtWord(text.replace(/\s+/g, ' ').trim(), 155);
}

/** Long date « 9 octobre 2026 » (TRV-020), in the time zone of the site. */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
    .format(new Date(iso))
    .replace(/^1 /, '1er ');
}
