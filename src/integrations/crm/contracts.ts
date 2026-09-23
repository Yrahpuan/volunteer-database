/**
 * Provisional contracts for the CRM volunteer upsert.
 * Confirm field names, required fields, authentication, and idempotency
 * behavior against the CRM API specification before connecting to production.
 */
export type VolunteerType = 'REGISTERED_MEMBER' | 'EFFECTIVE_MEMBER';

export interface CrmVolunteerAddress {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export interface CrmVolunteerPayload {
  crmPersonId: string;
  fullName: string;
  cpf: string;
  email?: string | null;
  phone?: string | null;
  /** Provisional ISO 8601 calendar-date representation. */
  birthDate?: string | null;
  address?: CrmVolunteerAddress | null;
  volunteerType: VolunteerType;
  source: 'CRM';
  /** Provisional ISO 8601 timestamp representation. */
  occurredAt: string;
}

export interface CrmVolunteerRequestHeaders {
  Authorization: `Bearer ${string}`;
  'Content-Type': 'application/json';
  'Idempotency-Key': string;
}

export interface CrmVolunteerResponse {
  id: string;
  crmPersonId: string;
  cpf: string;
  fullName: string;
  volunteerType: VolunteerType;
  createdAt: string;
}
