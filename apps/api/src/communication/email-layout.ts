// NOT-004 (EM-01), NOT-006 — the common wrapper added at sending time: header with the brand, title (= subject),
// greeting, body, signature, footer (company, legal name and address when set, contact, reason for sending).
// Kept minimal: 600 px, readable without images, plain colours that survive dark mode. Texts come from @dp/i18n.
import { createTranslator } from '@dp/i18n';

export interface LayoutInput {
  subject: string;
  preheader: string | null;
  contentHtml: string;
  contentText: string;
  /** First name for « Bonjour {prénom}, »; null → « Bonjour, ». */
  greetingName: string | null;
  /** NOT-006 — « Amel K. — Diaspora Patrimoine », else « L'équipe Diaspora Patrimoine ». Several lines for a hand-written e-mail (COM-021). */
  signature: string;
  footer: {
    companyName: string;
    legalName?: string;
    address?: string;
    phone?: string;
    email?: string;
    /** `notice.emailReason.*` (07-design/03 § 7). */
    reason: string;
    /** NOT-004 — « Gérer mes préférences » for an e-mail that is not mandatory (or the alert's own link, NOT-022). */
    links?: { label: string; href: string }[];
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function greetingLine(name: string | null, locale: 'fr' = 'fr'): string {
  const t = createTranslator(locale);
  return name ? t('ui.email.greeting', { firstName: name }) : t('ui.email.greetingNoName');
}

export function teamSignature(companyName: string, locale: 'fr' = 'fr'): string {
  return createTranslator(locale)('ui.email.signatureTeam', { company: companyName });
}

export function emailReason(audience: 'CLIENT' | 'STAFF' | 'PARTNER', category: string, companyName: string, code: string, locale: 'fr' = 'fr'): string {
  const t = createTranslator(locale);
  if (audience === 'STAFF') return t('ui.notice.emailReason.staff', { societe: companyName });
  if (audience === 'PARTNER') {
    return code.startsWith('P_PARTNER_') && code !== 'P_PARTNER_REQUEST_ACK'
      ? t('ui.notice.emailReason.partnerApplicant')
      : t('ui.notice.emailReason.partner', { societe: companyName });
  }
  return category === 'ACCOUNT' ? t('ui.notice.emailReason.account', { societe: companyName }) : t('ui.notice.emailReason.client', { societe: companyName });
}

export function wrapEmail(input: LayoutInput): { html: string; text: string } {
  const greeting = greetingLine(input.greetingName);
  const f = input.footer;
  const footerLines = [f.companyName, f.legalName, f.address, [f.phone, f.email].filter(Boolean).join(' · ')].filter((l): l is string => Boolean(l));
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"><title>${esc(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(input.preheader)}</div>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px">
<tr><td style="padding:24px 32px 8px;font-size:18px;font-weight:700;color:#1f4d3a">${esc(f.companyName)}</td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="font-size:20px;line-height:1.3;margin:8px 0 16px">${esc(input.subject)}</h1></td></tr>
<tr><td style="padding:0 32px;font-size:15px;line-height:1.6">
<p>${esc(greeting)}</p>
${input.contentHtml}
<p style="margin-top:24px">${esc(input.signature).replace(/\n/g, '<br>')}</p>
</td></tr>
<tr><td style="padding:24px 32px;font-size:12px;line-height:1.5;color:#5f5f5f;border-top:1px solid #e6e1d6">
${footerLines.map((l) => `${esc(l)}<br>`).join('\n')}
<span>${esc(f.reason)}</span>
${(f.links ?? []).map((l) => `<br><a href="${esc(l.href)}" style="color:#5f5f5f">${esc(l.label)}</a>`).join('')}
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = [greeting, '', input.contentText, '', input.signature, '', '—', ...footerLines, f.reason, ...(f.links ?? []).map((l) => `${l.label} : ${l.href}`)].join('\n');
  return { html, text };
}
