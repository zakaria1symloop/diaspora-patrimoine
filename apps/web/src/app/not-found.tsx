// TRV-084 — 404 for an address outside the site group: the site frame around the 404 content.
import { SiteChrome } from '@/components/layout/SiteChrome';
import { NotFoundContent } from '@/components/NotFoundContent';

export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  );
}
