// TRV-084 — 404 inside the site (unknown property, programme, promoter, Café…): the site layout already draws the
// header and the footer, so only the content is rendered here — never the frame twice.
import { NotFoundContent } from '@/components/NotFoundContent';

export default function NotFound() {
  return <NotFoundContent />;
}
