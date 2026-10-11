// EP-12 — credit simulator (02-site-public/06 § 3). Prefill: `?bien={référence}` (SIM-030, reference financing of the
// property page), `?montant=&duree=` (SIM-031 « Je connais le montant à financer »; `duree` in years up to 40, else in
// months — the express calculation sends years), and from EP-11 `mois`, `taux`, `devise`, `produit`, `base`, `ref`,
// `frais`, `apport` (origin line of SIM-031).
import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { PageHead } from '@/components/editorial/Parts';
import { CreditSimulator } from '@/components/simulators/CreditSimulator';
import { loadOptions, loadProperty, one, type SP } from '@/components/simulators/load';
import s from '@/components/simulators/sim.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: { absolute: editorialTitle(t('ui.sim.credit.title'), settings) },
    description: t('ui.sim.credit.subtitle'),
    alternates: { canonical: '/financements/simulateur-credit' },
  };
}

export default async function CreditPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [settings, options, property] = await Promise.all([getSettings(), loadOptions(), loadProperty(one(sp.bien))]);
  const keys = ['montant', 'duree', 'mois', 'taux', 'devise', 'produit', 'methode', 'base', 'ref', 'frais', 'apport', 'simulation'] as const;
  const prefill = Object.fromEntries(keys.map((k) => [k, one(sp[k])]).filter(([, v]) => v !== undefined));
  return (
    <>
      <PageHead
        title={t('ui.sim.credit.title')}
        intro={t('ui.sim.credit.subtitle')}
        drawing="financement"
        crumbs={[{ href: '/financements', label: t('ui.editorial.financing.title') }]}
      />
      <section className={s.section}>
        <div className="container">
          <CreditSimulator settings={settings} options={options} property={property} prefill={prefill} />
        </div>
      </section>
    </>
  );
}
