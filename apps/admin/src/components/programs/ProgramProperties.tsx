'use client';
// CTL-023 « Biens » — the typologies of the programme with their surface, price range, lots, publication and
// completeness; « Ajouter une typologie » (CTL-041) opens the creation with the programme chosen.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminProgramDetail, ProgramPropertyRow } from '@dp/contracts';
import { DataTable, EmptyState, StatusTag } from '@dp/ui';
import { t } from '@/lib/i18n';
import { PUBLICATION_TONE } from '@/lib/tones';
import { Surface } from '../shell/Page';
import { CompletenessPill } from '../properties/CompletenessPill';
import { catalogueStyles as s, LinkButton, moneyOr, StockMeter, tableLabels, Thumb } from '../catalogue/parts';
import { useCatalogueReference } from '../catalogue/reference';

export const propertyPath = (id: string) => `/catalogue/biens/${id}`;

export function ProgramProperties({ program }: { program: AdminProgramDetail }) {
  const ref = useCatalogueReference();
  const router = useRouter();
  const add = program.can.write && program.publication !== 'ARCHIVED' ? (
    <LinkButton href={`/catalogue/biens/nouveau?programme=${program.id}`} variant="secondary" size="S" icon="plus">
      {t('ui.admin-programs.action.addProperty')}
    </LinkButton>
  ) : null;
  const price = (r: ProgramPropertyRow) =>
    r.priceFrom && r.priceTo && r.priceFrom !== r.priceTo ? `${moneyOr(r.priceFrom, r.currency)} – ${moneyOr(r.priceTo, r.currency)}` : moneyOr(r.priceFrom, r.currency, t('ui.admin-programs.common.noPrice'));
  return (
    <Surface title={t('ui.admin-programs.properties.title')} actions={add}>
      {program.properties.length === 0 ? (
        <EmptyState icon="key" title={t('ui.admin-programs.properties.empty.title')} text={t('ui.admin-programs.properties.empty.text')} actions={add} compact />
      ) : (
        <DataTable<ProgramPropertyRow>
          rows={program.properties}
          rowId={(r) => r.id}
          rowLabel={(r) => r.reference}
          labels={tableLabels(t('ui.admin-programs.properties.title'))}
          onOpen={(r, { newTab }) => (newTab ? window.open(propertyPath(r.id), '_blank') : router.push(propertyPath(r.id)))}
          columns={[
            {
              key: 'property',
              header: t('ui.admin-programs.properties.column.property'),
              width: '22rem',
              cell: (r) => (
                <span className={s.nameCell}>
                  <Thumb image={r.cover} />
                  <span className={s.nameText}>
                    <Link href={propertyPath(r.id)} className={s.nameLink}>
                      {r.title}
                    </Link>
                    <span className={s.sub}>{r.reference}</span>
                  </span>
                </span>
              ),
            },
            { key: 'surface', header: t('ui.admin-programs.properties.column.surface'), align: 'end', cell: (r) => <span className={s.num}>{`${Number(r.surfaceM2).toLocaleString('fr-FR')} m²`}</span> },
            { key: 'price', header: t('ui.admin-programs.properties.column.price'), align: 'end', cell: (r) => <span className={s.num}>{price(r)}</span> },
            { key: 'lots', header: t('ui.admin-programs.properties.column.lots'), cell: (r) => <StockMeter available={r.lotsAvailable} total={r.lotsTotal} compact /> },
            { key: 'publication', header: t('ui.admin-programs.properties.column.publication'), cell: (r) => <StatusTag tone={PUBLICATION_TONE[r.publication] ?? 'neutral'}>{t(`ui.enum.PublicationStatus.${r.publication}`)}</StatusTag> },
            {
              key: 'completeness',
              header: t('ui.admin-programs.properties.column.completeness'),
              cell: (r) => <CompletenessPill score={r.completenessScore} min={ref?.settings.publishMinScore ?? 60} complete={ref?.settings.completeScore ?? 85} />,
            },
          ]}
        />
      )}
    </Surface>
  );
}
