'use client';
// EA-47 — « Autres partenaires » (CTL-170, `content.manage`): notaries, insurers, institutions, media of the public page
// « Nos partenaires » (EDI-035). The list template (views « Visibles sur le site » · « Masqués » · « Tous », category
// filter, order by hand with « Monter » / « Descendre »); creating and editing in a panel on the right that leaves the
// list visible (name · category · presentation 600 · website · logo · « Visible sur le site »); hide, delete (trash).
import { useState, type FormEvent } from 'react';
import { PARTNER_CATEGORIES, PARTNER_VIEWS, type AdminPartner, type PartnerList } from '@dp/contracts';
import { Button, Icon, Menu, StatusTag } from '@dp/ui';
import { adminCall, newIdempotencyKey } from '@/lib/admin-client';
import { t } from '@/lib/i18n';
import { ListPage, type ListColumn } from '../shell/list/ListPage';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f, useUnsavedGuard } from '../shell/forms';
import { catalogueStyles as s, ConfirmDialog, FailureBanner, Thumb, useCall } from '../catalogue/parts';
import { ImageSlot } from '../media/ImageSlot';
import st from './partners.module.css';

export function PartnersList() {
  const [panel, setPanel] = useState<AdminPartner | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminPartner | null>(null);
  const [token, setToken] = useState(0);
  const reload = () => setToken((n) => n + 1);
  const call = useCall();
  const quick = async (path: string, body: unknown, text: string, method: 'POST' | 'PATCH' = 'POST') => {
    if ((await call.run(() => adminCall(path, { method, body }), text)) !== null) reload();
  };
  const create = (
    <Button variant="tool" size="M" icon="plus" onClick={() => setPanel('new')}>
      {t('ui.admin-promoters.partners.create')}
    </Button>
  );
  const columns: ListColumn<AdminPartner>[] = [
    {
      key: 'name',
      header: t('ui.admin-promoters.partners.column.name'),
      fixed: true,
      sortable: true,
      width: '20rem',
      text: (p) => p.name,
      cell: (p) => (
        <span className={s.nameCell}>
          <Thumb image={p.logo} />
          <span className={s.nameText}>
            <button type="button" className={st.nameButton} onClick={() => setPanel(p)}>
              {p.name}
            </button>
            {p.descriptionPublic ? <span className={s.sub}>{p.descriptionPublic}</span> : null}
          </span>
        </span>
      ),
    },
    { key: 'category', header: t('ui.admin-promoters.partners.column.category'), cell: (p) => t(`ui.enum.PartnerCategory.${p.category}`) },
    {
      key: 'url',
      header: t('ui.admin-promoters.partners.column.website'),
      cell: (p) =>
        p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer" className={s.sub}>
            {p.url.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          '—'
        ),
    },
    { key: 'public', header: t('ui.admin-promoters.partners.column.public'), cell: (p) => (p.isPublic ? <StatusTag tone="success">{t('ui.admin-promoters.publicYes')}</StatusTag> : <StatusTag tone="neutral">{t('ui.admin-promoters.publicNo')}</StatusTag>) },
    { key: 'sortOrder', header: t('ui.admin-promoters.partners.column.order'), sortable: true, align: 'end', cell: (p) => <span className={s.num}>{p.sortOrder / 10}</span> },
  ];
  return (
    <div className={st.layout} data-panel={panel ? '1' : undefined}>
      <div className={st.listZone}>
        <FailureBanner failure={call.failure} />
        <ListPage<AdminPartner, PartnerList>
          listKey="partners"
          endpoint="/admin/partners"
          header={{ title: t('ui.admin-promoters.partners.title'), crumbs: [{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-promoters.partners.title') }], intro: t('ui.admin-promoters.partners.intro'), actions: create }}
          columns={columns}
          rowId={(p) => p.id}
          rowLabel={(p) => p.name}
          defaultSort={{ key: 'sortOrder', dir: 'asc' }}
          defaultView="all"
          searchPlaceholder={t('ui.admin-promoters.partners.search')}
          reloadToken={token}
          savedViews={false}
          originViews={(r) => PARTNER_VIEWS.map((key) => ({ key, label: t(`ui.admin-promoters.partners.view.${key}`), count: r?.views[key] ?? null, query: { view: key } }))}
          filters={(r) => [{ key: 'category', label: t('ui.admin-promoters.partners.column.category'), kind: 'options', options: PARTNER_CATEGORIES.map((c) => ({ value: c, label: t(`ui.enum.PartnerCategory.${c}`), count: r?.facets.category[c] ?? 0 })) }]}
          rowActions={(p) => (
            <Menu
              label={t('ui.admin-programs.common.moreActions')}
              items={[
                { key: 'edit', label: t('ui.admin-programs.common.edit'), icon: 'edit', onSelect: () => setPanel(p) },
                { key: 'toggle', label: p.isPublic ? t('ui.admin-promoters.partners.hide') : t('ui.admin-promoters.partners.show'), icon: p.isPublic ? 'eye-off' : 'eye', onSelect: () => void quick(`/admin/partners/${p.id}`, { isPublic: !p.isPublic }, t('ui.admin-promoters.partners.toast.saved'), 'PATCH') },
                { key: 'up', label: t('ui.admin-promoters.partners.moveUp'), icon: 'chevron-up', onSelect: () => void quick(`/admin/partners/${p.id}/move`, { direction: 'up' }, t('ui.admin-promoters.partners.toast.moved')), separated: true },
                { key: 'down', label: t('ui.admin-promoters.partners.moveDown'), icon: 'chevron-down', onSelect: () => void quick(`/admin/partners/${p.id}/move`, { direction: 'down' }, t('ui.admin-promoters.partners.toast.moved')) },
                { key: 'delete', label: t('ui.admin-promoters.partners.delete'), icon: 'trash', danger: true, separated: true, onSelect: () => setDeleting(p) },
              ]}
            />
          )}
          empty={{ title: t('ui.admin-promoters.partners.empty.title'), text: t('ui.admin-promoters.partners.empty.text'), actions: create }}
        />
      </div>
      {panel ? <PartnerPanel key={panel === 'new' ? 'new' : panel.id} partner={panel === 'new' ? null : panel} onClose={() => setPanel(null)} onSaved={(p) => (reload(), setPanel(p))} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        title={t('ui.admin-promoters.partners.deleteTitle', { nom: deleting?.name ?? '' })}
        text={t('ui.admin-promoters.partners.deleteText')}
        submit={t('ui.admin-promoters.partners.delete')}
        danger
        call={() => adminCall(`/admin/partners/${deleting!.id}`, { method: 'DELETE' })}
        success={t('ui.admin-promoters.partners.toast.deleted')}
        onClose={() => setDeleting(null)}
        onDone={() => (setDeleting(null), setPanel(null), reload())}
      />
    </div>
  );
}

function PartnerPanel({ partner, onClose, onSaved }: { partner: AdminPartner | null; onClose: () => void; onSaved: (p: AdminPartner) => void }) {
  const initial = { name: partner?.name ?? '', category: partner?.category ?? 'NOTARY', descriptionPublic: partner?.descriptionPublic ?? '', url: partner?.url ?? '', isPublic: partner?.isPublic ?? false };
  const [v, setV] = useState(initial);
  const [key] = useState(newIdempotencyKey);
  const { pending, failure, errors, run } = useCall();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  useUnsavedGuard(dirty);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { name: v.name.trim(), category: v.category, descriptionPublic: v.descriptionPublic.trim() || null, url: v.url.trim() || null, isPublic: v.isPublic };
    const saved = await run(
      () => (partner ? adminCall<AdminPartner>(`/admin/partners/${partner.id}`, { method: 'PATCH', body }) : adminCall<AdminPartner>('/admin/partners', { body, idempotencyKey: key })),
      partner ? t('ui.admin-promoters.partners.toast.saved') : t('ui.admin-promoters.partners.toast.created'),
    );
    if (saved) onSaved(saved);
  }
  const refreshLogo = async () => {
    if (!partner) return;
    const r = await adminCall<AdminPartner>(`/admin/partners/${partner.id}`);
    if (r.ok) onSaved(r.data);
  };
  return (
    <aside className={st.panel} aria-label={partner ? t('ui.admin-promoters.partners.panelEdit') : t('ui.admin-promoters.partners.panelNew')}>
      <header className={st.panelHead}>
        <h2>{partner ? partner.name : t('ui.admin-promoters.partners.panelNew')}</h2>
        <Button variant="tertiary" size="S" aria-label={t('ui.common.close')} onClick={onClose}>
          <Icon name="close" size={20} />
        </Button>
      </header>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        <TextInput label={t('ui.admin-promoters.partners.field.name')} value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} maxLength={160} error={errors.name} autoFocus />
        <SelectInput label={t('ui.admin-promoters.partners.field.category')} value={v.category} onChange={(e) => setV((x) => ({ ...x, category: e.target.value as typeof v.category }))}>
          {PARTNER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`ui.enum.PartnerCategory.${c}`)}
            </option>
          ))}
        </SelectInput>
        <TextArea label={t('ui.admin-promoters.partners.field.description')} optional value={v.descriptionPublic} onChange={(e) => setV((x) => ({ ...x, descriptionPublic: e.target.value }))} maxLength={600} rows={5} error={errors.descriptionPublic} />
        <TextInput label={t('ui.admin-promoters.partners.field.url')} optional inputMode="url" value={v.url} onChange={(e) => setV((x) => ({ ...x, url: e.target.value }))} maxLength={300} error={errors.url} hint={t('ui.admin-promoters.partners.field.urlHint')} />
        <Checkbox label={t('ui.admin-promoters.partners.field.isPublic')} checked={v.isPublic} onChange={(isPublic) => setV((x) => ({ ...x, isPublic }))} />
        <div className={f.actions}>
          <Button type="submit" variant="tool" size="M" pending={pending} disabled={!v.name.trim() || (partner !== null && !dirty)}>
            {t('ui.admin-promoters.partners.save')}
          </Button>
          <Button type="button" variant="secondary" size="M" onClick={onClose}>
            {t('ui.common.cancel')}
          </Button>
        </div>
      </form>
      <div className={st.logoZone}>
        {partner ? (
          <ImageSlot ownerType="PARTNER" ownerId={partner.id} kind="LOGO" label={t('ui.admin-promoters.partners.field.logo')} image={partner.logo} canWrite onChanged={() => void refreshLogo()} />
        ) : (
          <p className={s.sub}>{t('ui.admin-promoters.partners.logoAfter')}</p>
        )}
      </div>
    </aside>
  );
}
