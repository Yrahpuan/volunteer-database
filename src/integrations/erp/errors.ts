import type { ErrorResponse } from '../shared/errors';

export type ErpErrorCode =
  | 'ERP_UNAUTHORIZED'
  | 'ERP_ACTIVITY_NOT_FOUND'
  | 'ERP_UNAVAILABLE';

export type ErpErrorResponse = ErrorResponse<ErpErrorCode>;

export interface ErpErrorsByStatus {
  401: ErrorResponse<'ERP_UNAUTHORIZED'>;
  404: ErrorResponse<'ERP_ACTIVITY_NOT_FOUND'>;
  503: ErrorResponse<'ERP_UNAVAILABLE'>;
}
