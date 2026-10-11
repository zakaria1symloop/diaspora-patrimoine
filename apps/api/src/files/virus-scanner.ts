// MED-021, MED-035 — every received file is scanned before it serves. The ClamAV implementation comes with the
// hosted environments; locally (APP_ENV=local, no ClamAV) an "always clean" scanner is used, and says so in the log.
// Anywhere else without a scanner, the result is ERROR: the file stays PENDING, never READY unscanned.
import { log } from '../platform/request-context.js';

export type ScanResult = 'CLEAN' | 'INFECTED' | 'ERROR';

export interface VirusScanner {
  readonly name: string;
  scan(body: Buffer): Promise<ScanResult>;
}

export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');

export class LocalAlwaysCleanScanner implements VirusScanner {
  readonly name = 'local-always-clean';
  private warned = false;

  async scan(): Promise<ScanResult> {
    if (!this.warned) {
      log('warn', 'antivirus.local_stub', { note: 'APP_ENV=local: no antivirus, files are considered clean (MED-021 stub)' });
      this.warned = true;
    }
    return 'CLEAN';
  }
}

export class UnavailableScanner implements VirusScanner {
  readonly name = 'unavailable';
  async scan(): Promise<ScanResult> {
    log('error', 'antivirus.unavailable', {});
    return 'ERROR';
  }
}

export function scannerFor(appEnv: string): VirusScanner {
  return appEnv === 'local' ? new LocalAlwaysCleanScanner() : new UnavailableScanner();
}
