'use client';
// API-080 in the browser — one file in three steps: announce (name, type, exact size, SHA-256 computed here), send the
// bytes to the signed address with their progress, then « complete » (the API reads the real type, compares size and
// fingerprint, scans, processes). Shared by the media grid, the image slots and the photos of a point of progress.
import { CSRF_HEADER, csrfCookieName, type AdminMedia, type AdminMediaKind, type AdminMediaOwner, type MediaUploadResponse } from '@dp/contracts';
import { sha256Hex } from '@dp/ui';
import { adminCall, type CallResult } from '@/lib/admin-client';

export interface UploadTarget {
  ownerType: AdminMediaOwner;
  ownerId: string;
  kind: Exclude<AdminMediaKind, 'VIDEO'>;
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/** Step 2 with its progress (0 → 100). Resolves with the HTTP status (0 when the network failed). */
function put(url: string, file: File, onProgress: (pct: number) => void): Promise<number> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    const csrf = readCookie(csrfCookieName('ADMIN'));
    if (csrf) xhr.setRequestHeader(CSRF_HEADER, csrf);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => resolve(0);
    xhr.send(file);
  });
}

/** CTL-080 — the kind proposed for a dropped file (a PDF is a plan, unless a brochure was chosen). */
export function kindFor(file: File, chosen: UploadTarget['kind']): UploadTarget['kind'] {
  if (file.type === 'application/pdf' && chosen !== 'BROCHURE' && chosen !== 'PLAN') return 'PLAN';
  return chosen;
}

export async function uploadMedia(
  file: File,
  target: UploadTarget,
  onProgress: (pct: number) => void,
  extra: { roomLabel?: string | null; caption?: string | null } = {},
): Promise<CallResult<AdminMedia>> {
  const sha256 = await sha256Hex(await file.arrayBuffer());
  const announced = await adminCall<MediaUploadResponse>('/admin/media/uploads', {
    body: { ...target, fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size, sha256 },
  });
  if (!announced.ok) return announced;
  const status = await put(announced.data.uploadUrl, file, onProgress);
  if (status < 200 || status >= 300) return { ok: false, status, error: null, offline: status === 0 };
  onProgress(100);
  return adminCall<AdminMedia>(`/admin/media/uploads/${announced.data.id}/complete`, { body: extra });
}
