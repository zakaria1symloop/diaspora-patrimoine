'use client';
// CTL-150 — pin a published property on the home page with a rank (1, 2, 3), or remove its pin. Three pins at most: a
// rank already taken frees the property that held it; a fourth pin is refused (`MAX_REACHED`).
import { useState, type FormEvent } from 'react';
import { Button, Modal } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { t } from '@/lib/i18n';
import { SelectInput, formStyles as f } from '../shell/forms';
import { DialogButtons, FailureBanner, useCall } from '../catalogue/parts';

export function PinDialog({ property, onClose, onDone }: { property: { id: string; title: string; featuredRank: number | null }; onClose: () => void; onDone: () => void }) {
  const [rank, setRank] = useState(String(property.featuredRank ?? 1));
  const { pending, failure, run } = useCall();
  async function save(value: number | null) {
    const ok = await run(() => adminCall(`/admin/properties/${property.id}/feature`, { body: { rank: value } }), t('ui.admin-properties.toast.pinned'));
    if (ok !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-properties.dialog.pin.title', { nom: property.title })} closeLabel={t('ui.common.close')}>
      <form
        className={f.form}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(Number(rank));
        }}
        noValidate
      >
        <FailureBanner failure={failure} />
        <SelectInput label={t('ui.admin-properties.dialog.pin.rank')} value={rank} onChange={(e) => setRank(e.target.value)} hint={t('ui.admin-properties.dialog.pin.rankHint')}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SelectInput>
        {property.featuredRank ? (
          <Button type="button" variant="tertiary" size="S" icon="close" onClick={() => void save(null)}>
            {t('ui.admin-properties.dialog.pin.unpin')}
          </Button>
        ) : null}
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-properties.dialog.pin.submit')} />
      </form>
    </Modal>
  );
}
