const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260923190000_init/migration.sql',
  'utf8',
);

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

test('initial migration creates the local tables and constraints', () => {
  for (const table of [
    'users',
    'volunteers',
    'volunteer_activities',
    'attendance_records',
    'document_types',
    'documents',
    'audit_logs',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  }

  assert.match(migration, /UNIQUE INDEX "volunteers_cpf_key" ON "volunteers"\("cpf"\)/);
  assert.match(migration, /UNIQUE INDEX "volunteer_activities_volunteer_id_erp_activity_id_key"/);
  assert.match(migration, /UNIQUE INDEX "attendance_records_volunteer_id_erp_schedule_id_occurrence__key"/);
});

test('initial migration does not add foreign keys to ERP-owned identifiers', () => {
  assert.doesNotMatch(migration, /FOREIGN KEY \("erp_activity_id"\)/);
  assert.doesNotMatch(migration, /FOREIGN KEY \("selected_schedule_ids"\)/);
  assert.doesNotMatch(migration, /FOREIGN KEY \("erp_schedule_id"\)/);
  assert.doesNotMatch(migration, /CREATE TABLE "activities"/);
  assert.doesNotMatch(migration, /CREATE TABLE "activity_schedules"/);
});
