const assert = require('node:assert/strict');
const { test } = require('node:test');
const erpActivities = require('../src/integrations/erp/examples/activities.response.json');
const crmRequest = require('../src/integrations/crm/examples/volunteer.request.json');
const crmResponse = require('../src/integrations/crm/examples/volunteer.response.json');

const isString = (value) => typeof value === 'string';
const isOptionalString = (value) => value === null || isString(value);

test('ERP JSON example follows the provisional activities response shape', () => {
  assert.ok(Array.isArray(erpActivities.data));
  assert.deepEqual(Object.keys(erpActivities.meta).sort(), [
    'page',
    'pageSize',
    'total',
    'totalPages',
  ]);
  for (const value of Object.values(erpActivities.meta)) {
    assert.equal(Number.isInteger(value), true);
  }

  for (const activity of erpActivities.data) {
    assert.equal(isString(activity.id), true);
    assert.equal(isString(activity.name), true);
    assert.equal(isString(activity.instituteId), true);
    assert.ok(['ACTIVE', 'INACTIVE'].includes(activity.status));
    assert.ok(Array.isArray(activity.schedules));
    for (const schedule of activity.schedules) {
      assert.equal(isString(schedule.id), true);
      assert.equal(Number.isInteger(schedule.dayOfWeek), true);
      assert.match(schedule.startTime, /^\d{2}:\d{2}$/);
      assert.match(schedule.endTime, /^\d{2}:\d{2}$/);
    }
  }
});

test('CRM JSON request example follows the provisional upsert payload shape', () => {
  assert.equal(isString(crmRequest.crmPersonId), true);
  assert.equal(isString(crmRequest.fullName), true);
  assert.equal(isString(crmRequest.cpf), true);
  assert.ok(['REGISTERED_MEMBER', 'EFFECTIVE_MEMBER'].includes(crmRequest.volunteerType));
  assert.equal(crmRequest.source, 'CRM');
  assert.equal(Number.isNaN(Date.parse(crmRequest.occurredAt)), false);

  if (crmRequest.birthDate !== null) {
    assert.match(crmRequest.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  if (crmRequest.address !== null) {
    for (const value of Object.values(crmRequest.address)) {
      assert.equal(isOptionalString(value), true);
    }
  }
});

test('CRM JSON response example follows the provisional response shape', () => {
  assert.equal(isString(crmResponse.id), true);
  assert.equal(isString(crmResponse.crmPersonId), true);
  assert.equal(isString(crmResponse.cpf), true);
  assert.equal(isString(crmResponse.fullName), true);
  assert.ok(['REGISTERED_MEMBER', 'EFFECTIVE_MEMBER'].includes(crmResponse.volunteerType));
  assert.equal(Number.isNaN(Date.parse(crmResponse.createdAt)), false);
});
