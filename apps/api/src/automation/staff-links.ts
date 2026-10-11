// NOT-030 § 3.2 — « the link of a staff notification leads to the object it names ». Paths of the back office, kept in
// one place: the request and the dossier by their reference (as `S_LEAD_NEW` does), the others by their id.
type Row = Record<string, unknown>;

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Path of an object in the back office, or null when it has no page of its own. */
export function staffLink(entityType: string, row: Row): string | null {
  const id = text(row.id);
  const reference = text(row.reference);
  switch (entityType) {
    case 'Lead':
      return reference ? `/demandes/${reference}` : null;
    case 'Dossier':
      return reference ? `/dossiers/${reference}` : null;
    case 'Client':
      return id ? `/clients/${id}` : null;
    case 'Task':
      return id ? `/taches?tache=${id}` : null;
    case 'Event':
      return id ? `/cafes/${id}` : null;
    case 'EventRegistration':
      return text(row.eventId) ? `/cafes/${text(row.eventId)}` : null;
    case 'Property':
      return id ? `/catalogue/biens/${id}` : null;
    case 'Program':
      return id ? `/catalogue/programmes/${id}` : null;
    case 'Promoter':
      return id ? `/promoteurs/${id}` : null;
    case 'Bank':
      return id ? `/banques/${id}` : null;
    default:
      return null;
  }
}

export const taskLink = (taskId: string): string => `/taches?tache=${taskId}`;
