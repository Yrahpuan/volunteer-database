import type { CrmErrorsByStatus } from '../src/integrations/crm/errors';
import type { ErpErrorsByStatus } from '../src/integrations/erp/errors';

const erpUnauthorized: ErpErrorsByStatus[401] = {
  error: { code: 'ERP_UNAUTHORIZED', message: 'Unable to authenticate with ERP' },
};
const erpActivityNotFound: ErpErrorsByStatus[404] = {
  error: { code: 'ERP_ACTIVITY_NOT_FOUND', message: 'Activity not found in ERP' },
};
const erpUnavailable: ErpErrorsByStatus[503] = {
  error: { code: 'ERP_UNAVAILABLE', message: 'ERP service temporarily unavailable' },
};

const crmInvalidPayload: CrmErrorsByStatus[400] = {
  error: {
    code: 'INVALID_PAYLOAD',
    message: 'Request payload is invalid',
    fields: { cpf: 'CPF is required' },
  },
};
const crmPersonConflict: CrmErrorsByStatus[409] = {
  error: {
    code: 'CRM_PERSON_CONFLICT',
    message: 'CRM person is already associated with another volunteer',
  },
};
const crmInvalidToken: CrmErrorsByStatus[401] = {
  error: { code: 'INVALID_INTEGRATION_TOKEN', message: 'Invalid integration credentials' },
};
const crmIdempotencyConflict: CrmErrorsByStatus[409] = {
  error: { code: 'IDEMPOTENCY_KEY_CONFLICT', message: 'Idempotency key is already in use' },
};
const crmUnavailable: CrmErrorsByStatus[503] = {
  error: { code: 'CRM_INTEGRATION_UNAVAILABLE', message: 'CRM integration is temporarily unavailable' },
};

void [
  erpUnauthorized,
  erpActivityNotFound,
  erpUnavailable,
  crmInvalidPayload,
  crmPersonConflict,
  crmInvalidToken,
  crmIdempotencyConflict,
  crmUnavailable,
];
