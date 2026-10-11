'use client';
// CTL-145 — « Chantier »: the points of progress of a programme, latest first (stage, percentage never below the
// previous point, note, date, photos). « Ajouter un point d'avancement »: on saving, the point appears on the site and
// the clients whose dossier is about this programme are told (NC_PROGRAM_UPDATE, C_PROGRAM_UPDATE) unless « Ne pas
// prévenir les clients ». A point is corrected or deleted. Photos: through the media upload (ownerType PROGRAM_UPDATE).
// Hidden when `features.constructionProgress` is off.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CONSTRUCTION_STAGES, type AdminProgramUpdate } from '@dp/contracts';
import { Button, EmptyState, Menu, Modal, SkeletonRows } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { shortDay } from '@/lib/format';
import { t } from '@/lib/i18n';
import { Surface } from '../shell/Page';
import { Checkbox, SelectInput, TextArea, TextInput, formStyles as f } from '../shell/forms';
import { useCatalogueReference } from '../catalogue/reference';
import { catalogueStyles as s, ConfirmDialog, DialogButtons, FailureBanner, useCall } from '../catalogue/parts';
import { PhotoUploader } from '../media/PhotoUploader';
import st from './programs.module.css';

export function ConstructionTab({ programId, canWrite, onChanged }: { programId: string; canWrite: boolean; onChanged?: () => void }) {
  const ref = useCatalogueReference();
  const [items, setItems] = useState<AdminProgramUpdate[] | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'add' | 'edit' | 'delete'; item?: AdminProgramUpdate } | null>(null);
  const load = useCallback(() => adminCall<AdminProgramUpdate[]>(`/admin/programs/${programId}/updates`).then((r) => r.ok && setItems(r.data)), [programId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (ref && !ref.settings.constructionProgress) return <p className={s.notice}>{t('ui.admin-programs.works.disabled')}</p>;
  if (!items) return <SkeletonRows rows={3} label={t('ui.common.loading')} />;
  const done = () => {
    setDialog(null);
    void load();
    onChanged?.();
  };
  const last = items[0]?.percent ?? 0;
  const add = canWrite ? (
    <Button variant="tool" size="S" icon="plus" onClick={() => setDialog({ kind: 'add' })}>
      {t('ui.admin-programs.works.add')}
    </Button>
  ) : null;

  return (
    <Surface title={t('ui.admin-programs.works.title')} actions={add}>
      {items.length === 0 ? (
        <EmptyState icon="building" title={t('ui.admin-programs.works.empty.title')} text={t('ui.admin-programs.works.empty.text')} actions={add} compact />
      ) : (
        <div className={st.works}>
          <div className={st.progress} aria-hidden="true">
            <span className={st.progressFill} style={{ width: `${last}%` }} />
          </div>
          <ol className={st.timeline}>
            {items.map((u) => (
              <li key={u.id} className={st.point}>
                <span className={st.percent}>{u.percent} %</span>
                <div className={st.pointBody}>
                  <div className={st.pointHead}>
                    <strong>{t(`ui.enum.ConstructionStage.${u.stage}`)}</strong>
                    <span className={s.sub}>
                      {shortDay(u.publishedAt)}
                      {u.author ? ` · ${t('ui.admin-programs.works.by', { nom: u.author })}` : ''}
                    </span>
                    {canWrite ? (
                      <Menu
                        label={t('ui.admin-programs.common.moreActions')}
                        items={[
                          { key: 'edit', label: t('ui.admin-programs.works.edit'), icon: 'edit', onSelect: () => setDialog({ kind: 'edit', item: u }) },
                          { key: 'delete', label: t('ui.admin-programs.works.delete'), icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', item: u }) },
                        ]}
                      />
                    ) : null}
                  </div>
                  {u.note ? <p className={s.prose}>{u.note}</p> : null}
                  <div className={st.photos}>
                    {u.photos.map((p) => (
                      <img key={p.id} src={p.url} alt={p.alt ?? ''} loading="lazy" />
                    ))}
                    {canWrite ? <PhotoUploader ownerType="PROGRAM_UPDATE" ownerId={u.id} label={t('ui.admin-programs.works.addPhotos')} onDone={() => void load()} /> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {dialog?.kind === 'add' || dialog?.kind === 'edit' ? <UpdateDialog programId={programId} item={dialog.item} minPercent={dialog.kind === 'add' ? last : 0} onClose={() => setDialog(null)} onDone={done} /> : null}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={t('ui.admin-programs.works.deleteTitle')}
        text={t('ui.admin-programs.works.deleteText')}
        submit={t('ui.admin-programs.works.delete')}
        danger
        call={() => adminCall(`/admin/program-updates/${dialog!.item!.id}`, { method: 'DELETE' })}
        success={t('ui.admin-programs.works.toast.deleted')}
        onClose={() => setDialog(null)}
        onDone={done}
      />
    </Surface>
  );
}

function UpdateDialog({ programId, item, minPercent, onClose, onDone }: { programId: string; item?: AdminProgramUpdate; minPercent: number; onClose: () => void; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({ stage: item?.stage ?? 'FOUNDATIONS', percent: String(item?.percent ?? minPercent), note: item?.note ?? '', date: item?.publishedAt ?? today, silent: false });
  const { pending, failure, errors, run } = useCall();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { stage: v.stage, percent: Number(v.percent), note: v.note || null, date: v.date, ...(item ? {} : { silent: v.silent }) };
    const ok = await run(
      () => (item ? adminCall(`/admin/program-updates/${item.id}`, { method: 'PATCH', body }) : adminCall(`/admin/programs/${programId}/updates`, { body })),
      item ? t('ui.admin-programs.works.toast.saved') : t('ui.admin-programs.works.toast.created'),
    );
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={item ? t('ui.admin-programs.works.edit') : t('ui.admin-programs.works.add')} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        <div className={f.row}>
          <SelectInput label={t('ui.admin-programs.works.stage')} value={v.stage} onChange={(e) => setV((x) => ({ ...x, stage: e.target.value as typeof v.stage }))}>
            {CONSTRUCTION_STAGES.map((x) => (
              <option key={x} value={x}>
                {t(`ui.enum.ConstructionStage.${x}`)}
              </option>
            ))}
          </SelectInput>
          <TextInput label={t('ui.admin-programs.works.percent')} inputMode="numeric" value={v.percent} onChange={(e) => setV((x) => ({ ...x, percent: e.target.value.replace(/\D/g, '').slice(0, 3) }))} error={errors.percent} hint={item ? undefined : t('ui.admin-programs.works.percentHint', { n: minPercent })} />
          <TextInput label={t('ui.admin-programs.works.date')} type="date" max={today} value={v.date} onChange={(e) => setV((x) => ({ ...x, date: e.target.value }))} error={errors.date} />
        </div>
        <TextArea label={t('ui.admin-programs.works.note')} optional value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} maxLength={1000} rows={4} error={errors.note} />
        {!item ? (
          <>
            <Checkbox label={t('ui.admin-programs.works.silent')} checked={v.silent} onChange={(silent) => setV((x) => ({ ...x, silent }))} />
            <p className={s.sub}>{t('ui.admin-programs.works.silentHint')}</p>
            <p className={s.sub}>{t('ui.admin-programs.works.photosHint')}</p>
          </>
        ) : null}
        <DialogButtons close={onClose} pending={pending} label={item ? t('ui.admin-programs.works.save') : t('ui.admin-programs.works.submit')} />
      </form>
    </Modal>
  );
}
