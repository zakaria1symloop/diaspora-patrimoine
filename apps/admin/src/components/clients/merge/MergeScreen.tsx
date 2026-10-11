'use client';
// CRM-080 — « Comparer et fusionner »: one serious task on one screen. The two records side by side over the full width,
// the kept one clearly marked (switchable only when neither has an account), the differing fields first with their
// choice, the identical ones folded, what moves, the protections that apply whatever is chosen, the refusals explained,
// then the irreversible confirmation by typing FUSIONNER (TRV-095). After the merge: the kept record.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MERGE_CONFIRMATION, type MergeField, type MergePreview, type MergeRecordSummary } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, ButtonInner, buttonClass, Icon, Scene, Skeleton, StatusTag, useToast } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { errorText } from '@/lib/errors';
import { money, shortDate, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { CLIENT_STATUS_TONE } from '@/lib/tones';
import { PageHeader } from '../../shell/Page';
import { useShell } from '../../shell/ShellContext';
import { countryName } from '../client-parts';
import s from './merge.module.css';

function valueText(f: MergeField, v: unknown): string {
  if (v === null || v === undefined) return '—';
  switch (f.kind) {
    case 'enum': {
      const key = `ui.enum.${f.enumName}.${String(v)}`;
      return hasMessage(key) ? t(key as MessageKey) : String(v);
    }
    case 'country':
      return countryName(String(v));
    case 'countries':
      return (v as string[]).map(countryName).join(', ');
    case 'types':
      return (v as string[]).map((x) => (hasMessage(`ui.enum.PropertyType.${x}`) ? t(`ui.enum.PropertyType.${x}` as MessageKey) : x)).join(', ');
    case 'regions':
      return t('ui.admin-client-merge.regions', { n: (v as string[]).length });
    case 'date':
      return shortDay(String(v));
    case 'money': {
      const m = v as { amount?: string; amounts?: (string | null)[]; currency: string | null };
      if (m.amounts) return m.amounts.map((a) => (a && m.currency ? money(a, m.currency) : '—')).join(' · ');
      return m.amount && m.currency ? money(m.amount, m.currency) : '—';
    }
    case 'bool':
      return v ? t('ui.common.yes') : t('ui.common.no');
    default:
      return String(v);
  }
}

function RecordCard({ r, role, timeZone }: { r: MergeRecordSummary; role: 'keep' | 'absorbed'; timeZone: string }) {
  return (
    <div className={[s.record, role === 'keep' ? s.recordKeep : s.recordAbsorbed].join(' ')}>
      <p className={s.recordRole}>
        <Icon name={role === 'keep' ? 'check' : 'arrow-right'} size={16} />
        {role === 'keep' ? t('ui.admin-client-merge.keep') : t('ui.admin-client-merge.absorbed')}
      </p>
      <h2 className={s.recordName}>{r.name ?? '—'}</h2>
      <p className={s.recordLine}>
        <StatusTag tone={CLIENT_STATUS_TONE[r.status] ?? 'neutral'}>{t(`ui.enum.ClientStatus.${r.status}` as MessageKey)}</StatusTag>
        {r.hasAccount ? <StatusTag tone="success" icon="user">{t('ui.admin-client-merge.hasAccount')}</StatusTag> : null}
      </p>
      <dl className={s.recordFacts}>
        <div>
          <dt>{t('ui.admin-client-merge.email')}</dt>
          <dd>{r.email ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('ui.admin-client-merge.phone')}</dt>
          <dd>{r.phone ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('ui.admin-client-merge.created')}</dt>
          <dd>{shortDate(r.createdAt, timeZone)}</dd>
        </div>
        <div>
          <dt>{t('ui.admin-client-merge.agent')}</dt>
          <dd>{r.agentName ?? '—'}</dd>
        </div>
      </dl>
      <p className={s.recordCounts}>{t('ui.admin-client-merge.counts', { d: r.counts.leads, o: r.counts.dossiers, s: r.counts.simulations })}</p>
      <Link href={`/clients/${r.id}`} className={s.recordLink} target="_blank">
        {t('ui.admin-client-merge.openRecord')}
        <Icon name="external-link" size={16} />
      </Link>
    </div>
  );
}

export function MergeScreen({ clientId, otherId }: { clientId: string; otherId: string }) {
  const { timeZone } = useShell();
  const router = useRouter();
  const toast = useToast();
  const [keepChoice, setKeepChoice] = useState<string | null>(null);
  const [data, setData] = useState<MergePreview | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, 'KEEP' | 'OTHER'>>({});
  const [showSame, setShowSame] = useState(false);
  const [word, setWord] = useState('');
  const [pending, setPending] = useState(false);

  const load = useCallback(() => {
    setData(null);
    void adminCall<MergePreview>(`/admin/clients/${clientId}/merge-preview`, { query: { with: otherId, keep: keepChoice ?? undefined } }).then((r) => {
      if (r.ok) {
        setData(r.data);
        setChoices({});
      } else setFailure(errorText(r));
    });
  }, [clientId, otherId, keepChoice]);
  useEffect(() => load(), [load]);

  const differing = useMemo(() => data?.fields.filter((f) => f.differs) ?? [], [data]);
  const same = useMemo(() => data?.fields.filter((f) => !f.differs && (f.keep !== null || f.other !== null)) ?? [], [data]);

  const submit = async () => {
    if (!data) return;
    setPending(true);
    const r = await adminCall<{ id: string }>(`/admin/clients/${clientId}/merge`, {
      body: { otherId, keepId: data.keep.id, choices, confirmation: word, versions: { keep: data.keep.version, absorbed: data.absorbed.version } },
    });
    setPending(false);
    if (!r.ok) return setFailure(errorText(r));
    toast({ text: t('ui.admin-client-merge.done') });
    router.push(`/clients/${r.data.id}`);
  };

  return (
    <div className={s.page}>
      <PageHeader
        title={t('ui.admin-client-merge.title')}
        crumbs={[{ label: t('ui.admin-shell.menu.group.crm') }, { label: t('ui.admin-clients.title'), href: '/clients' }, { label: t('ui.admin-client-merge.crumb') }]}
        intro={t('ui.admin-client-merge.intro')}
      />
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {!data ? (
        <Skeleton width="100%" height="20rem" />
      ) : (
        <>
          <div className={s.pair}>
            <RecordCard r={data.keep} role="keep" timeZone={timeZone} />
            <div className={s.arrow} aria-hidden="true">
              <Icon name="arrow-left" size={24} />
            </div>
            <RecordCard r={data.absorbed} role="absorbed" timeZone={timeZone} />
          </div>
          <p className={s.rule}>
            {data.keepRule === 'ACCOUNT' ? t('ui.admin-client-merge.ruleAccount') : t('ui.admin-client-merge.ruleChosen')}{' '}
            {data.keepRule === 'CHOSEN' && !data.refusal ? (
              <button type="button" className={s.linkButton} onClick={() => setKeepChoice(data.absorbed.id)}>
                {t('ui.admin-client-merge.swap')}
              </button>
            ) : null}
          </p>

          {data.refusal ? (
            <div className={s.refusal}>
              <Scene name="perdu" className={s.scene} />
              <div>
                <p className={s.refusalTitle}>{t('ui.admin-client-merge.refusalTitle')}</p>
                <p>{t(`ui.admin-client-merge.refusal.${data.refusal}` as MessageKey, { reference: data.refusalDetail?.join(', ') ?? '' })}</p>
                <Link href={`/clients/${clientId}`} className={buttonClass('secondary', 'M')}>
                  <ButtonInner size="M">{t('ui.admin-client-merge.back')}</ButtonInner>
                </Link>
              </div>
            </div>
          ) : (
            <div className={s.columns}>
              <section className={s.section}>
                <h2 className={s.sectionTitle}>{differing.length ? t('ui.admin-client-merge.differing', { n: differing.length }) : t('ui.admin-client-merge.noDiffering')}</h2>
                {differing.map((f) => {
                  const side = choices[f.key] ?? f.defaultSide;
                  return (
                    <div key={f.key} className={s.choice}>
                      <span className={s.choiceLabel}>{t(`ui.admin-client-merge.field.${f.key}` as MessageKey)}</span>
                      {(['KEEP', 'OTHER'] as const).map((sd) => (
                        <button key={sd} type="button" aria-pressed={side === sd} className={[s.choiceValue, side === sd && s.choiceOn].filter(Boolean).join(' ')} onClick={() => setChoices((c) => ({ ...c, [f.key]: sd }))}>
                          <Icon name={side === sd ? 'check' : 'arrow-right'} size={16} />
                          {valueText(f, sd === 'KEEP' ? f.keep : f.other)}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {same.length ? (
                  <details className={s.same} open={showSame} onToggle={(e) => setShowSame((e.target as HTMLDetailsElement).open)}>
                    <summary>{t('ui.admin-client-merge.same', { n: same.length })}</summary>
                    <dl className={s.sameList}>
                      {same.map((f) => (
                        <div key={f.key}>
                          <dt>{t(`ui.admin-client-merge.field.${f.key}` as MessageKey)}</dt>
                          <dd>{f.withheld ? t('ui.admin-clients.reserved') : valueText(f, f.keep ?? f.other)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </section>

              <aside className={s.side}>
                <section className={s.panel}>
                  <h2 className={s.sectionTitle}>{t('ui.admin-client-merge.movesTitle')}</h2>
                  <ul className={s.moves}>
                    {Object.entries(data.moves).map(([table, n]) => (
                      <li key={table}>
                        <span>{hasMessage(`ui.admin-client-merge.table.${table}`) ? t(`ui.admin-client-merge.table.${table}` as MessageKey) : table}</span>
                        <strong>{n}</strong>
                      </li>
                    ))}
                    {!Object.keys(data.moves).length ? <li className={s.muted}>{t('ui.admin-client-merge.nothingMoves')}</li> : null}
                  </ul>
                  {data.absorbedEmail ? <p className={s.muted}>{data.absorbedEmail.becomes === 'ALTERNATE' ? t('ui.admin-client-merge.emailAlternate', { email: data.absorbedEmail.address }) : t('ui.admin-client-merge.emailMain', { email: data.absorbedEmail.address })}</p> : null}
                </section>
                <section className={s.panel}>
                  <h2 className={s.sectionTitle}>{t('ui.admin-client-merge.protectionsTitle')}</h2>
                  <ul className={s.protections}>
                    {data.protections.map((p) => (
                      <li key={p}>
                        <Icon name="shield" size={16} />
                        {t(`ui.admin-client-merge.protection.${p}` as MessageKey)}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className={[s.panel, s.danger].join(' ')}>
                  <h2 className={s.sectionTitle}>{t('ui.admin-client-merge.confirmTitle')}</h2>
                  <p>{t('ui.admin-client-merge.confirmText', { nom: data.absorbed.name ?? '' })}</p>
                  <label className={s.confirmLabel}>
                    {t('ui.admin-client-merge.confirmLabel', { mot: MERGE_CONFIRMATION })}
                    <input className={s.confirmInput} value={word} onChange={(e) => setWord(e.target.value.toUpperCase())} autoComplete="off" spellCheck={false} />
                  </label>
                  <Button variant="danger" size="M" fullWidth pending={pending} disabled={word !== MERGE_CONFIRMATION} onClick={() => void submit()}>
                    {t('ui.admin-client-merge.submit')}
                  </Button>
                </section>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
