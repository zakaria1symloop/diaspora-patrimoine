'use client';
// TRV-084, TRV-111 — 500: « Réessayer », a way to reach us, the error identifier to give to support.
import { useEffect, useState } from 'react';
import { Button } from '@dp/ui';
import { ErrorPage } from '@/components/ErrorPage';
import { formatPhone } from '@/lib/contact';
import { t } from '@/lib/i18n';
import s from './error.module.css';

interface Contact {
  phone: string;
  email: string;
}

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    fetch('/api/v1/public/settings/public', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Record<string, string> | null) => b && setContact({ phone: b['contact.phone'] ?? '', email: b['contact.email'] ?? '' }))
      .catch(() => undefined);
  }, []);

  const id = error.digest ?? null;

  return (
    <ErrorPage title={t('ui.pages.error.server.title')}>
      <div>
        <Button variant="primary" size="L" chevron onClick={reset}>
          {t('ui.pages.error.server.retry')}
        </Button>
      </div>
      {contact?.phone ? (
        <p>
          <a href={`tel:${contact.phone}`} className={s.link}>
            {t('ui.pages.error.server.contactPhone', { telephone: formatPhone(contact.phone) })}
          </a>
        </p>
      ) : null}
      {contact?.email ? (
        <p>
          <a href={`mailto:${contact.email}`} className={s.link}>
            {t('ui.pages.error.server.contactEmail', { email: contact.email })}
          </a>
        </p>
      ) : null}
      {id ? <p className={s.code}>{t('ui.pages.error.server.code', { identifiant: id })}</p> : null}
    </ErrorPage>
  );
}
