import 'server-only';
import { cache } from 'react';
import type { PublicSettings } from '@dp/contracts';
import { apiGet } from './api';

/** PAR-101 — public settings (cached one minute at most, tag `settings`). */
export const getSettings = cache(() => apiGet<PublicSettings>('/public/settings/public', { tags: ['settings'] }));
