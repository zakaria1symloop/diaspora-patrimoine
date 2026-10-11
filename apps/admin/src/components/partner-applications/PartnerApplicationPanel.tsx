'use client';
// ACP-084 — the panel « Candidature partenaire » of a request coming from the partner sign-up (EP-32): the company, the
// person, the state of the address and of the dossier (sections, supporting files opened through a signed address),
// and the three decisions — « Accepter » (create the promoter or the bank, or « Rattacher à {nom} » when a record
// matches), « Demander un complément », « Refuser » — for whoever holds `lead.process` AND `promoter.write` / `bank.write`
// (the API decides, `can.decide`). Renders nothing for a request that is not an application. Self-contained: the request
// screen only places it.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { PartnerApplicationPanel as Panel } from '@dp/contracts';
import { hasMessage, type MessageKey } from '@dp/i18n';
import { Banner, Button, Icon, Modal, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { isDeliveredPath } from '../shell/menu';
import { TextArea, formStyles as f } from '../shell/forms';
import { catalogueStyles as s, DialogButtons, FailureBanner, useCall } from '../catalogue/parts';
import st from './applications.module.css';

const size = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1e3))} ko`);

export function PartnerApplicationPanel({ leadId, onChanged }: { leadId: string; onChanged?: () => void }) {
  const [data, setData] = useState<Panel | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'info' | 'decline'; attachTo?: { id: string; name: string } } | null>(null);
  const call = useCall();
  const load = useCallback(() => adminCall<Panel>(`/admin/leads/${leadId}/partner-application`).then((r) => r.ok && setData(r.data)), [leadId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!data) return null;
  const open = async (fileId: string) => {
    const r = await call.run(() => adminCall<{ url: string }>(`/admin/leads/${leadId}/partner-application/files/${fileId}`));
    if (r) window.open(r.url, '_blank', 'noopener');
  };
  const done = (next: Panel) => {
    setDialog(null);
    setData(next);
    onChanged?.();
  };
  const recordHref = data.result ? (data.result.type === 'PROMOTER' ? `/promoteurs/${data.result.id}` : `/banques/${data.result.id}`) : null;
  return (
    <Surface title={`${t('ui.admin-promoters.application.title')} · ${t(`ui.admin-promoters.application.kind.${data.kind}`)}`}>
      <div className={st.panel}>
        <FailureBanner failure={call.failure} />
        <div className={st.head}>
          <StatusTag tone={data.status === 'APPROVED' ? 'success' : data.status === 'DECLINED' ? 'neutral' : data.status === 'SUBMITTED' ? 'info' : 'pending'}>{t(`ui.enum.PartnerApplicationStatus.${data.status}` as MessageKey)}</StatusTag>
          <span className={s.sub}>
            {t('ui.admin-promoters.application.email')} {data.emailVerified ? t('ui.admin-promoters.application.emailVerified') : t('ui.admin-promoters.application.emailNotVerified')}
          </span>
        </div>
        {data.result ? (
          <Banner tone="success">
            <p>
              {t('ui.admin-promoters.application.result', { nom: data.result.name })}{' '}
              {recordHref && isDeliveredPath(recordHref) ? (
                <Link href={recordHref} className={s.nameLink}>
                  {t('ui.admin-promoters.application.openRecord')}
                </Link>
              ) : null}
            </p>
          </Banner>
        ) : null}
        <div className={st.grid}>
          <dl className={st.block}>
            <dt>{t('ui.admin-promoters.application.company')}</dt>
            <dd>
              <strong>{data.company.name}</strong>
              <span className={s.sub}>{[data.company.city, data.company.country].filter(Boolean).join(', ')}</span>
              {data.company.registrationNumber ? <span className={s.sub}>{`${t('ui.admin-promoters.application.registration')} : ${data.company.registrationNumber}`}</span> : null}
              {data.company.foundedYear ? <span className={s.sub}>{`${t('ui.admin-promoters.application.founded')} : ${data.company.foundedYear}`}</span> : null}
              {data.company.website ? (
                <a href={data.company.website} target="_blank" rel="noreferrer" className={s.sub}>
                  {data.company.website.replace(/^https?:\/\//, '')}
                </a>
              ) : null}
            </dd>
          </dl>
          <dl className={st.block}>
            <dt>{t('ui.admin-promoters.application.person')}</dt>
            <dd>
              <strong>{[data.person.firstName, data.person.lastName].filter(Boolean).join(' ')}</strong>
              {data.person.role ? <span className={s.sub}>{data.person.role}</span> : null}
              {data.person.email ? <span className={s.sub}>{data.person.email}</span> : null}
              {data.person.phone ? <span className={s.sub}>{data.person.phone}</span> : null}
            </dd>
          </dl>
          <dl className={st.block}>
            <dt>{t('ui.admin-promoters.application.sections')}</dt>
            <dd>
              <ul className={st.sections}>
                {data.sections.map((x) => (
                  <li key={x.key} data-done={x.done ? '1' : undefined}>
                    <Icon name={x.done ? 'status-success' : 'clock'} size={16} />
                    {t(`ui.admin-promoters.application.section.${x.key as 'activity'}`)} · {x.done ? t('ui.admin-promoters.application.done') : t('ui.admin-promoters.application.todo')}
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
        </div>
        {data.answers.length ? (
          <dl className={st.answers}>
            {data.answers.map((a) => (
              <div key={a.label}>
                <dt>{hasMessage(`ui.admin-promoters.application.answer.${a.label}`) ? t(`ui.admin-promoters.application.answer.${a.label}` as MessageKey) : a.label}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {data.files.length ? (
          <ul className={st.files}>
            {data.files.map((file) => (
              <li key={file.id}>
                <Icon name="file" size={16} />
                <span className={s.nameText}>
                  <span>{hasMessage(`ui.admin-promoters.application.file.${file.label}`) ? t(`ui.admin-promoters.application.file.${file.label}` as MessageKey) : file.label}</span>
                  <span className={s.sub}>
                    {file.fileName} · {size(file.sizeBytes)}
                  </span>
                </span>
                <Button variant="tertiary" size="S" icon="external-link" disabled={file.scanStatus !== 'CLEAN'} onClick={() => void open(file.id)}>
                  {t('ui.admin-promoters.application.open')}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {data.can.decide ? (
          <div className={st.actions}>
            {data.matches.length ? <p className={s.sub}>{t('ui.admin-promoters.application.attachHint')}</p> : null}
            <div className={s.toolbar}>
              <Button variant="tool" size="M" icon="check" onClick={() => setDialog({ kind: 'approve' })}>
                {data.matches.length ? t('ui.admin-promoters.application.approveCreate') : t('ui.admin-promoters.application.approve')}
              </Button>
              {data.matches.map((m) => (
                <Button key={m.id} variant="secondary" size="M" onClick={() => setDialog({ kind: 'approve', attachTo: { id: m.id, name: m.name } })}>
                  {t('ui.admin-promoters.application.attachTo', { nom: m.name })}
                </Button>
              ))}
              <Button variant="secondary" size="M" onClick={() => setDialog({ kind: 'info' })}>
                {t('ui.admin-promoters.application.requestInfo')}
              </Button>
              <Button variant="tertiary" size="M" onClick={() => setDialog({ kind: 'decline' })}>
                {t('ui.admin-promoters.application.decline')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {dialog ? <DecisionDialog leadId={leadId} panel={data} kind={dialog.kind} attachTo={dialog.attachTo ?? null} onClose={() => setDialog(null)} onDone={done} /> : null}
    </Surface>
  );
}

function DecisionDialog({ leadId, panel, kind, attachTo, onClose, onDone }: { leadId: string; panel: Panel; kind: 'approve' | 'info' | 'decline'; attachTo: { id: string; name: string } | null; onClose: () => void; onDone: (p: Panel) => void }) {
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const { pending, failure, errors, run } = useCall();
  const nom = panel.company.name;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r =
      kind === 'approve'
        ? await run(() => adminCall<Panel>(`/admin/leads/${leadId}/approve-partner`, { body: { attachToId: attachTo?.id ?? null } }), t('ui.admin-promoters.application.toast.approved'))
        : kind === 'info'
          ? await run(() => adminCall<Panel>(`/admin/leads/${leadId}/request-partner-info`, { body: { message } }), t('ui.admin-promoters.application.toast.info'))
          : await run(() => adminCall<Panel>(`/admin/leads/${leadId}/decline-partner`, { body: { reason, message: message || null } }), t('ui.admin-promoters.application.toast.declined'));
    if (r) onDone(r);
  }
  const title = kind === 'approve' ? t('ui.admin-promoters.application.dialog.approveTitle', { nom }) : kind === 'info' ? t('ui.admin-promoters.application.dialog.infoTitle', { nom }) : t('ui.admin-promoters.application.dialog.declineTitle', { nom });
  return (
    <Modal open onClose={onClose} title={title} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        {kind === 'approve' ? (
          <p>{attachTo ? t('ui.admin-promoters.application.dialog.attachText', { nom: attachTo.name }) : t('ui.admin-promoters.application.dialog.approveText', { type: t(`ui.admin-promoters.application.kind.${panel.kind}`).toLowerCase() })}</p>
        ) : null}
        {kind === 'decline' ? <TextArea label={t('ui.admin-promoters.application.dialog.declineReason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} error={errors.reason} autoFocus /> : null}
        {kind !== 'approve' ? (
          <TextArea
            label={kind === 'info' ? t('ui.admin-promoters.application.dialog.infoMessage') : t('ui.admin-promoters.application.dialog.declineMessage')}
            optional={kind === 'decline'}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={kind === 'info' ? 2000 : 1000}
            rows={4}
            error={errors.message}
            hint={kind === 'info' ? t('ui.admin-promoters.application.dialog.infoHint') : t('ui.admin-promoters.application.dialog.declineHint')}
            autoFocus={kind === 'info'}
          />
        ) : null}
        <DialogButtons
          close={onClose}
          pending={pending}
          danger={kind === 'decline'}
          label={kind === 'approve' ? (attachTo ? t('ui.admin-promoters.application.attachTo', { nom: attachTo.name }) : t('ui.admin-promoters.application.approve')) : kind === 'decline' ? t('ui.admin-promoters.application.decline') : t('ui.admin-promoters.application.dialog.send')}
          disabled={(kind === 'info' && !message.trim()) || (kind === 'decline' && !reason.trim())}
        />
      </form>
    </Modal>
  );
}
