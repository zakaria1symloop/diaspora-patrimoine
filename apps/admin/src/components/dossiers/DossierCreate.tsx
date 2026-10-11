'use client';
// PIP-015 « Ouvrir un dossier à la main » — a page made for the task: on the left the three choices (client, property,
// financing) with their adviser, on the right what will happen, said in words, as the choices are made. The dossier is
// born at INTEREST and passes at once to QUALIFICATION (it has an adviser, CYC-020); the property becomes a CONSIDERED
// property, never a retained one, and the client is told nothing.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ClientPick, DossierCreated, PropertyPick } from '@dp/contracts';
import { Banner, Button, Icon, StatusTag } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { AVAILABILITY_TONE } from '@/lib/tones';
import { PageHeader } from '../shell/Page';
import { useShell } from '../shell/ShellContext';
import { AgentSelect, useAgents } from './dialogs';
import { DossierIllustration } from './Illustration';
import { amount, dossierPath, enumLabel, RecordLink } from './parts';
import s from './dossiers.module.css';

function useSearch<T>(path: string, q: string): T[] | null {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void adminCall<{ data: T[] }>(path, { query: { q: q.trim() || undefined }, signal: ctrl.signal }).then((r) => {
        if (r.ok) setRows(r.data.data);
        else if (!r.aborted) setRows([]);
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [path, q]);
  return rows;
}

export function DossierCreate() {
  const router = useRouter();
  const { shell } = useShell();
  const agents = useAgents(true);
  const [clientQ, setClientQ] = useState('');
  const [propertyQ, setPropertyQ] = useState('');
  const [client, setClient] = useState<ClientPick | null>(null);
  const [property, setProperty] = useState<PropertyPick | null>(null);
  const [financing, setFinancing] = useState<boolean | null>(null);
  const [agentId, setAgentId] = useState(shell.user.id);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<{ text: string; reference?: string; canForce?: boolean } | null>(null);
  const key = useRef(newIdempotencyKey());
  const clients = useSearch<ClientPick>('/admin/dossiers/pickers/clients', clientQ);
  const properties = useSearch<PropertyPick>('/admin/dossiers/pickers/properties', propertyQ);
  const live = client?.liveDossiers ?? [];

  useEffect(() => setProblem(null), [client, property]);

  async function submit(force: boolean) {
    if (!client || financing === null) return;
    setPending(true);
    setProblem(null);
    const r = await adminCall<DossierCreated>('/admin/dossiers', {
      body: { clientId: client.id, propertyId: property?.id ?? null, financingRequested: financing, assignedAgentId: agentId || null, confirmDuplicate: force },
      idempotencyKey: force ? newIdempotencyKey() : key.current,
    });
    setPending(false);
    if (r.ok) return router.push(dossierPath(r.data.reference));
    if (r.aborted) return;
    const reason = r.error?.reason;
    const reference = typeof r.error?.params?.reference === 'string' ? r.error.params.reference : undefined;
    if (reason === 'DOSSIER_CONSIDERS_PROPERTY') return setProblem({ text: t('ui.admin-dossiers.create.considers', { reference: reference ?? '' }), reference, canForce: true });
    if (reason === 'DOSSIER_ALREADY_OPEN_FOR_PROPERTY') return setProblem({ text: t('ui.admin-dossiers.create.alreadyOpen', { reference: reference ?? '' }), reference });
    setProblem({ text: errorText(r) });
  }

  const ready = client !== null && financing !== null && agentId !== '';
  return (
    <div className={s.createPage}>
      <PageHeader title={t('ui.admin-dossiers.create.title')} crumbs={[{ label: t('ui.admin-shell.menu.group.dossiers') }, { label: t('ui.admin-dossiers.title'), href: '/dossiers' }, { label: t('ui.admin-dossiers.create.title') }]} intro={t('ui.admin-dossiers.create.intro')} />
      <div className={s.createGrid}>
        <div className={s.createSteps}>
          {/* 1. Client */}
          <section className={s.step} aria-labelledby="step-client">
            <header className={s.stepHead}>
              <span className={s.stepNum}>1</span>
              <h2 id="step-client" className={s.stepTitle}>{t('ui.admin-dossiers.create.client')}</h2>
            </header>
            {client ? (
              <div className={s.chosen}>
                <Icon name="user" size={24} />
                <div className={s.chosenText}>
                  <strong>{client.name ?? client.email ?? client.phone}</strong>
                  <span className={s.sub}>{[client.email, client.phone, client.countryOfResidence].filter(Boolean).join(' · ')}</span>
                </div>
                <Button variant="secondary" size="S" onClick={() => setClient(null)}>
                  {t('ui.admin-dossiers.create.change')}
                </Button>
              </div>
            ) : (
              <>
                <label className={s.searchField}>
                  <Icon name="search" size={20} />
                  <input value={clientQ} onChange={(e) => setClientQ(e.target.value)} placeholder={t('ui.admin-dossiers.create.clientSearch')} aria-label={t('ui.admin-dossiers.create.clientSearch')} autoFocus />
                </label>
                <ul className={s.pickList} aria-live="polite">
                  {clients === null ? <li className={s.sub}>{t('ui.common.loading')}</li> : null}
                  {clients?.length === 0 ? <li className={s.sub}>{t('ui.admin-dossiers.create.noClient')}</li> : null}
                  {clients?.map((c) => (
                    <li key={c.id}>
                      <button type="button" className={s.pick} onClick={() => setClient(c)}>
                        <span className={s.pickMain}>{c.name ?? c.email ?? c.phone}</span>
                        <span className={s.sub}>{[c.email, c.phone].filter(Boolean).join(' · ')}</span>
                        {c.liveDossiers.length ? <StatusTag tone="info">{t('ui.admin-dossiers.create.liveDossiers', { n: c.liveDossiers.length })}</StatusTag> : null}
                      </button>
                    </li>
                  ))}
                </ul>
                {/* CRM-041 — the creation of a client belongs to the clients' screen, linked once it is delivered */}
                <RecordLink href="/clients/nouveau" className={s.sideLink}>
                  {t('ui.admin-dossiers.create.newClient')}
                </RecordLink>
              </>
            )}
            {live.length ? (
              <p className={s.hintLine}>
                <Icon name="info" size={16} />
                <span>
                  {t('ui.admin-dossiers.create.hasLive')}{' '}
                  {live.map((d, i) => (
                    <span key={d.reference}>
                      {i ? ', ' : ''}
                      <Link href={dossierPath(d.reference)}>{d.reference}</Link> ({enumLabel('DossierStage', d.stage)})
                    </span>
                  ))}
                </span>
              </p>
            ) : null}
          </section>

          {/* 2. Property (optional) */}
          <section className={s.step} aria-labelledby="step-property">
            <header className={s.stepHead}>
              <span className={s.stepNum}>2</span>
              <h2 id="step-property" className={s.stepTitle}>{t('ui.admin-dossiers.create.property')}</h2>
              <span className={s.sub}>{t('ui.common.optional')}</span>
            </header>
            {property ? (
              <div className={s.chosen}>
                <Icon name="home" size={24} />
                <div className={s.chosenText}>
                  <strong>{property.title}</strong>
                  <span className={s.sub}>{[property.reference, property.city, amount(property.priceFrom)].filter(Boolean).join(' · ')}</span>
                </div>
                <Button variant="secondary" size="S" onClick={() => setProperty(null)}>
                  {t('ui.admin-dossiers.create.remove')}
                </Button>
              </div>
            ) : (
              <>
                <label className={s.searchField}>
                  <Icon name="search" size={20} />
                  <input value={propertyQ} onChange={(e) => setPropertyQ(e.target.value)} placeholder={t('ui.admin-dossiers.create.propertySearch')} aria-label={t('ui.admin-dossiers.create.propertySearch')} />
                </label>
                <ul className={s.pickList}>
                  {properties?.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={s.pick} onClick={() => setProperty(p)}>
                        <span className={s.pickMain}>{p.title}</span>
                        <span className={s.sub}>{[p.reference, p.city, amount(p.priceFrom)].filter(Boolean).join(' · ')}</span>
                        <StatusTag tone={AVAILABILITY_TONE[p.availability] ?? 'neutral'}>{enumLabel('Availability', p.availability)}</StatusTag>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* 3. Financing and adviser */}
          <section className={s.step} aria-labelledby="step-financing">
            <header className={s.stepHead}>
              <span className={s.stepNum}>3</span>
              <h2 id="step-financing" className={s.stepTitle}>{t('ui.admin-dossiers.create.financing')}</h2>
            </header>
            <div className={s.choiceRow} role="radiogroup" aria-labelledby="step-financing">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" role="radio" aria-checked={financing === v} className={[s.choice, financing === v && s.choiceOn].filter(Boolean).join(' ')} onClick={() => setFinancing(v)}>
                  <Icon name={v ? 'bank' : 'coins'} size={24} />
                  <span className={s.choiceTitle}>{t(v ? 'ui.admin-dossiers.create.withFinancing' : 'ui.admin-dossiers.create.withoutFinancing')}</span>
                  <span className={s.sub}>{t(v ? 'ui.admin-dossiers.create.withFinancingHint' : 'ui.admin-dossiers.create.withoutFinancingHint')}</span>
                </button>
              ))}
            </div>
            <AgentSelect value={agentId} onChange={setAgentId} agents={agents} />
          </section>
        </div>

        <aside className={s.createAside}>
          <div className={s.preview}>
            <DossierIllustration className={s.previewScene} />
            <h2 className={s.previewTitle}>{t('ui.admin-dossiers.create.previewTitle')}</h2>
            <ol className={s.previewList}>
              <li className={client ? s.previewDone : undefined}>{client ? t('ui.admin-dossiers.create.previewClient', { client: client.name ?? '' }) : t('ui.admin-dossiers.create.previewClientMissing')}</li>
              <li className={s.previewDone}>{t('ui.admin-dossiers.create.previewStage')}</li>
              <li className={property ? s.previewDone : undefined}>{property ? t('ui.admin-dossiers.create.previewProperty', { bien: property.title }) : t('ui.admin-dossiers.create.previewNoProperty')}</li>
              <li className={financing !== null ? s.previewDone : undefined}>{financing === null ? t('ui.admin-dossiers.create.previewFinancingMissing') : t(financing ? 'ui.admin-dossiers.create.previewWith' : 'ui.admin-dossiers.create.previewWithout')}</li>
              <li className={s.previewDone}>{t('ui.admin-dossiers.create.previewSilent')}</li>
            </ol>
            {problem ? (
              <Banner tone={problem.canForce ? 'warning' : 'error'}>
                <p>{problem.text}</p>
                <p className={s.problemActions}>
                  {problem.reference ? <Link href={dossierPath(problem.reference)}>{t('ui.admin-dossiers.create.openExisting', { reference: problem.reference })}</Link> : null}
                  {problem.canForce ? (
                    <Button variant="secondary" size="S" onClick={() => void submit(true)} pending={pending}>
                      {t('ui.admin-dossiers.create.force')}
                    </Button>
                  ) : null}
                </p>
              </Banner>
            ) : null}
            <Button variant="tool" size="M" disabled={!ready} pending={pending} onClick={() => void submit(false)} className={s.previewSubmit}>
              {t('ui.admin-dossiers.create.submit')}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
