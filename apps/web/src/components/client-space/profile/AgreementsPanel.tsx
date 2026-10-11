'use client';
// EC-53 « Mes accords » (PRO-051): terms and privacy policy (date and version, link to the text), the « Actualités »
// switch (it IS the consent, PRO-030: each change writes a `Consent` row), the transmission agreement (state; « Donner
// mon accord » is the box of DOS-040 in the « Pièces » tab; « Retirer mon accord » after confirmation), the agreements
// confirmed for a co-borrower or a guarantor. Export and deletion of the account come later (package 6.5, ECL-006).
import Link from 'next/link';
import { useState } from 'react';
import type { ClientAgreements } from '@dp/contracts';
import { Button, Icon, ButtonInner, buttonClass } from '@dp/ui';
import k from '../kit/kit.module.css';
import { apiCall } from '@/lib/auth-client';
import { showToast } from '@/lib/discovery';
import { t } from '@/lib/i18n';
import { Banner, errorMessage } from '@/components/auth/kit';
import { documentsPath } from '../menu';
import { writeToAdvisorHref } from '../advisor-link';
import { longDate } from '../texts';
import s from './profile.module.css';

export function AgreementsPanel({ initial, timeZone }: { initial: ClientAgreements; timeZone: string }) {
  const [a, setA] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const date = (iso: string | null) => (iso ? longDate(iso, timeZone) : '');

  async function change(body: { type: 'MARKETING_EMAIL'; granted: boolean } | { type: 'DATA_SHARING_PARTNERS'; granted: false }, done: string) {
    setPending(body.type);
    setFailure(null);
    const res = await apiCall<ClientAgreements>('/client/me/consents', { method: 'POST', body, retryOnAuth: true });
    setPending(null);
    if (!res.ok) return setFailure(errorMessage(res.error, { offline: res.offline, status: res.status }));
    setA(res.data);
    setConfirm(false);
    showToast({ message: done });
  }

  const tr = a.transmission;
  const trText =
    tr.state === 'NOT_GIVEN'
      ? t('ui.client.privacy.transmission.NOT_GIVEN')
      : tr.state === 'RECORDED' || tr.state === 'WITHDRAWAL_RECORDED'
        ? t(`ui.client.privacy.transmission.${tr.state}`, { conseiller: tr.recordedBy ?? t('ui.client.nextStep.advisorFallback'), date: date(tr.at) })
        : t(`ui.client.privacy.transmission.${tr.state}`, { date: date(tr.at) });
  const given = tr.state === 'GIVEN' || tr.state === 'RECORDED';

  return (
    <div className={s.profile}>
      {failure ? <Banner tone="error">{failure}</Banner> : null}

      <section className={s.section} aria-labelledby="accords-legaux">
        <h2 id="accords-legaux" className={s.sectionTitle}>
          {t('ui.client.privacy.legal.TERMS_OF_USE')} · {t('ui.client.privacy.legal.PRIVACY_POLICY')}
        </h2>
        <ul role="list" className={s.people}>
          {a.legal.map((l) => {
            const policy = l.type === 'PRIVACY_POLICY';
            const text = !l.acceptedAt
              ? t('ui.client.privacy.legal.notYet')
              : l.version
                ? t(policy ? 'ui.client.privacy.legal.acceptedPolicy' : 'ui.client.privacy.legal.accepted', { date: date(l.acceptedAt), version: l.version })
                : t(policy ? 'ui.client.privacy.legal.acceptedPolicyNoVersion' : 'ui.client.privacy.legal.acceptedNoVersion', { date: date(l.acceptedAt) });
            return (
              <li key={l.type} className={s.person}>
                <span className={s.personIcon} aria-hidden="true">
                  <Icon name="file" size={20} />
                </span>
                <span className={s.personText}>
                  <span className={s.personName}>{t(`ui.client.privacy.legal.${l.type}`)}</span>
                  <span className={s.help}>{text}</span>
                </span>
                <Link href={l.href} className={k.quiet} aria-label={`${t('ui.client.privacy.legal.read')} : ${t(`ui.client.privacy.legal.${l.type}`)}`}>
                  <Icon name="eye" size={20} />
                  {t('ui.client.privacy.legal.read')}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={s.section} aria-labelledby="accord-actualites">
        <div className={s.switchRow}>
          <div>
            <h2 id="accord-actualites" className={s.sectionTitle}>
              {t('ui.client.privacy.marketing.title')}
            </h2>
            <p className={s.help}>{t('ui.client.privacy.marketing.text')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={a.marketing.granted}
            aria-labelledby="accord-actualites"
            className={`${s.switch} ${a.marketing.granted ? s.switchOn : ''}`}
            disabled={pending === 'MARKETING_EMAIL'}
            onClick={() => void change({ type: 'MARKETING_EMAIL', granted: !a.marketing.granted }, t('ui.client.privacy.marketing.on'))}
          >
            <span className={s.switchKnob} />
          </button>
        </div>
      </section>

      <section className={s.section} aria-labelledby="accord-transmission">
        <h2 id="accord-transmission" className={s.sectionTitle}>
          {t('ui.client.privacy.transmission.title')}
        </h2>
        <p className={s.help}>{t('ui.client.privacy.transmission.text')}</p>
        <p className={`${s.state} ${given ? s.stateOn : ''}`}>{trText}</p>
        {given ? (
          confirm ? (
            <div className={s.inlinePanel} role="alertdialog" aria-labelledby="retrait-titre" aria-describedby="retrait-texte">
              <p id="retrait-titre" className={s.panelTitle}>
                {t('ui.client.privacy.transmission.confirmTitle')}
              </p>
              <p id="retrait-texte">{t('ui.client.privacy.transmission.confirmText')}</p>
              <div className={s.panelActions}>
                <Button variant="danger" size="M" pending={pending === 'DATA_SHARING_PARTNERS'} onClick={() => void change({ type: 'DATA_SHARING_PARTNERS', granted: false }, t('ui.client.privacy.transmission.done'))}>
                  {t('ui.client.privacy.transmission.confirm')}
                </Button>
                <Button variant="tertiary" size="M" onClick={() => setConfirm(false)} autoFocus>
                  {t('ui.client.privacy.transmission.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="secondary" size="M" onClick={() => setConfirm(true)}>
                {t('ui.client.privacy.transmission.withdraw')}
              </Button>
            </div>
          )
        ) : a.documentsDossierReference ? (
          <div>
            <Link href={documentsPath(a.documentsDossierReference)} className={buttonClass('tool', 'M')}>
              <ButtonInner size="M" chevron>
                {t('ui.client.privacy.transmission.give')}
              </ButtonInner>
            </Link>
          </div>
        ) : (
          <p className={s.help}>{t('ui.client.privacy.transmission.giveHint')}</p>
        )}
      </section>

      {a.parties.length ? (
        <section className={s.section} aria-labelledby="accord-emprunteurs">
          <h2 id="accord-emprunteurs" className={s.sectionTitle}>
            {t('ui.client.privacy.parties.title')}
          </h2>
          <ul role="list" className={s.plainList}>
            {a.parties.map((p) => (
              <li key={`${p.dossierReference}-${p.firstName}-${p.at}`}>{t('ui.client.privacy.parties.line', { prenom: p.firstName ?? '', date: date(p.at) })}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={s.section} aria-labelledby="mes-donnees">
        <h2 id="mes-donnees" className={s.sectionTitle}>
          {t('ui.client.privacy.data.title')}
        </h2>
        <p className={s.help}>{t('ui.client.privacy.later')}</p>
        <div className={s.panelActions}>
          <Link href={writeToAdvisorHref({ from: 'ADVISOR' })} className={buttonClass('secondary', 'M')}>
            <ButtonInner size="M" icon="chat">
              {t('ui.common.writeToAdvisor')}
            </ButtonInner>
          </Link>
          <Link href="/confidentialite" className={k.quiet}>
            <Icon name="shield" size={20} />
            {t('ui.client.privacy.policy')}
          </Link>
        </div>
      </section>
    </div>
  );
}
