// MSG-017, MSG-021, ECL-006 — every « Écrire », « Reprendre mon projet », « Au sujet de ce bien », « En parler à mon
// conseiller » button opens /espace-client/messages: before the messaging (livraison 5), the short form of MSG-021,
// with the same prefilled start of message. The address carries the ORIGIN of the button and non-personal values
// (a property reference, a date), never the text: the form composes the sentence from `ui.client.message.prefill.*`.
import type { ClientMessageOrigin } from '@dp/contracts';

export interface AdvisorLinkInput {
  from?: ClientMessageOrigin;
  /** A property reference (PROPERTY_*): the form shows « Au sujet de {bien} (réf. {référence}) : ». */
  property?: { reference: string; title: string };
  /** SIMULATION — `YYYY-MM-DD`: « Au sujet de ma simulation du {date} : ». */
  date?: string;
  /** The dossier the message is about (preselects « À propos de »). */
  dossier?: string;
}

export function writeToAdvisorHref(input: AdvisorLinkInput = {}): string {
  const q = new URLSearchParams();
  if (input.from) q.set('depuis', input.from);
  if (input.property) {
    q.set('ref', input.property.reference);
    q.set('bien', input.property.title.slice(0, 120));
  }
  if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) q.set('date', input.date);
  if (input.dossier) q.set('dossier', input.dossier);
  const s = q.toString();
  return `/espace-client/messages${s ? `?${s}` : ''}`;
}
