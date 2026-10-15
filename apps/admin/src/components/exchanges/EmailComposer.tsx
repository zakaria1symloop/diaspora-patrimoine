'use client';
// COM-020 … COM-022, NOT-043, CRM-060 — the window of a hand-written e-mail. Writing on the left (recipient never
// editable, template, subject, body in the restricted Markdown of NOT-061, the template's button kept or not), the
// e-mail in its real layout on the right, read again as one types; on a phone the preview is a tab. The warnings come
// before the sending: an address in error, a client who asked not to be contacted or whose processing is restricted
// (both ask for an explicit « Envoyer quand même »), a doubtful address. « Envoyer » or « Envoyer plus tard ». The text
// being typed survives a reload (TRV-115).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EmailAttachment, EmailComposeContext, EmailPreview, EmailSendResult, EmailWarning } from '@dp/contracts';
import { Banner, Button, Icon, Modal, Skeleton, useToast } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Checkbox, SelectInput, TextArea, TextInput } from '../shell/forms';
import { useShell } from '../shell/ShellContext';
import { AttachmentPicker } from './AttachmentPicker';
import type { ExchangeTarget } from './ExchangeActions';
import s from './exchanges.module.css';

interface Props {
  open: boolean;
  target: ExchangeTarget;
  close: () => void;
  done: () => void;
}

const draftKey = (target: ExchangeTarget) => `dp_email_draft_${target.promoterId ? `p_${target.promoterId}_${target.dossierId ?? ''}` : (target.leadId ?? target.clientId ?? target.dossierId ?? 'x')}`;

function laterDefault(): string {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function EmailComposer({ open, target, close, done }: Props) {
  const { timeZone } = useShell();
  const toast = useToast();
  const [ctx, setCtx] = useState<EmailComposeContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templateCode, setTemplateCode] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeButton, setIncludeButton] = useState(false);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [later, setLater] = useState(false);
  const [files, setFiles] = useState<EmailAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sendKey, setSendKey] = useState('');
  // CTL-006 — the promoter's contact written to (null: his main one) and the one in copy
  const [contactId, setContactId] = useState<string | null>(null);
  const [ccContactId, setCcContactId] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState(laterDefault);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const loaded = useRef(false);

  const query = useMemo(
    () => ({ leadId: target.leadId ?? undefined, clientId: target.leadId ? undefined : (target.clientId ?? undefined), dossierId: target.dossierId ?? undefined, promoterId: target.promoterId ?? undefined, contactId: contactId ?? undefined }),
    [target.leadId, target.clientId, target.dossierId, target.promoterId, contactId],
  );
  const partnerIds = { promoterId: target.promoterId ?? null, contactId: contactId ?? ctx?.contactId ?? null, ccContactId };
  useEffect(() => {
    if (!open) return;
    setContactId(null);
    setCcContactId(null);
  }, [open]);

  // the window opens: its context, then the draft kept in this tab, else the first template
  useEffect(() => {
    if (!open) return;
    loaded.current = false;
    setCtx(null);
    setLoadError(null);
    setErrors({});
    setFailure(null);
    setConfirmed([]);
    setLater(false);
    setFiles([]);
    setUploading(false);
    setSendKey(newIdempotencyKey()); // TRV-091 — « Envoyer » clicked twice sends one e-mail
    setTab('write');
    void adminCall<EmailComposeContext>('/admin/emails/compose', { query }).then((r) => {
      if (!r.ok) return setLoadError(errorText(r));
      setCtx(r.data);
      let draft: { templateCode: string; subject: string; body: string; includeButton: boolean } | null = null;
      try {
        const raw = sessionStorage.getItem(draftKey(target));
        draft = raw ? JSON.parse(raw) : null;
      } catch {
        draft = null;
      }
      const first = r.data.templates.find((x) => x.code !== 'C_MANUAL_BLANK') ?? r.data.templates[0];
      const chosen = draft && r.data.templates.some((x) => x.code === draft!.templateCode) ? draft : first ? { templateCode: first.code, subject: first.subject, body: first.body, includeButton: Boolean(first.button) } : null;
      if (chosen) {
        setTemplateCode(chosen.templateCode);
        setSubject(chosen.subject);
        setBody(chosen.body);
        setIncludeButton(chosen.includeButton);
      }
      loaded.current = true;
    });
  }, [open, query]); // eslint-disable-line react-hooks/exhaustive-deps

  // TRV-115 — the draft
  useEffect(() => {
    if (!open || !loaded.current) return;
    try {
      sessionStorage.setItem(draftKey(target), JSON.stringify({ templateCode, subject, body, includeButton }));
    } catch {
      /* storage unavailable */
    }
  }, [open, templateCode, subject, body, includeButton, target]);

  // the preview, read again 400 ms after the last key
  useEffect(() => {
    if (!open || !ctx || ctx.blocked || !templateCode) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      void adminCall<EmailPreview>('/admin/emails/preview', { body: { leadId: query.leadId ?? null, clientId: query.clientId ?? null, dossierId: query.dossierId ?? null, ...partnerIds, templateCode, subject, body, includeButton }, signal: ctrl.signal }).then((r) => {
        if (r.ok) setPreview(r.data);
      });
    }, 400);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [open, ctx, templateCode, subject, body, includeButton, query]);

  const template = ctx?.templates.find((x) => x.code === templateCode) ?? null;
  const choose = (code: string) => {
    const next = ctx?.templates.find((x) => x.code === code);
    if (!next) return;
    setTemplateCode(code);
    setSubject(next.subject);
    setBody(next.body);
    setIncludeButton(Boolean(next.button));
  };
  const confirmable = (ctx?.warnings ?? []).filter((w) => w.code === 'DO_NOT_CONTACT' || w.code === 'RESTRICTED');
  const blockedByConfirm = confirmable.some((w) => !confirmed.includes(w.code));

  async function send() {
    const local: Record<string, string> = {};
    if (!subject.trim()) local.subject = t('ui.validation.REQUIRED');
    if (!body.trim()) local.body = t('ui.validation.REQUIRED');
    if (later && (!scheduledFor || new Date(scheduledFor).getTime() < Date.now() + 60_000)) local.scheduledFor = t('ui.validation.DATE_NOT_FUTURE');
    if (Object.keys(local).length) {
      setTab('write');
      return setErrors(local);
    }
    setPending(true);
    setErrors({});
    setFailure(null);
    const r = await adminCall<EmailSendResult>('/admin/emails/send', {
      body: { leadId: query.leadId ?? null, clientId: query.clientId ?? null, dossierId: query.dossierId ?? null, ...partnerIds, templateCode, subject, body, includeButton, scheduledFor: later ? new Date(scheduledFor).toISOString() : null, confirmed, attachmentIds: files.map((f) => f.uploadId) },
      idempotencyKey: sendKey,
    });
    setPending(false);
    if (!r.ok) {
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    try {
      sessionStorage.removeItem(draftKey(target));
    } catch {
      /* storage unavailable */
    }
    toast({
      tone: r.data.state === 'FAILED' ? 'error' : undefined,
      text: r.data.state === 'FAILED' ? t('ui.admin-exchanges.email.failed') : r.data.scheduledFor ? t('ui.admin-exchanges.email.scheduled', { date: shortDateTime(r.data.scheduledFor, timeZone) }) : r.data.state === 'SENT' ? t('ui.admin-exchanges.email.sent') : t('ui.admin-exchanges.email.queued'),
    });
    done();
  }

  const warningText = (w: EmailWarning) => {
    switch (w.code) {
      case 'ADDRESS_BOUNCED':
        return t('ui.admin-exchanges.email.warn.bounced', { date: shortDateTime(w.date, timeZone) });
      case 'DO_NOT_CONTACT':
        return w.reason ? t('ui.admin-exchanges.email.warn.doNotContact', { nom: ctx?.recipient?.name ?? '', raison: w.reason }) : t('ui.admin-exchanges.email.warn.doNotContactNoReason', { nom: ctx?.recipient?.name ?? '' });
      case 'RESTRICTED':
        return t('ui.admin-exchanges.email.warn.restricted');
      default:
        return t('ui.admin-exchanges.email.warn.doubtful');
    }
  };

  return (
    <Modal open={open} onClose={close} title={t('ui.admin-exchanges.email.title')} closeLabel={t('ui.common.close')} width={800}>
      {loadError ? (
        <Banner tone="error">{loadError}</Banner>
      ) : !ctx ? (
        <div className={s.loading}>
          <Skeleton width="60%" />
          <Skeleton width="100%" height="8rem" />
        </div>
      ) : ctx.blocked ? (
        <div className={s.blocked}>
          <Icon name="mail" size={24} />
          <p>{ctx.blocked === 'NO_ADDRESS' ? (target.promoterId ? t('ui.admin-exchanges.partner.noContact') : t('ui.admin-exchanges.email.noAddress')) : t('ui.admin-exchanges.email.erased')}</p>
          <Button variant="secondary" size="M" onClick={close}>
            {t('ui.common.close')}
          </Button>
        </div>
      ) : (
        <div className={s.composer}>
          <div className={s.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? s.segOn : s.seg} onClick={() => setTab('write')}>
              {t('ui.admin-exchanges.email.tabWrite')}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? s.segOn : s.seg} onClick={() => setTab('preview')}>
              {t('ui.admin-exchanges.email.tabPreview')}
            </button>
          </div>
          <div className={[s.write, tab === 'preview' && s.hiddenOnPhone].filter(Boolean).join(' ')}>
            {ctx.recipient?.kind === 'PARTNER' && ctx.contacts ? (
              // CTL-006, COM-020 — one of the promoter's contacts; a second one of his may be put in copy
              <div className={s.row}>
                <SelectInput label={t('ui.admin-exchanges.partner.to')} value={ctx.contactId ?? ''} onChange={(e) => setContactId(e.target.value)}>
                  {ctx.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.email}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput label={t('ui.admin-exchanges.partner.cc')} value={ccContactId ?? ''} onChange={(e) => setCcContactId(e.target.value || null)} optional>
                  <option value="">{t('ui.admin-exchanges.partner.noCc')}</option>
                  {ctx.contacts
                    .filter((c) => c.id !== ctx.contactId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.email}
                      </option>
                    ))}
                </SelectInput>
              </div>
            ) : (
              <p className={s.to}>
                <span className={s.toLabel}>{t('ui.admin-exchanges.email.to')}</span>
                <strong>{ctx.recipient?.name ?? ctx.recipient?.address}</strong>
                <span className={s.toAddress}>{ctx.recipient?.address}</span>
              </p>
            )}
            {ctx.warnings.map((w) => (
              <Banner key={w.code} tone={w.code === 'EMAIL_DOUBTFUL' ? 'info' : 'warning'}>
                <p>{warningText(w)}</p>
                {w.code === 'DO_NOT_CONTACT' || w.code === 'RESTRICTED' ? (
                  <Checkbox label={t('ui.admin-exchanges.email.sendAnyway')} checked={confirmed.includes(w.code)} onChange={(v) => setConfirmed((c) => (v ? [...c, w.code] : c.filter((x) => x !== w.code)))} />
                ) : null}
              </Banner>
            ))}
            {failure ? <Banner tone="error">{failure}</Banner> : null}
            <SelectInput label={t('ui.admin-exchanges.email.template')} value={templateCode} onChange={(e) => choose(e.target.value)}>
              {ctx.templates.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </SelectInput>
            <TextInput label={t('ui.admin-exchanges.email.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} error={errors.subject} />
            <TextArea label={t('ui.admin-exchanges.email.body')} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} rows={10} error={errors.body} hint={t('ui.admin-exchanges.email.bodyHint')} />
            {template?.button ? <Checkbox label={t('ui.admin-exchanges.email.keepButton', { label: template.button.label })} checked={includeButton} onChange={setIncludeButton} /> : null}
            <AttachmentPicker base="emails" onChange={setFiles} onBusy={setUploading} />
            <p className={s.signature}>
              <span className={s.toLabel}>{t('ui.admin-exchanges.email.signedBy')}</span>
              {ctx.signature.line}
              {ctx.signature.text ? <span className={s.sigText}>{ctx.signature.text}</span> : null}
            </p>
            <div className={s.sendRow}>
              <Checkbox label={t('ui.admin-exchanges.email.later')} checked={later} onChange={setLater} />
              {later ? <TextInput type="datetime-local" label={t('ui.admin-exchanges.email.when')} value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} error={errors.scheduledFor} /> : null}
            </div>
          </div>
          <div className={[s.preview, tab === 'write' && s.hiddenOnPhone].filter(Boolean).join(' ')} aria-label={t('ui.admin-exchanges.email.tabPreview')}>
            <p className={s.previewHead}>
              <Icon name="eye" size={16} />
              {t('ui.admin-exchanges.email.previewHead', { from: ctx.sender.fromName })}
            </p>
            {preview ? <iframe className={s.frame} title={t('ui.admin-exchanges.email.tabPreview')} srcDoc={preview.html} sandbox="" /> : <Skeleton width="100%" height="20rem" />}
          </div>
          <div className={s.footer}>
            <Button variant="secondary" size="M" onClick={close}>
              {t('ui.common.cancel')}
            </Button>
            <Button variant="tool" size="M" icon="send" pending={pending} disabled={blockedByConfirm || uploading} onClick={() => void send()}>
              {later ? t('ui.admin-exchanges.email.submitLater') : t('ui.admin-exchanges.email.submit')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
