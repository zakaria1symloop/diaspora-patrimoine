'use client';
// CRM-070 — the tab « Compte » of a client record (EA-13): state of the account first (with what it means for the
// adviser and the one gesture it calls for), then « Gérer le compte » (each action with what it does, greyed actions
// are not shown: only what the role may do NOW, BO-047), then the devices and last connections, read only. The team
// never sees nor sets a client's password. Every action confirms in a window (TRV-095); reasons go to the journal.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { ClientAccount } from '@dp/contracts';
import { type MessageKey } from '@dp/i18n';
import { Banner, Button, EmptyState, Icon, Modal, Scene, Skeleton, StatusTag, newUuid, useToast, type IconName } from '@dp/ui';
import { adminCall, type CallResult } from '@/lib/admin-client';
import { errorText, fieldErrors } from '@/lib/errors';
import { DASH, shortDate, shortDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Surface } from '../../shell/Page';
import { useShell } from '../../shell/ShellContext';
import { Checkbox, TextArea, TextInput, formStyles as f } from '../../shell/forms';
import { PreviewButton } from './PreviewButton';
import s from './account.module.css';

export interface AccountTabProps {
  clientId: string;
  /** « Prénom Nom », for the sentences of the confirmations (TRV-095). */
  clientName: string | null;
  /** Called after an action that changes what the header of the record shows (state of the account). */
  onChanged?: () => void;
}

type ActionKey = 'invite' | 'resend' | 'revoke' | 'twoFactor' | 'changeEmail' | 'suspend' | 'reactivate';

const ACTION_PATH: Record<ActionKey, string> = {
  invite: 'invite',
  resend: 'invite',
  revoke: 'revoke-sessions',
  twoFactor: 'disable-two-factor',
  changeEmail: 'change-email',
  suspend: 'suspend',
  reactivate: 'reactivate',
};

const ACTION_ICON: Record<ActionKey, IconName> = {
  invite: 'mail',
  resend: 'mail',
  revoke: 'logout',
  twoFactor: 'shield',
  changeEmail: 'edit',
  suspend: 'lock',
  reactivate: 'check',
};

const TOAST: Record<Exclude<ActionKey, 'revoke'>, string> = { invite: 'invited', resend: 'resent', suspend: 'suspended', reactivate: 'reactivated', twoFactor: 'twoFactor', changeEmail: 'changeEmail' };

const STATE_TONE = { NONE: 'neutral', INVITED: 'pending', ACTIVE: 'success', SUSPENDED: 'error' } as const;

const A = (k: string, p?: Record<string, string | number>) => t(`ui.admin-client-account.${k}` as MessageKey, p);

export function AccountTab({ clientId, clientName, onChanged }: AccountTabProps) {
  const { timeZone } = useShell();
  const [data, setData] = useState<ClientAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionKey | null>(null);
  const name = clientName ?? '';

  const load = useCallback(() => {
    void adminCall<ClientAccount>(`/admin/clients/${clientId}/account`).then((r) => {
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(errorText(r));
    });
  }, [clientId]);
  useEffect(() => load(), [load]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Skeleton width="100%" height="14rem" />;

  const stateLine =
    data.state === 'INVITED'
      ? A('state.INVITED', { date: data.invitedAt ? shortDate(data.invitedAt, timeZone) : DASH })
      : data.state === 'ACTIVE'
        ? data.lastLoginAt
          ? A('state.ACTIVE', { date: shortDateTime(data.lastLoginAt, timeZone) })
          : A('state.ACTIVE_NEVER')
        : A(`state.${data.state}`);

  // the gestures of THIS state, the main one first (one primary action per screen, DSN-050)
  const main: ActionKey | null = data.can.invite ? 'invite' : data.can.resend ? 'resend' : data.can.reactivate ? 'reactivate' : null;
  const others = (['revoke', 'twoFactor', 'changeEmail', 'suspend'] as const).filter((k) => data.can[k === 'revoke' ? 'revokeSessions' : k === 'twoFactor' ? 'disableTwoFactor' : k]);

  const done = (next: ClientAccount, toast: string) => {
    setData(next);
    setDialog(null);
    onChanged?.();
    return toast;
  };

  return (
    <div className={s.tab}>
      <section className={[s.hero, s[`hero${data.state}`]].join(' ')}>
        <Scene name={data.state === 'SUSPENDED' ? 'attente' : data.state === 'NONE' ? 'courrier' : 'acces'} className={s.heroScene} />
        <div className={s.heroBody}>
          <p className={s.heroState}>
            <StatusTag tone={STATE_TONE[data.state]} icon={data.state === 'ACTIVE' ? 'check' : data.state === 'SUSPENDED' ? 'lock' : data.state === 'INVITED' ? 'mail' : 'user'}>
              {stateLine}
            </StatusTag>
          </p>
          <p className={s.heroLead}>{A(`lead.${data.state}`, { nom: name })}</p>
          {data.state === 'NONE' && data.inviteBlocked ? <p className={s.blocked}>{A(`blocked.${data.inviteBlocked}`)}</p> : null}
          {data.suspended ? (
            <div className={s.suspended}>
              <p>
                <strong>{data.suspended.kind ? A(`suspendedKind.${data.suspended.kind}`) : null}</strong>
                {data.suspended.at ? ` · ${A('suspendedSince', { date: shortDate(data.suspended.at, timeZone) })}` : null}
              </p>
              {data.suspended.reason ? <p>{A('suspendedReason', { raison: data.suspended.reason })}</p> : null}
              {data.suspended.kind === 'DELETION_PENDING' ? <p className={s.muted}>{A('deletionNote')}</p> : null}
            </div>
          ) : null}
          <div className={s.heroActions}>
            {main ? (
              <Button variant="tool" size="M" icon={ACTION_ICON[main]} onClick={() => setDialog(main)}>
                {A(`action.${main}`)}
              </Button>
            ) : null}
            {data.state === 'ACTIVE' ? <PreviewButton clientId={clientId} clientName={clientName} accountActive={data.can.preview} /> : null}
          </div>
        </div>
        {data.state !== 'NONE' ? (
          <dl className={s.heroFacts}>
            <div>
              <dt>{A('email')}</dt>
              <dd>{data.email ?? DASH}</dd>
            </div>
            <div>
              <dt>{A('twoFactor')}</dt>
              <dd className={data.twoFactorEnabled ? s.on : undefined}>
                <Icon name={data.twoFactorEnabled ? 'shield' : 'minus'} size={16} />
                {data.twoFactorEnabled ? A('twoFactorOn') : A('twoFactorOff')}
              </dd>
            </div>
            {data.activatedAt ? (
              <div>
                <dt>{A('activatedLabel')}</dt>
                <dd>{shortDate(data.activatedAt, timeZone)}</dd>
              </div>
            ) : null}
            {data.pendingEmail ? <p className={s.pending}>{A('pendingEmail', { email: data.pendingEmail })}</p> : null}
          </dl>
        ) : null}
      </section>

      <div className={s.columns}>
        {others.length ? (
          <Surface title={A('actionsTitle')}>
            <ul className={s.actions}>
              {others.map((k) => (
                <li key={k} className={[s.action, k === 'suspend' && s.actionDanger].filter(Boolean).join(' ')}>
                  <span className={s.actionIcon} aria-hidden="true">
                    <Icon name={ACTION_ICON[k]} size={20} />
                  </span>
                  <span className={s.actionText}>
                    <strong>{A(`action.${k}`)}</strong>
                    <span>{A(`action.${k}Text`)}</span>
                  </span>
                  <Button variant={k === 'suspend' ? 'danger' : 'secondary'} size="S" onClick={() => setDialog(k)}>
                    {A(`action.${k}`)}
                  </Button>
                </li>
              ))}
            </ul>
          </Surface>
        ) : null}

        {data.state !== 'NONE' ? (
          <Surface title={A('devicesTitle')}>
            {data.devices.length ? (
              <ul className={s.devices}>
                {data.devices.map((d, i) => (
                  <li key={`${d.createdAt}-${i}`} className={s.device}>
                    <Icon name="phone" size={20} />
                    <span className={s.deviceText}>
                      <strong>{d.label ?? A('deviceUnknown')}</strong>
                      <span className={s.muted}>
                        {A('lastUsed')} : {shortDateTime(d.lastUsedAt, timeZone)} · {A('since')} {shortDate(d.createdAt, timeZone)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon="phone" title={A('noDevices')} />
            )}
          </Surface>
        ) : null}
      </div>

      <p className={s.password}>
        <Icon name="lock" size={16} />
        {A('password')}
      </p>

      <AccountDialog kind={dialog} clientId={clientId} name={name} account={data} close={() => setDialog(null)} done={done} />
    </div>
  );
}

function AccountDialog({ kind, clientId, name, account, close, done }: { kind: ActionKey | null; clientId: string; name: string; account: ClientAccount; close: () => void; done: (next: ClientAccount, toast: string) => string }) {
  const title = kind ? A(`dialog.${kind}Title`, { nom: name }) : '';
  return (
    <Modal open={kind !== null} onClose={close} title={title} closeLabel={t('ui.common.close')}>
      {kind ? <AccountForm key={kind} kind={kind} clientId={clientId} account={account} close={close} done={done} /> : null}
    </Modal>
  );
}

function AccountForm({ kind, clientId, account, close, done }: { kind: ActionKey; clientId: string; account: ClientAccount; close: () => void; done: (next: ClientAccount, toast: string) => string }) {
  const toast = useToast();
  const [key] = useState(newUuid); // TRV-091: one key per opened window
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const needsReason = kind === 'suspend' || kind === 'reactivate' || kind === 'twoFactor';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (needsReason && !reason.trim()) next.reason = t('ui.validation.REQUIRED');
    if (kind === 'changeEmail' && !email.trim()) next.email = t('ui.validation.REQUIRED');
    if (kind === 'twoFactor' && !checked) next.checked = t('ui.validation.MUST_ACCEPT');
    setErrors(next);
    if (Object.keys(next).length) return;
    const body = needsReason ? { reason } : kind === 'changeEmail' ? { email: email.trim() } : undefined;
    setPending(true);
    setFailure(null);
    const r: CallResult<ClientAccount & { revoked?: number }> = await adminCall(`/admin/clients/${clientId}/${ACTION_PATH[kind]}`, { method: 'POST', body: body ?? {}, idempotencyKey: key });
    setPending(false);
    if (!r.ok) {
      if (r.aborted) return;
      const fields = fieldErrors(r.error);
      if (Object.keys(fields).length) return setErrors(fields);
      return setFailure(errorText(r));
    }
    const text = kind === 'revoke' ? A('toast.revoked', { n: r.data.revoked ?? 0 }) : A(`toast.${TOAST[kind]}`);
    toast({ text: done(r.data, text) });
  }

  let intro: ReactNode = null;
  if (kind === 'invite') intro = A('dialog.inviteText', { email: account.email ?? '' });
  if (kind === 'resend') intro = A('dialog.resendText', { email: account.email ?? '' });
  if (kind === 'revoke') intro = A('dialog.revokeText');
  if (kind === 'suspend') intro = A('dialog.suspendText');
  if (kind === 'reactivate') intro = A('action.reactivateText');
  if (kind === 'twoFactor') intro = A('dialog.twoFactorText');
  if (kind === 'changeEmail') intro = A('dialog.changeEmailText');

  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p className={f.muted}>{intro}</p>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {kind === 'changeEmail' ? (
        <TextInput id="account-email" label={A('dialog.newEmail')} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="off" autoFocus />
      ) : null}
      {kind === 'twoFactor' ? <Checkbox id="account-checked" label={A('dialog.twoFactorChecked')} checked={checked} onChange={setChecked} error={errors.checked} /> : null}
      {needsReason ? <TextArea id="account-reason" label={A('dialog.reason')} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} maxLength={300} rows={3} hint={A('dialog.reasonHint')} autoFocus={kind !== 'twoFactor'} /> : null}
      <div className={`${f.actions} ${f.actionsEnd}`}>
        <Button variant="secondary" size="M" onClick={close}>
          {t('ui.common.cancel')}
        </Button>
        <Button type="submit" variant={kind === 'suspend' || kind === 'twoFactor' ? 'danger' : 'tool'} size="M" pending={pending}>
          {kind === 'invite' || kind === 'resend' || kind === 'changeEmail' || kind === 'suspend' || kind === 'reactivate' || kind === 'revoke' || kind === 'twoFactor' ? A(`action.${kind}`) : A('dialog.confirm')}
        </Button>
      </div>
    </form>
  );
}
