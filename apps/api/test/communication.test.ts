import { describe, expect, it } from 'vitest';
import { toEml } from '../src/communication/mail-provider.js';
import { citedFields, parseTemplate, redactVars, renderTemplate, TemplateSyntaxError } from '../src/communication/template-renderer.js';
import { LEAD_TEMPLATE_SEEDS, typography } from '../src/install/email-templates.js';
import { ackTemplateFor, displayName } from '../src/leads/lead-mail.handler.js';

const site = { siteUrl: 'https://www.example.fr' };

describe('template rendering', () => {
  it('NOT-050 fields are replaced and escaped; conditions with else; a field opening a sentence gets a capital', () => {
    const r = renderTemplate(
      { subject: 'Demande {{lead.reference}}', body: '{{#if property.title}}Bien : {{property.title}}.{{else}}Programme {{program.name}}.{{/if}} {{advisor.firstName}} vous appelle.' },
      { lead: { reference: 'DEM-2026-00187' }, property: { title: 'T3 <Oran> & vue' }, advisor: { firstName: 'votre conseiller' } },
      site,
    );
    expect(r.subject).toBe('Demande DEM-2026-00187');
    expect(r.html).toBe('<p>Bien : T3 &lt;Oran&gt; &amp; vue. Votre conseiller vous appelle.</p>');
    expect(r.text).toBe('Bien : T3 <Oran> & vue. Votre conseiller vous appelle.');
    expect(r.missing).toEqual([]);
  });

  it('NOT-012 a field cited outside any block without value is reported missing; inside a block it is omitted', () => {
    const r = renderTemplate({ subject: 'x', body: 'Réf. {{lead.reference}}{{#if company.phone}} — {{company.phone}}{{/if}}' }, { lead: {} }, site);
    expect(r.missing).toEqual(['lead.reference']);
  });

  it('NOT-061 one button, a site path becomes a full address; links and Markdown; typed HTML shown as text', () => {
    const r = renderTemplate(
      { subject: 's', body: 'Voir **le bien** et [nos programmes](/programmes). <b>non</b>\n\n{{button "Revoir ce bien" property.url}}\n\n- un\n- deux' },
      { property: { url: 'https://www.example.fr/biens/t3-oran' } },
      site,
    );
    expect(r.html).toContain('<strong>le bien</strong>');
    expect(r.html).toContain('<a href="https://www.example.fr/programmes">nos programmes</a>');
    expect(r.html).toContain('&lt;b&gt;non&lt;/b&gt;');
    expect(r.html).toContain('href="https://www.example.fr/biens/t3-oran"');
    expect(r.html).toContain('<ul><li>un</li><li>deux</li></ul>');
    expect(r.text).toContain('Revoir ce bien : https://www.example.fr/biens/t3-oran');
    expect(r.text).toContain('nos programmes (https://www.example.fr/programmes)');
  });

  it('NOT-061 syntax errors are detected (unclosed block, unknown tag)', () => {
    expect(() => parseTemplate('{{#if a}}x')).toThrow(TemplateSyntaxError);
    expect(() => parseTemplate('{{weird tag}}')).toThrow(TemplateSyntaxError);
  });

  it('NOT-002 secret fields are replaced before the e-mail is stored', () => {
    const vars = redactVars({ action: { url: 'https://x/activation/abc', code: '123456' }, lead: { reference: 'R' } }, ['action.url', 'action.code'], (p) => (p.endsWith('code') ? '[code]' : '[lien personnel]'));
    expect(vars).toEqual({ action: { url: '[lien personnel]', code: '[code]' }, lead: { reference: 'R' } });
  });

  it('NOT-060 every delivered lead template parses and renders with its fields; TRV-010 typography on literal text only', () => {
    for (const seed of LEAD_TEMPLATE_SEEDS) {
      expect(() => parseTemplate(typography(seed.body))).not.toThrow();
      expect(citedFields(seed.subject + seed.body).length).toBeGreaterThan(0);
    }
    expect(typography("L'appel viendra du {{company.phone}} : enregistrez-le.")).toBe('L’appel viendra du {{company.phone}} : enregistrez-le.');
    expect(typography('{{button "Activer mon espace" action.url}}')).toBe('{{button "Activer mon espace" action.url}}');
    const interest = LEAD_TEMPLATE_SEEDS.find((s) => s.code === 'C_LEAD_ACK_INTEREST')!;
    const program = renderTemplate(
      { subject: interest.subject, body: interest.body },
      { program: { name: 'Résidence El Yasmine', cityRegion: 'Oran', url: 'https://www.example.fr/programmes/el-yasmine' }, lead: { reference: 'DEM-2026-00187', callbackLabel: 'sous 48 h ouvrées' }, company: { name: 'Diaspora Patrimoine' }, action: {} },
      site,
    );
    expect(program.missing).toEqual([]);
    expect(program.subject).toBe('Votre demande pour Résidence El Yasmine est bien reçue');
    expect(program.text).toContain('Revoir ce programme : https://www.example.fr/programmes/el-yasmine');
  });

  it('NOT-040 acknowledgement of each kind; NOT-050 advisor display name « Amel K. »', () => {
    expect(ackTemplateFor('PROPERTY_INTEREST', 'PROPERTY_INTEREST')).toBe('C_LEAD_ACK_INTEREST');
    expect(ackTemplateFor('CALLBACK_REQUEST', 'CONTACT_MESSAGE')).toBe('C_LEAD_ACK_CALLBACK');
    expect(ackTemplateFor('GUIDED_SEARCH', 'GUIDED_SEARCH')).toBe('C_LEAD_ACK_CALLBACK');
    expect(ackTemplateFor('PARTNER_REQUEST', 'PARTNER_REQUEST')).toBe('P_PARTNER_REQUEST_ACK');
    expect(ackTemplateFor('PARTNER_REQUEST', 'PARTNER_SIGNUP')).toBe('');
    expect(displayName('Amel', 'kaci')).toBe('Amel K.');
  });

  it('ARC-060 the log provider writes a MIME e-mail with UTF-8 subject and both versions', () => {
    const eml = toEml(
      { from: { name: 'Diaspora Patrimoine', address: 'no-reply@x.fr' }, to: 'a@b.fr', subject: 'Votre demande est bien reçue', html: '<p>é</p>', text: 'é', templateCode: 'C_X' },
      'id@log',
      new Date('2026-10-14T10:00:00Z'),
    );
    expect(eml).toContain('Subject: =?UTF-8?B?');
    expect(eml).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(eml).toContain('Content-Type: text/html; charset=UTF-8');
  });
});
