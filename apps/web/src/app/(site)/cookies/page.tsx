// EP-24 — /cookies (EDI-060, EDI-061): the version in force of its LegalDocument. Tag: content.
import type { Metadata } from 'next';
import { LegalPage, legalMetadata } from '@/components/editorial/LegalPage';

const PATH = '/cookies';

export function generateMetadata(): Promise<Metadata> {
  return legalMetadata(PATH);
}

export default function Page() {
  return <LegalPage path={PATH} />;
}
