// MED-021, MED-035 — every received file is scanned before it serves. The ClamAV implementation comes with the
// hosted environments; locally (APP_ENV=local, no ClamAV) an "always clean" scanner is used, and says so in the log.
// Anywhere else without a scanner, the result is ERROR: the file stays PENDING, never READY unscanned — except on a
// test server (preview, staging) that declares VIRUS_SCAN_STUB=true while ClamAV is not wired (Q-096); refused in production.
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
      log('warn', 'antivirus.local_stub', { note: 'no antivirus (APP_ENV=local or VIRUS_SCAN_STUB=true): files are considered clean (MED-021 stub, Q-096)' });
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

export function scannerFor(appEnv: string, stub: boolean = process.env.VIRUS_SCAN_STUB === 'true'): VirusScanner {
  if (appEnv === 'local') return new LocalAlwaysCleanScanner();
  if (stub && appEnv !== 'production') return new LocalAlwaysCleanScanner();
  return new UnavailableScanner();
}
