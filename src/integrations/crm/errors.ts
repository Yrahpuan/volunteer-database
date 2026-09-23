import type { ErrorResponse } from '../shared/errors';

export interface CrmInvalidPayloadErrorResponse {
  error: {
    code: 'INVALID_PAYLOAD';
    message: string;
    fields: Record<string, string>;
  };
}

export type CrmErrorResponse =
  | CrmInvalidPayloadErrorResponse
  | ErrorResponse<'CRM_PERSON_CONFLICT'>
  | ErrorResponse<'INVALID_INTEGRATION_TOKEN'>
  | ErrorResponse<'IDEMPOTENCY_KEY_CONFLICT'>
  | ErrorResponse<'CRM_INTEGRATION_UNAVAILABLE'>;

export interface CrmErrorsByStatus {
  400: CrmInvalidPayloadErrorResponse;
  413: CrmInvalidPayloadErrorResponse;
  401: ErrorResponse<'INVALID_INTEGRATION_TOKEN'>;
  409: ErrorResponse<'CRM_PERSON_CONFLICT'> | ErrorResponse<'IDEMPOTENCY_KEY_CONFLICT'>;
  503: ErrorResponse<'CRM_INTEGRATION_UNAVAILABLE'>;
}
