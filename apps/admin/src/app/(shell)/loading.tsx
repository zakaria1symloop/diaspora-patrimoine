// TRV-080 — a skeleton that takes the shape of a page; it appears only when the answer is late (300 ms).
import { Skeleton, SkeletonRows } from '@dp/ui';
import { t } from '@/lib/i18n';

export default function Loading() {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Skeleton width="16rem" height="2rem" />
      <div style={{ border: '1px solid var(--bo-ligne-bleue)', borderRadius: 'var(--ui-radius-surface)', background: 'var(--bo-fond-blanc)' }}>
        <SkeletonRows rows={8} columns={5} label={t('ui.common.loading')} />
      </div>
    </div>
  );
}
