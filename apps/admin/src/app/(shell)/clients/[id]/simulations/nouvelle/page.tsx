// CRM-046 « Faire une simulation » — `/clients/{id}/simulations/nouvelle?type=eligibilite|credit` (`simulation.create`).
import type { Metadata } from 'next';
import type { AdminSimulationPrefill, SimulatorOptions } from '@dp/contracts';
import { SimulationWorkbench } from '@/components/clients/simulations/SimulationWorkbench';
import { Forbidden } from '@/components/shell/Page';
import { ReadFailure } from '@/components/shell/ReadFailure';
import { adminGet, hasPermission } from '@/components/shell/server';
import { t } from '@/lib/i18n';

export const metadata: Metadata = { title: t('ui.admin-simulations.page.title') };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  if (!(await hasPermission('simulation.create'))) return <Forbidden />;
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  const [prefill, options, countries] = await Promise.all([
    adminGet<AdminSimulationPrefill>(`/admin/clients/${encodeURIComponent(id)}/simulations/prefill`),
    adminGet<SimulatorOptions>('/public/simulations/options'),
    adminGet<{ data: { code: string; name: string }[] }>('/public/countries'),
  ]);
  if (!prefill.ok) return <ReadFailure result={prefill} />;
  if (!options.ok) return <ReadFailure result={options} />;
  if (!countries.ok) return <ReadFailure result={countries} />;
  return <SimulationWorkbench clientId={id} kind={type === 'credit' ? 'credit' : 'eligibilite'} options={options.data} prefill={prefill.data} countries={countries.data.data} />;
}
