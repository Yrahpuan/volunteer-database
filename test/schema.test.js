const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const schema = readFileSync('prisma/schema.prisma', 'utf8');

function model(name) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `model ${name} must exist`);
  return match[1];
}

test('declares the local entities defined for the prototype', () => {
  for (const name of [
    'User',
    'Volunteer',
    'VolunteerActivity',
    'AttendanceRecord',
    'DocumentType',
    'Document',
    'AuditLog',
  ]) {
    assert.ok(model(name));
  }
});

test('does not duplicate ERP activities or schedules as local tables', () => {
  assert.doesNotMatch(schema, /\bmodel\s+(Activity|ActivitySchedule)\s*\{/);
  assert.match(model('VolunteerActivity'), /erpActivityId\s+String\s+@map\("erp_activity_id"\)/);
  assert.match(model('VolunteerActivity'), /selectedScheduleIds\s+String\[\]\s+@map\("selected_schedule_ids"\)/);
  assert.match(model('AttendanceRecord'), /erpScheduleId\s+String\s+@map\("erp_schedule_id"\)/);
});

test('enforces unique volunteer identity and one link per ERP activity', () => {
  assert.match(model('Volunteer'), /cpf\s+String\s+@unique/);
  assert.match(model('Volunteer'), /crmPersonId\s+String\?\s+@unique/);
  assert.match(model('VolunteerActivity'), /@@unique\(\[volunteerId, erpActivityId\]\)/);
});

test('prevents duplicate attendance for the same volunteer, ERP schedule, and date', () => {
  assert.match(model('AttendanceRecord'), /@@unique\(\[volunteerId, erpScheduleId, occurrenceDate\]\)/);
});

test('links local records with relations and keeps external ERP IDs scalar', () => {
  assert.match(model('VolunteerActivity'), /volunteer\s+Volunteer\s+@relation/);
  assert.match(model('AttendanceRecord'), /volunteerActivity\s+VolunteerActivity\s+@relation/);
  assert.match(model('VolunteerActivity'), /erpActivityId\s+String\s+@map\("erp_activity_id"\)/);
  assert.match(model('AttendanceRecord'), /erpScheduleId\s+String\s+@map\("erp_schedule_id"\)/);
});
