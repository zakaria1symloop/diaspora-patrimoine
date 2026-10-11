// TRV-080 — first display: a skeleton in the shape of this page, shown only after 300 ms.
import { PageSkeleton } from '@/components/client-space/kit/Skeletons';

export default function Loading() {
  return <PageSkeleton shape="split" />;
}
