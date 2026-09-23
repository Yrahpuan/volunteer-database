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
  | ErrorResponse<'INVALID_INTEGRATION_TOKEN'>;

export interface CrmErrorsByStatus {
  400: CrmInvalidPayloadErrorResponse;
  401: ErrorResponse<'INVALID_INTEGRATION_TOKEN'>;
  409: ErrorResponse<'CRM_PERSON_CONFLICT'>;
}
