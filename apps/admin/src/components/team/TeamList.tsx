'use client';
// EA-96 — the team (ADM-030, ADM-032, ADM-040; ROL-010 … ROL-013). Columns: Nom · E-mail · Rôle · État · Double
// authentification · Dernière connexion (« Reçoit des demandes », « Absent jusqu'au » and « En cours » arrive with the
// processing of requests, package 3.2: before, these columns are absent). Sort by name; filters Rôle, État; search on
// name and e-mail. Actions (`user.manage`): inviter, renvoyer ou annuler une invitation, changer le rôle, modifier la
// fonction, suspendre, réactiver; `user.twofactor.reset`: réinitialiser la double authentification. The API says, for
// each account, what the caller may do on it (`can`): what he may not do is absent.
import { useState } from 'react';
import { TEAM_STATUSES, StaffRole, type TeamList as TeamListData, type TeamMember } from '@dp/contracts';
import { Banner, Button, Menu, StatusTag, type MenuItem } from '@dp/ui';
import Link from 'next/link';
import { DASH, memberName, shortDateTime, shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { USER_STATUS_TONE } from '@/lib/tones';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { useShell } from '../shell/ShellContext';
import { TeamDialogs, type TeamDialog } from './TeamDialogs';
import s from './team.module.css';

export function TeamList() {
  const { can, timeZone } = useShell();
  const [dialog, setDialog] = useState<TeamDialog | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [roles, setRoles] = useState<StaffRole[]>([]);

  const columns: ListColumn<TeamMember>[] = [
    {
      key: 'name',
      header: t('ui.admin-team.column.name'),
      sortable: true,
      fixed: true,
      width: '16rem',
      cell: (m) => (
        <span className={s.name}>
          <span className={s.avatar} aria-hidden="true">
            {[m.firstName, m.lastName].map((p) => p?.charAt(0) ?? '').join('').toUpperCase() || '?'}
          </span>
          <span className={s.nameText}>
            {memberName(m)}
            {m.isSelf ? <span className={s.self}>{t('ui.admin-team.you')}</span> : null}
          </span>
        </span>
      ),
      text: (m) => memberName(m),
    },
    { key: 'email', header: t('ui.admin-team.column.email'), cell: (m) => m.email, text: (m) => m.email },
    {
      key: 'role',
      header: t('ui.admin-team.column.role'),
      sortable: true,
      cell: (m) => (
        <>
          {t(`ui.enum.MembershipRole.${m.role}`)}
          {m.elevatedUntil ? <span className={s.sub}>{t('ui.admin-team.elevatedUntil', { date: shortDateTime(m.elevatedUntil, timeZone) })}</span> : null}
        </>
      ),
    },
    { key: 'jobTitle', header: t('ui.admin-team.column.jobTitle'), hiddenByDefault: true, cell: (m) => m.jobTitle ?? DASH, text: (m) => m.jobTitle },
    {
      key: 'status',
      header: t('ui.admin-team.column.status'),
      sortable: true,
      cell: (m) => (
        <span className={s.status}>
          <StatusTag tone={USER_STATUS_TONE[m.status] ?? 'neutral'} title={m.suspendedNote ?? undefined}>
            {t(`ui.enum.UserStatus.${m.status}`)}
          </StatusTag>
          {m.invitationExpired ? <span className={s.sub}>{t('ui.admin-team.invitationExpired')}</span> : null}
        </span>
      ),
    },
    {
      key: 'twoFactor',
      header: t('ui.admin-team.column.twoFactor'),
      cell: (m) => (m.twoFactorEnabled === null ? DASH : m.twoFactorEnabled ? t('ui.common.yes') : t('ui.common.no')),
    },
    { key: 'lastLoginAt', header: t('ui.admin-team.column.lastLogin'), sortable: true, firstDir: 'desc', cell: (m) => shortDateTime(m.lastLoginAt, timeZone) },
    // ADM-030, CRM-021 — package 3.2
    { key: 'receivesLeads', header: t('ui.admin-team.column.receivesLeads'), cell: (m) => (m.receivesLeads === null ? DASH : m.receivesLeads ? t('ui.common.yes') : t('ui.common.no')) },
    {
      key: 'absentUntil',
      header: t('ui.admin-team.column.absentUntil'),
      cell: (m) => (m.absentUntil ? <StatusTag tone="warning" icon="calendar">{shortDay(m.absentUntil)}</StatusTag> : DASH),
    },
    {
      key: 'workload',
      header: t('ui.admin-team.column.workload'),
      cell: (m) =>
        m.workload.leads + m.workload.dossiers + m.workload.tasks === 0 ? (
          DASH
        ) : (
          <span className={s.workload}>
            {m.workload.leads ? <span>{t('ui.admin-team.workload.leads', { n: m.workload.leads })}</span> : null}
            {m.workload.dossiers ? <span>{t('ui.admin-team.workload.dossiers', { n: m.workload.dossiers })}</span> : null}
            {m.workload.tasks ? <span>{t('ui.admin-team.workload.tasks', { n: m.workload.tasks })}</span> : null}
          </span>
        ),
      text: (m) => `${m.workload.leads}/${m.workload.dossiers}/${m.workload.tasks}`,
    },
  ];

  const actionsOf = (m: TeamMember): MenuItem[] => {
    const items: MenuItem[] = [];
    if (m.can.edit) items.push({ key: 'edit', label: t('ui.admin-team.action.edit'), icon: 'edit', onSelect: () => setDialog({ kind: 'edit', member: m }) });
    if (m.can.changeRole) items.push({ key: 'role', label: t('ui.admin-team.action.changeRole'), icon: 'key', onSelect: () => setDialog({ kind: 'role', member: m }) });
    if (m.can.resendInvitation) items.push({ key: 'resend', label: t('ui.admin-team.action.resend'), icon: 'send', onSelect: () => setDialog({ kind: 'resend', member: m }) });
    if (m.can.resetTwoFactor) items.push({ key: 'reset', label: t('ui.admin-team.action.resetTwoFactor'), icon: 'shield', onSelect: () => setDialog({ kind: 'reset', member: m }) });
    if (m.can.reactivate) items.push({ key: 'reactivate', label: t('ui.admin-team.action.reactivate'), icon: 'check', onSelect: () => setDialog({ kind: 'reactivate', member: m }) });
    if (m.can.suspend) items.push({ key: 'suspend', label: t('ui.admin-team.action.suspend'), icon: 'lock', danger: true, separated: items.length > 0, onSelect: () => setDialog({ kind: 'suspend', member: m }) });
    if (m.can.cancelInvitation) items.push({ key: 'cancel', label: t('ui.admin-team.action.cancel'), icon: 'trash', danger: true, separated: items.length > 0, onSelect: () => setDialog({ kind: 'cancel', member: m }) });
    return items;
  };

  return (
    <>
      <ListPage<TeamMember, TeamListData>
        listKey="team"
        endpoint="/admin/users"
        reloadToken={reloadToken}
        savedViews={false}
        header={{
          title: t('ui.admin-team.title'),
          crumbs: [{ label: t('ui.admin-shell.menu.group.administration') }, { label: t('ui.admin-team.title') }],
          actions: can('user.manage') ? (
            <Button variant="tool" size="M" icon="plus" onClick={() => setDialog({ kind: 'invite' })}>
              {t('ui.admin-team.invite.open')}
            </Button>
          ) : undefined,
        }}
        columns={columns}
        rowId={(m) => m.id}
        rowLabel={memberName}
        defaultSort={{ key: 'name', dir: 'asc' }}
        searchPlaceholder={t('ui.admin-team.search')}
        filters={(r) => [
          { key: 'role', label: t('ui.admin-team.column.role'), kind: 'options', options: Object.values(StaffRole).map((role) => ({ value: role, label: t(`ui.enum.MembershipRole.${role}`), count: r?.facets.role[role] ?? 0 })) },
          { key: 'status', label: t('ui.admin-team.column.status'), kind: 'options', options: TEAM_STATUSES.map((st) => ({ value: st, label: t(`ui.enum.UserStatus.${st}`), count: r?.facets.status[st] ?? 0 })) },
        ]}
        onResponse={(r) => setRoles(r.assignableRoles)}
        notice={(r) =>
          // ADM-040 — reminded while a single Direction account exists; CRM-021, ADM-030 — work waiting on someone who cannot do it
          (r.singleOwner && can('user.manage')) || r.notices.length ? (
            <div className={s.notice}>
              {r.singleOwner && can('user.manage') ? (
                <Banner tone="warning" title={t('ui.admin-team.singleOwner.title')}>
                  {t('ui.admin-team.singleOwner.text')}
                </Banner>
              ) : null}
              {r.notices.map((n) => {
                const work = [n.leads ? t('ui.admin-team.workload.leadsLong', { n: n.leads }) : null, n.dossiers ? t('ui.admin-team.workload.dossiersLong', { n: n.dossiers }) : null, n.tasks ? t('ui.admin-team.workload.tasksLong', { n: n.tasks }) : null].filter(Boolean).join(', ');
                const who = n.firstName ?? memberName(n);
                const text =
                  n.kind === 'ABSENT'
                    ? work
                      ? t('ui.admin-team.notice.absent', { prenom: who, date: shortDay(n.absentUntil), travail: work })
                      : t('ui.admin-team.notice.absentIdle', { prenom: who, date: shortDay(n.absentUntil) })
                    : t(n.kind === 'SUSPENDED' ? 'ui.admin-team.notice.suspended' : 'ui.admin-team.notice.role', { prenom: who, travail: work });
                return (
                  <Banner
                    key={n.id}
                    tone={n.kind === 'ABSENT' ? 'info' : 'warning'}
                    action={
                      n.leads && can('lead.assign') ? (
                        <Link className={s.noticeLink} href={`/demandes?view=all&assignedAgentId=${n.id}&status=NEW,IN_PROGRESS`}>
                          {t('ui.admin-team.notice.reassignLeads')}
                        </Link>
                      ) : undefined
                    }
                  >
                    {text}
                  </Banner>
                );
              })}
            </div>
          ) : null
        }
        empty={{ title: t('ui.admin-team.empty.title'), text: t('ui.admin-team.empty.text') }}
        rowActions={(m) => {
          const items = actionsOf(m);
          return items.length ? <Menu label={t('ui.admin-team.action.menu', { nom: memberName(m) })} items={items} /> : null;
        }}
      />
      <TeamDialogs
        dialog={dialog}
        roles={roles}
        close={() => setDialog(null)}
        done={() => {
          setDialog(null);
          setReloadToken((n) => n + 1);
        }}
      />
    </>
  );
}
