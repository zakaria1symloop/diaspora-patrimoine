// TRV-002, TRV-020 — translation with ICU plurals; numbers and dates via Intl, never by hand.
import { IntlMessageFormat } from 'intl-messageformat';
import { messages, type Locale, type MessageKey } from './messages.generated.js';

export type TranslateValues = Record<string, string | number | Date | null | undefined>;
export type Translate = (key: MessageKey, values?: TranslateValues) => string;

const cache = new Map<string, IntlMessageFormat>();

export function createTranslator(locale: Locale = 'fr'): Translate {
  const dict = messages[locale] as Record<string, string>;
  return (key, values) => {
    const source = dict[key] ?? (messages.fr as Record<string, string>)[key];
    if (source === undefined) {
      if (process.env.NODE_ENV !== 'production') throw new Error(`Missing message: ${key}`);
      return '';
    }
    if (!values && !source.includes('{')) return source;
    const id = `${locale}:${key}`;
    let fmt = cache.get(id);
    if (!fmt) {
      fmt = new IntlMessageFormat(source, locale);
      cache.set(id, fmt);
    }
    return String(fmt.format(values as Record<string, string | number | Date>));
  };
}

/** True when a key exists — for keys built from server codes (error reasons, enum values). */
export function hasMessage(key: string, locale: Locale = 'fr'): key is MessageKey {
  return key in (messages[locale] as Record<string, string>);
}
