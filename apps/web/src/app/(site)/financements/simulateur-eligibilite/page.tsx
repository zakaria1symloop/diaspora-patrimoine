// EP-11 — eligibility simulator (02-site-public/06 § 2). Prefill: `?bien={référence}` (SIM-010 target price from a
// property page), `?apport=&mensualite=` (EDI-023 « Affiner »), `?prix=&devise=` (SIM-031 from EP-12).
import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { editorialTitle } from '@/lib/editorial';
import { t } from '@/lib/i18n';
import { PageHead } from '@/components/editorial/Parts';
import { EligibilitySimulator } from '@/components/simulators/EligibilitySimulator';
import { loadOptions, loadProperty, one, type SP } from '@/components/simulators/load';
import s from '@/components/simulators/sim.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: { absolute: editorialTitle(t('ui.sim.elig.title'), settings) },
    description: t('ui.sim.elig.subtitle'),
    alternates: { canonical: '/financements/simulateur-eligibilite' },
  };
}

export default async function EligibilityPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [settings, options, property] = await Promise.all([getSettings(), loadOptions(), loadProperty(one(sp.bien))]);
  return (
    <>
      <PageHead
        title={t('ui.sim.elig.title')}
        intro={t('ui.sim.elig.subtitle')}
        drawing="financement"
        crumbs={[{ href: '/financements', label: t('ui.editorial.financing.title') }]}
      />
      <section className={s.section}>
        <div className="container">
          <EligibilitySimulator
            settings={settings}
            options={options}
            property={property}
            year={new Date().getUTCFullYear()}
            prefill={{ apport: one(sp.apport), mensualite: one(sp.mensualite), prix: one(sp.prix), devise: one(sp.devise), simulation: one(sp.simulation) }}
          />
        </div>
      </section>
    </>
  );
}
