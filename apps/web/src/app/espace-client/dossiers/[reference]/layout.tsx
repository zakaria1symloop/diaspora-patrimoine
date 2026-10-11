// EC-11 — « Mon dossier » (ECL-030): « Dossier {référence} » with its state, the property retained if any (one link
// to its page), the banner of a particular state, the frieze on the whole width, then the tabs (Suivi · Pièces, with
// what is left to deposit). A reference that is not one of the client's dossiers: 404 (ROL-030). Displaying the
// dossier marks its notifications read (NOT-032). Pages of the tabs render below.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { ClientSpaceSummary, DossierView } from '@dp/contracts';
import { Icon } from '@dp/ui';
import type { MessageKey } from '@dp/i18n';
import { t } from '@/lib/i18n';
import { Picture } from '@/components/Picture';
import { spaceGet } from '@/components/client-space/server';
import { SpaceReadFailure } from '@/components/client-space/SpaceRead';
import { PageHeader } from '@/components/client-space/PageHeader';
import { Steps } from '@/components/client-space/Steps';
import { MarkRead } from '@/components/client-space/MarkRead';
import { DossierBannerView } from '@/components/client-space/dashboard/blocks';
import { DossierTabs } from '@/components/client-space/dossier/DossierTabs';
import k from '@/components/client-space/kit/kit.module.css';
import sp from '@/components/client-space/space.module.css';
import s from '@/components/client-space/dossier/dossier.module.css';

const TONE: Record<DossierView['status'], string> = { OPEN: sp.tagInfo!, ON_HOLD: sp.tagWarning!, WON: sp.tagSuccess!, LOST: sp.tagNeutral! };

export default async function DossierLayout({ children, params }: { children: ReactNode; params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const [r, space] = await Promise.all([spaceGet<DossierView>(`/client/dossiers/${encodeURIComponent(reference)}`), spaceGet<ClientSpaceSummary>('/client/space')]);
  if (!r.ok) {
    if (r.status === 404) notFound();
    return <SpaceReadFailure result={r} />;
  }
  const d = r.data;
  const timeZone = space.ok ? space.data.timeZone : 'Europe/Paris';
  const several = space.ok && space.data.dossiers.length > 1;
  const p = d.property;
  const place = p ? [p.city, p.region].filter(Boolean).join(', ') : null;
  const left = d.documents ? d.documents.toProvide + d.documents.toRedo : 0;
  const propertyInner = p ? (
    <>
      <span className={s.thumb}>{p.photo ? <Picture image={p.photo} sizes="96px" alt="" /> : <Icon name="building" size={24} />}</span>
      <span className={s.headProperty}>
        <span className={s.headPropertyTitle}>{p.title}</span>
        {place ? (
          <span className={s.headPropertyPlace}>
            <Icon name="map-pin" size={16} />
            {place}
          </span>
        ) : null}
      </span>
      {p.online ? (
        <span className={k.go} aria-hidden="true">
          <Icon name="chevron-right" size={20} />
        </span>
      ) : null}
    </>
  ) : null;
  return (
    <>
      <MarkRead entityType="Dossier" entityId={d.id} />
      <div className={s.header}>
        <PageHeader
          back={
            several ? (
              <Link href="/espace-client/dossiers">
                <Icon name="arrow-left" size={16} />
                {t('ui.client.dossier.back')}
              </Link>
            ) : undefined
          }
          eyebrow={t('ui.client.dossier.eyebrow')}
          title={
            <span className={s.titleRow}>
              {t('ui.client.dossier.title', { reference: d.reference })}
              <span className={`${sp.tag} ${TONE[d.status]}`}>{t(`ui.enum.DossierStatus.${d.status}` as MessageKey)}</span>
            </span>
          }
          actions={
            p ? (
              p.online ? (
                <Link href={`/biens/${p.slug}`} className={`${s.headCard} ${k.linkCard}`} aria-label={`${t('ui.client.dossier.header.property')} : ${p.title}`}>
                  {propertyInner}
                </Link>
              ) : (
                <span className={s.headCard}>{propertyInner}</span>
              )
            ) : (
              <span className={s.headNone}>
                <Icon name="building" size={20} />
                {t('ui.client.dossier.header.noProperty')}
              </span>
            )
          }
        />
        <DossierBannerView dossier={d} timeZone={timeZone} />
        <div className={`${sp.block} ${s.frieze}`}>
          <Steps steps={d.steps} financing={d.financingRequested} timeZone={timeZone} />
        </div>
      </div>
      <DossierTabs reference={d.reference} documents={d.hasDocumentList} documentsLeft={left} />
      {children}
    </>
  );
}
