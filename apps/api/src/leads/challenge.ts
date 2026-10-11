// DEM-030 point 4, ARC-060 `ChallengeProvider` (optional) — non-intrusive challenge of Q-034 (Friendly Captcha or an
// equivalent), behind this interface so that changing the service only touches this component. Configured by
// CHALLENGE_SITE_KEY and CHALLENGE_SECRET (ENV-040). Without a service, a suspect request is accepted with `needsReview`.
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

export interface ChallengeProvider {
  readonly configured: boolean;
  /** True when the proof sent by the form is valid. */
  verify(proof: string): Promise<boolean>;
}

/** Three failed challenges: the request is accepted and marked « À vérifier » (DEM-030 point 4). */
export const CHALLENGE_MAX_FAILURES = 3;

@Injectable()
export class EnvChallengeProvider implements ChallengeProvider {
  readonly configured: boolean;

  constructor(@Inject(ENV) env: Env) {
    this.configured = Boolean(env.CHALLENGE_SITE_KEY && env.CHALLENGE_SECRET);
  }

  // TODO(Q-034): call the verification endpoint of the service retained at deployment. Until then a configured
  // service refuses every proof, so suspect requests end « accepted with needsReview » after three attempts.
  async verify(_proof: string): Promise<boolean> {
    return false;
  }
}
