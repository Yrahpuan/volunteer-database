const assert = require('node:assert/strict');
const { test } = require('node:test');

const erpErrors = [
  require('../src/integrations/erp/examples/errors/unauthorized.json'),
  require('../src/integrations/erp/examples/errors/activity-not-found.json'),
  require('../src/integrations/erp/examples/errors/unavailable.json'),
];
const crmErrors = [
  require('../src/integrations/crm/examples/errors/invalid-payload.json'),
  require('../src/integrations/crm/examples/errors/person-conflict.json'),
  require('../src/integrations/crm/examples/errors/invalid-integration-token.json'),
];

test('ERP error examples use the documented error envelope and codes', () => {
  assert.deepEqual(erpErrors.map(({ error }) => error), [
    {
      code: 'ERP_UNAUTHORIZED',
      message: 'Unable to authenticate with ERP',
    },
    {
      code: 'ERP_ACTIVITY_NOT_FOUND',
      message: 'Activity not found in ERP',
    },
    {
      code: 'ERP_UNAVAILABLE',
      message: 'ERP service temporarily unavailable',
    },
  ]);
});

test('CRM error examples use the documented codes and field errors', () => {
  assert.deepEqual(crmErrors.map(({ error }) => error), [
    {
      code: 'INVALID_PAYLOAD',
      message: 'Request payload is invalid',
      fields: { cpf: 'CPF is required' },
    },
    {
      code: 'CRM_PERSON_CONFLICT',
      message: 'CRM person is already associated with another volunteer',
    },
    {
      code: 'INVALID_INTEGRATION_TOKEN',
      message: 'Invalid integration credentials',
    },
  ]);
});
