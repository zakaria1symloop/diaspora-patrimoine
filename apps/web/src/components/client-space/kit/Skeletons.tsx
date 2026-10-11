// TRV-080 « Chargement » — a skeleton in the SHAPE of the page that is coming (shown only after 300 ms): a title, the
// toolbar of a list, cards or rows, the two columns of a page with a side block. Used by the `loading.tsx` of each route.
import s from './kit.module.css';

export type SkeletonShape = 'dashboard' | 'cards' | 'rows' | 'split' | 'form';

function Head() {
  return (
    <>
      <div className={`${s.skLine} ${s.skTitle}`} />
      <div className={s.skLine} style={{ width: 'min(34rem, 85%)' }} />
    </>
  );
}

export function PageSkeleton({ shape }: { shape: SkeletonShape }) {
  return (
    <div className={s.sk} aria-hidden="true" data-skeleton={shape}>
      <Head />
      {shape === 'cards' || shape === 'rows' ? (
        <div className={s.skRow}>
          <div className={s.skChip} />
          <div className={s.skChip} />
          <div className={s.skChip} />
        </div>
      ) : null}
      {shape === 'dashboard' ? (
        <>
          <div className={s.skGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(11.5rem, 1fr))' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={s.skBlock} style={{ minHeight: '4.5rem' }} />
            ))}
          </div>
          <div className={s.skSplit}>
            <div className={`${s.skBlock} ${s.skTall}`} />
            <div className={`${s.skBlock} ${s.skTall}`} />
          </div>
        </>
      ) : null}
      {shape === 'cards' ? (
        <div className={s.skGrid}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${s.skBlock} ${s.skTall}`} />
          ))}
        </div>
      ) : null}
      {shape === 'rows' ? [0, 1, 2, 3].map((i) => <div key={i} className={s.skBlock} />) : null}
      {shape === 'split' ? (
        <div className={s.skSplit}>
          <div className={`${s.skBlock} ${s.skTall}`} />
          <div className={s.skBlock} />
        </div>
      ) : null}
      {shape === 'form' ? (
        <div className={s.skSplit}>
          <div style={{ display: 'grid', gap: 'var(--sp-20)' }}>
            <div className={`${s.skBlock} ${s.skTall}`} />
            <div className={`${s.skBlock} ${s.skTall}`} />
          </div>
          <div className={s.skBlock} />
        </div>
      ) : null}
    </div>
  );
}
