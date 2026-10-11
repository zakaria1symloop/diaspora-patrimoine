'use client';
// EA-96 — the windows of the team's actions (ADM-030, ADM-032). A destructive action, or one hard to undo, asks for a
// confirmation that NAMES the account and says what will happen (TRV-095). Changing a role and resetting a second
// factor ask for a recent password: the shell opens « Confirmez votre mot de passe » and replays the call (BO-005).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { staffInviteSchema, type StaffRole, type TeamMember } from '@dp/contracts';
import { Banner, Button, ErrorSummary, Modal, useToast } from '@dp/ui';
import { adminCall, newIdempotencyKey, type CallResult } from '@/lib/admin-client';
import { checkSchema, errorText, fieldErrors } from '@/lib/errors';
import { memberName } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { FailureDetails } from '../shell/ReadFailure';

export type TeamDialog =
  | { kind: 'invite' }
  | { kind: 'edit'; member: TeamMember }
  | { kind: 'role'; member: TeamMember }
  | { kind: 'suspend'; member: TeamMember }
  | { kind: 'reactivate'; member: TeamMember }
  | { kind: 'resend'; member: TeamMember }
  | { kind: 'cancel'; member: TeamMember }
  | { kind: 'reset'; member: TeamMember };

interface Props {
  dialog: TeamDialog | null;
  roles: StaffRole[];
  close: () => void;
  done: () => void;
}

export function TeamDialogs({ dialog, roles, close, done }: Props) {
  const title = dialog ? t(`ui.admin-team.dialog.${dialog.kind}.title`) : '';
  return (
    <Modal open={dialog !== null} onClose={close} title={title} closeLabel={t('ui.common.close')} width={dialog?.kind === 'invite' ? 560 : 480}>
      {dialog?.kind === 'invite' ? <InviteForm roles={roles} close={close} done={done} /> : null}
      {dialog?.kind === 'edit' ? <EditForm member={dialog.member} close={close} done={done} /> : null}
      {dialog?.kind === 'role' ? <RoleForm member={dialog.member} roles={roles} close={close} done={done} /> : null}
      {dialog?.kind === 'suspend' ? <ReasonForm kind="suspend" member={dialog.member} close={close} done={done} /> : null}
      {dialog?.kind === 'reset' ? <ReasonForm kind="reset" member={dialog.member} close={close} done={done} /> : null}
      {dialog?.kind === 'reactivate' || dialog?.kind === 'resend' || dialog?.kind === 'cancel' ? <ConfirmForm kind={dialog.kind} member={dialog.member} close={close} done={done} /> : null}
    </Modal>
  );
}

/** What every window of the team shares: the call, its pending state, its error above the form (TRV-114). */
function useAction(done: () => void, success: string) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Extract<CallResult<unknown>, { ok: false }> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (call: () => Promise<CallResult<unknown>>) => {
    setPending(true);
    setFailure(null);
    setErrors({});
    const r = await call();
    setPending(false);
    if (r.ok) {
      toast({ text: success });
      done();
      return;
    }
    if (r.aborted) return;
    const fields = fieldErrors(r.error);
    if (Object.keys(fields).length) setErrors(fields);
    else setFailure(r);
  };
  const banner = failure ? (
    <Banner tone="error">
      <p>{errorText(failure)}</p>
      <FailureDetails failure={failure} />
    </Banner>
  ) : null;
  return { pending, errors, setErrors, run, banner };
}

function Buttons({ close, pending, label, danger }: { close: () => void; pending: boolean; label: string; danger?: boolean }) {
  return (
    <div className={`${f.actions} ${f.actionsEnd}`}>
      <Button variant="secondary" size="M" onClick={close}>
        {t('ui.common.cancel')}
      </Button>
      <Button type="submit" variant={danger ? 'danger' : 'tool'} size="M" pending={pending}>
        {label}
      </Button>
    </div>
  );
}

function RoleSelect({ value, onChange, roles, error, id }: { value: string; onChange: (v: string) => void; roles: StaffRole[]; error?: string; id?: string }) {
  return (
    <SelectInput id={id} label={t('ui.admin-team.field.role')} value={value} onChange={(e) => onChange(e.target.value)} error={error} hint={value ? t(`ui.admin-team.roleHelp.${value as StaffRole}`) : undefined}>
      <option value="" disabled>
        {t('ui.admin-team.field.rolePlaceholder')}
      </option>
      {roles.map((r) => (
        <option key={r} value={r}>
          {t(`ui.enum.MembershipRole.${r}`)}
        </option>
      ))}
    </SelectInput>
  );
}

// ─── Inviter (ADM-030) ──────────────────────────────────────────────────────

function InviteForm({ roles, close, done }: { roles: StaffRole[]; close: () => void; done: () => void }) {
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', role: '', jobTitle: '' });
  const [key] = useState(newIdempotencyKey); // TRV-091: generated when the form opens
  const { pending, errors, setErrors, run, banner } = useAction(done, t('ui.admin-team.toast.invited'));
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkSchema(staffInviteSchema, values);
    if (!checked.ok) return setErrors(checked.errors);
    void run(() => adminCall('/admin/users/invite', { body: values, idempotencyKey: key }));
  }
  const labels: Record<string, string> = { firstName: t('ui.admin-team.field.firstName'), lastName: t('ui.admin-team.field.lastName'), email: t('ui.admin-team.field.email'), role: t('ui.admin-team.field.role'), jobTitle: t('ui.admin-team.field.jobTitle') };
  return (
    <form className={f.form} onSubmit={submit} noValidate>
      <p className={f.muted}>{t('ui.admin-team.invite.intro')}</p>
      {banner}
      <ErrorSummary title={t('ui.common.error.summary', { n: Object.keys(errors).length })} items={Object.entries(errors).map(([field, message]) => ({ fieldId: `invite-${field}`, label: labels[field] ?? field, message }))} />
      <div className={f.row}>
        <TextInput id="invite-firstName" label={labels.firstName!} value={values.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="off" autoFocus />
        <TextInput id="invite-lastName" label={labels.lastName!} value={values.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="off" />
      </div>
      <TextInput id="invite-email" label={labels.email!} type="email" inputMode="email" value={values.email} onChange={set('email')} error={errors.email} autoComplete="off" hint={t('ui.admin-team.invite.emailHint')} />
      <div className={f.row}>
        <RoleSelect id="invite-role" value={values.role} onChange={(role) => setValues((v) => ({ ...v, role }))} roles={roles} error={errors.role} />
        <TextInput id="invite-jobTitle" label={labels.jobTitle!} optional value={values.jobTitle} onChange={set('jobTitle')} error={errors.jobTitle} maxLength={80} hint={t('ui.admin-team.field.jobTitleHint')} />
      </div>
      <Buttons close={close} pending={pending} label={t('ui.admin-team.invite.submit')} />
    </form>
  );
}

// ─── Modifier la fonction ───────────────────────────────────────────────────

function EditForm({ member, close, done }: { member: TeamMember; close: () => void; done: () => void }) {
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? '');
  const [receivesLeads, setReceivesLeads] = useState(member.receivesLeads ?? false);
  const [absentUntil, setAbsentUntil] = useState(member.absentUntil ?? '');
  const { pending, errors, run, banner } = useAction(done, t('ui.common.saved'));
  const min = new Intl.DateTimeFormat('en-CA').format(new Date());
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminCall(`/admin/users/${member.id}`, { method: 'PATCH', body: { jobTitle, ...(member.receivesLeads !== null ? { receivesLeads } : {}), absentUntil: absentUntil || null } }));
      }}
    >
      <p className={f.muted}>{t('ui.admin-team.dialog.edit.text', { nom: memberName(member) })}</p>
      {banner}
      <TextInput label={t('ui.admin-team.field.jobTitle')} optional value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} error={errors.jobTitle} maxLength={80} hint={t('ui.admin-team.field.jobTitleHint')} autoFocus />
      {member.receivesLeads !== null ? <Checkbox label={t('ui.admin-team.field.receivesLeads')} checked={receivesLeads} onChange={setReceivesLeads} /> : null}
      {member.status === 'ACTIVE' ? (
        <TextInput type="date" label={t('ui.admin-team.field.absentUntil')} optional value={absentUntil} min={min} onChange={(e) => setAbsentUntil(e.target.value)} error={errors.absentUntil} hint={t('ui.admin-team.field.absentUntilHint')} />
      ) : null}
      <Buttons close={close} pending={pending} label={t('ui.common.save')} />
    </form>
  );
}

// ─── Changer le rôle (ROL-010 … ROL-013) ────────────────────────────────────

function RoleForm({ member, roles, close, done }: { member: TeamMember; roles: StaffRole[]; close: () => void; done: () => void }) {
  const [role, setRole] = useState<string>(member.role);
  const { pending, errors, run, banner } = useAction(done, t('ui.admin-team.toast.roleChanged'));
  const options = roles.includes(member.role) ? roles : [member.role, ...roles];
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (role === member.role) return close();
        void run(() => adminCall(`/admin/users/${member.id}/change-role`, { body: { role } }));
      }}
    >
      <p>{t('ui.admin-team.dialog.role.text', { nom: memberName(member) })}</p>
      {banner}
      <RoleSelect value={role} onChange={setRole} roles={options} error={errors.role} />
      <Buttons close={close} pending={pending} label={t('ui.admin-team.dialog.role.submit')} />
    </form>
  );
}

// ─── Suspendre · Réinitialiser la double authentification (a reason is required) ─────────────────────────────────────

function ReasonForm({ kind, member, close, done }: { kind: 'suspend' | 'reset'; member: TeamMember; close: () => void; done: () => void }) {
  const [reason, setReason] = useState('');
  const { pending, errors, setErrors, run, banner } = useAction(done, t(kind === 'suspend' ? 'ui.admin-team.toast.suspended' : 'ui.admin-team.toast.twoFactorReset'));
  useEffect(() => setReason(''), [member.id, kind]);
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return setErrors({ reason: t('ui.validation.REQUIRED') });
        void run(() => adminCall(`/admin/users/${member.id}/${kind === 'suspend' ? 'suspend' : 'reset-two-factor'}`, { body: { reason } }));
      }}
    >
      <p>{t(`ui.admin-team.dialog.${kind}.text`, { nom: memberName(member) })}</p>
      {banner}
      <TextArea label={t('ui.admin-team.field.reason')} hint={t('ui.admin-team.field.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} error={errors.reason} autoFocus />
      <Buttons close={close} pending={pending} label={t(`ui.admin-team.dialog.${kind}.submit`)} danger={kind === 'suspend'} />
    </form>
  );
}

// ─── Réactiver · Renvoyer · Annuler l'invitation ────────────────────────────

function ConfirmForm({ kind, member, close, done }: { kind: 'reactivate' | 'resend' | 'cancel'; member: TeamMember; close: () => void; done: () => void }) {
  const route = { reactivate: 'reactivate', resend: 'resend-invitation', cancel: 'cancel-invitation' }[kind];
  const success = { reactivate: t('ui.admin-team.toast.reactivated'), resend: t('ui.admin-team.toast.resent'), cancel: t('ui.admin-team.toast.cancelled') }[kind];
  const { pending, run, banner } = useAction(done, success);
  const text: ReactNode = kind === 'resend' ? t('ui.admin-team.dialog.resend.text', { nom: memberName(member), email: member.email }) : t(`ui.admin-team.dialog.${kind}.text`, { nom: memberName(member) });
  return (
    <form
      className={f.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => adminCall(`/admin/users/${member.id}/${route}`, { method: 'POST' }));
      }}
    >
      <p>{text}</p>
      {banner}
      <Buttons close={close} pending={pending} label={t(`ui.admin-team.dialog.${kind}.submit`)} danger={kind === 'cancel'} />
    </form>
  );
}
