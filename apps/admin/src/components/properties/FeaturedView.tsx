'use client';
// EA-46 — « Mise en avant » (CTL-150, `catalogue.publish` to change): the THREE cards the home shows now (ACC-051, the
// same selection as the site), each saying whether it is pinned or chosen automatically; the pins with their rank and
// their state (« Épinglé, hors ligne » · « Épinglé, plus disponible »: they keep their pin and come back by themselves);
// pin a published and available property (three at most: a fourth asks to remove one), change a rank, unpin.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { FeaturedCard, FeaturedView as Featured, PropertyList } from '@dp/contracts';
import { Button, EmptyState, Icon, Modal, SkeletonRows, StatusTag } from '@dp/ui';
import { adminCall } from '@/lib/admin-client';
import { t } from '@/lib/i18n';
import { PageHeader, Surface } from '../shell/Page';
import { SelectInput, formStyles as f } from '../shell/forms';
import { catalogueStyles as cs, DialogButtons, FailureBanner, moneyOr, useCall } from '../catalogue/parts';
import { propertyPath } from './PropertiesList';
import s from './featured.module.css';

function Card({ card, children }: { card: FeaturedCard; children?: React.ReactNode }) {
  return (
    <article className={s.card}>
      <div className={s.visual}>
        {card.cover ? <img src={card.cover.url} alt="" /> : <Icon name="building" size={32} />}
        <span className={s.badge} data-source={card.source}>
          {card.source === 'PINNED' ? (
            <>
              <Icon name="star" size={16} />
              {t('ui.admin-properties.featured.pinnedRank', { n: card.rank ?? 0 })}
            </>
          ) : (
            t('ui.admin-properties.featured.auto')
          )}
        </span>
      </div>
      <div className={s.body}>
        <Link href={propertyPath(card.propertyId)} className={cs.nameLink}>
          {card.title}
        </Link>
        <span className={cs.sub}>
          {card.reference} · {card.region}
        </span>
        <strong className={cs.num}>{moneyOr(card.priceFrom, card.currency)}</strong>
        {children}
      </div>
    </article>
  );
}

export function FeaturedView() {
  const [data, setData] = useState<Featured | null>(null);
  const [failure, setFailure] = useState<Parameters<typeof FailureBanner>[0]['failure']>(null);
  const [picking, setPicking] = useState(false);
  const call = useCall();
  const load = useCallback(async () => {
    const r = await adminCall<Featured>('/admin/featured');
    if (r.ok) setData(r.data);
    else if (!r.aborted) setFailure(r);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const unpin = async (id: string) => {
    if ((await call.run(() => adminCall(`/admin/properties/${id}/feature`, { body: { rank: null } }), t('ui.admin-properties.toast.pinned'))) !== null) void load();
  };
  const full = (data?.pins.length ?? 0) >= 3;
  return (
    <div className={cs.createPage}>
      <PageHeader
        title={t('ui.admin-properties.featured.title')}
        crumbs={[{ label: t('ui.admin-shell.menu.group.catalogue') }, { label: t('ui.admin-properties.featured.title') }]}
        intro={t('ui.admin-properties.featured.intro')}
        actions={
          data?.canPublish ? (
            <Button variant="tool" size="M" icon="star" onClick={() => setPicking(true)} disabled={full} title={full ? t('ui.admin-properties.featured.full') : undefined}>
              {t('ui.admin-properties.featured.pinOne')}
            </Button>
          ) : undefined
        }
      />
      <FailureBanner failure={failure ?? call.failure} />
      {!data ? (
        <SkeletonRows rows={3} label={t('ui.common.loading')} />
      ) : (
        <>
          <Surface title={t('ui.admin-properties.featured.shown')}>
            {data.shown.length === 0 ? (
              <EmptyState icon="home" title={t('ui.admin-properties.featured.emptyShown')} compact />
            ) : (
              <div className={s.row}>
                {data.shown.map((c) => (
                  <Card key={c.propertyId} card={c} />
                ))}
              </div>
            )}
          </Surface>
          <Surface title={t('ui.admin-properties.featured.pins')}>
            {data.pins.length === 0 ? (
              <p className={cs.muted}>{t('ui.admin-properties.featured.noPins')}</p>
            ) : (
              <ul className={s.pins}>
                {data.pins.map((p) => (
                  <li key={p.propertyId} className={s.pin}>
                    <span className={s.rank}>{p.rank}</span>
                    <span className={cs.nameText}>
                      <Link href={propertyPath(p.propertyId)} className={cs.nameLink}>
                        {p.title}
                      </Link>
                      <span className={cs.sub}>
                        {p.reference} · {moneyOr(p.priceFrom, p.currency)}
                      </span>
                    </span>
                    <span className={cs.nameText}>
                      <StatusTag tone={p.state === 'SHOWN' ? 'success' : 'warning'}>{t(`ui.admin-properties.featured.state.${p.state}`)}</StatusTag>
                      {p.state !== 'SHOWN' ? <span className={cs.sub}>{t('ui.admin-properties.featured.stateHint')}</span> : null}
                    </span>
                    {data.canPublish ? (
                      <Button variant="tertiary" size="S" icon="close" onClick={() => void unpin(p.propertyId)}>
                        {t('ui.admin-properties.featured.unpin')}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {full ? <p className={cs.sub}>{t('ui.admin-properties.featured.full')}</p> : null}
          </Surface>
        </>
      )}
      {picking ? <PickDialog taken={data?.pins.map((p) => p.rank ?? 0) ?? []} onClose={() => setPicking(false)} onDone={() => (setPicking(false), void load())} /> : null}
    </div>
  );
}

function PickDialog({ taken, onClose, onDone }: { taken: number[]; onClose: () => void; onDone: () => void }) {
  const [options, setOptions] = useState<PropertyList['data']>([]);
  const [id, setId] = useState('');
  const free = [1, 2, 3].filter((n) => !taken.includes(n));
  const [rank, setRank] = useState(String(free[0] ?? 1));
  const { pending, failure, run } = useCall();
  useEffect(() => {
    void adminCall<PropertyList>('/admin/properties', { query: { view: 'published', availability: 'AVAILABLE', pageSize: 100, sort: 'title' } }).then((r) => r.ok && setOptions(r.data.data.filter((p) => !p.featuredRank)));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if ((await run(() => adminCall(`/admin/properties/${id}/feature`, { body: { rank: Number(rank) } }), t('ui.admin-properties.toast.pinned'))) !== null) onDone();
  }
  return (
    <Modal open onClose={onClose} title={t('ui.admin-properties.featured.pinOne')} closeLabel={t('ui.common.close')} width={560}>
      <form className={f.form} onSubmit={submit} noValidate>
        <FailureBanner failure={failure} />
        <SelectInput label={t('ui.admin-properties.featured.pick')} value={id} onChange={(e) => setId(e.target.value)} hint={t('ui.admin-properties.featured.pickHint')}>
          <option value="" disabled>
            {t('ui.admin-programs.field.none')}
          </option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {`${p.reference} · ${p.title}`}
            </option>
          ))}
        </SelectInput>
        <SelectInput label={t('ui.admin-properties.featured.rank')} value={rank} onChange={(e) => setRank(e.target.value)} hint={t('ui.admin-properties.dialog.pin.rankHint')}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </SelectInput>
        <DialogButtons close={onClose} pending={pending} label={t('ui.admin-properties.dialog.pin.submit')} disabled={!id} />
      </form>
    </Modal>
  );
}
