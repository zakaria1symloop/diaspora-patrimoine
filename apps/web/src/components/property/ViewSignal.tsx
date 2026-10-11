'use client';
// FIC-100 — the cached page does not count the view: once loaded in a browser it sends one signal, without body.
// A failure is never shown to the visitor.
import { useEffect } from 'react';

export function ViewSignal({ reference }: { reference: string }) {
  useEffect(() => {
    void fetch(`/api/v1/public/properties/${encodeURIComponent(reference)}/view`, { method: 'POST', keepalive: true }).catch(() => undefined);
  }, [reference]);
  return null;
}
