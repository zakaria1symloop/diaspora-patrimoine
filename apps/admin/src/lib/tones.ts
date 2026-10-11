// DSN-015 — the tone of each value of each list of states (the table of 07-design/01). An enumeration absent from that
// table is never shown as a tag: it reads as plain text.
import type { StatusTone } from '@dp/ui';

export const USER_STATUS_TONE: Record<string, StatusTone> = { INVITED: 'pending', ACTIVE: 'success', SUSPENDED: 'warning', DELETED: 'inactive' };
export const LEAD_STATUS_TONE: Record<string, StatusTone> = { NEW: 'info', IN_PROGRESS: 'pending', CLOSED: 'neutral', SPAM: 'inactive' };
export const CLIENT_STATUS_TONE: Record<string, StatusTone> = { PROSPECT: 'neutral', QUALIFIED: 'info', ACTIVE: 'pending', CUSTOMER: 'success', INACTIVE: 'inactive', ARCHIVED: 'inactive' };
export const DOSSIER_STATUS_TONE: Record<string, StatusTone> = { OPEN: 'info', ON_HOLD: 'warning', WON: 'success', LOST: 'neutral' };
export const AVAILABILITY_TONE: Record<string, StatusTone> = { AVAILABLE: 'success', RESERVED: 'info', SOLD: 'neutral', WITHDRAWN: 'inactive' };
export const PUBLICATION_TONE: Record<string, StatusTone> = { DRAFT: 'neutral', PUBLISHED: 'success', ARCHIVED: 'inactive' };
