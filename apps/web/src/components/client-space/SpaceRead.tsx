// What a page renders when its server read failed: the session renewal (401/403, AUTH-023) or the error block
// (TRV-080). A 404 is the page's own business (ROL-030: notFound()).
import type { SpaceRead } from './server';
import { BlockError } from './BlockError';
import { SessionRenewal } from './SessionRenewal';

export function SpaceReadFailure({ result }: { result: SpaceRead<unknown> }) {
  if (!result.ok && (result.status === 401 || result.status === 403)) return <SessionRenewal />;
  return <BlockError />;
}
