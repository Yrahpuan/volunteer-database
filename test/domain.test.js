const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertAttendanceAllowed } = require('../src/domain/attendance');
const { DomainRuleError } = require('../src/domain/domain-rule-error');
const {
  ParticipationMode,
  validateScheduleSelection,
} = require('../src/domain/volunteer-activity');

const availableScheduleIds = ['SCH-001', 'SCH-002', 'SCH-003'];

function assertRule(code, operation) {
  assert.throws(operation, (error) => {
    assert.ok(error instanceof DomainRuleError);
    assert.equal(error.code, code);
    return true;
  });
}

function activity(overrides = {}) {
  return {
    volunteerId: 'VOL-1',
    erpActivityId: 'ACT-1',
    participationMode: ParticipationMode.SELECTED_SCHEDULES,
    selectedScheduleIds: ['SCH-001', 'SCH-003'],
    ...overrides,
  };
}

function attendance(overrides = {}) {
  return {
    volunteerActivity: activity(),
    volunteerId: 'VOL-1',
    erpScheduleId: 'SCH-001',
    occurrenceDate: '2026-09-23',
    availableScheduleIds,
    existingRecords: [],
    ...overrides,
  };
}

test('accepts selected schedules that belong to the ERP activity', () => {
  assert.doesNotThrow(() => validateScheduleSelection({
    participationMode: ParticipationMode.SELECTED_SCHEDULES,
    selectedScheduleIds: ['SCH-001', 'SCH-003'],
    availableScheduleIds,
  }));
});

test('requires at least one schedule for SELECTED_SCHEDULES', () => {
  assertRule('SCHEDULE_SELECTION_REQUIRED', () => validateScheduleSelection({
    participationMode: ParticipationMode.SELECTED_SCHEDULES,
    selectedScheduleIds: [],
    availableScheduleIds,
  }));
});

test('rejects selected IDs that are not returned for the activity by the ERP', () => {
  assertRule('SCHEDULE_NOT_IN_ACTIVITY', () => validateScheduleSelection({
    participationMode: ParticipationMode.SELECTED_SCHEDULES,
    selectedScheduleIds: ['SCH-001', 'SCH-999'],
    availableScheduleIds,
  }));
});

test('represents ALL_SCHEDULES with an empty selected schedule list', () => {
  assert.doesNotThrow(() => validateScheduleSelection({
    participationMode: ParticipationMode.ALL_SCHEDULES,
    selectedScheduleIds: [],
    availableScheduleIds,
  }));
  assertRule('ALL_SCHEDULES_MUST_NOT_LIST_IDS', () => validateScheduleSelection({
    participationMode: ParticipationMode.ALL_SCHEDULES,
    selectedScheduleIds: ['SCH-001'],
    availableScheduleIds,
  }));
});

test('allows attendance on a selected schedule that belongs to the ERP activity', () => {
  assert.doesNotThrow(() => assertAttendanceAllowed(attendance()));
});

test('allows attendance on any valid ERP schedule for ALL_SCHEDULES', () => {
  assert.doesNotThrow(() => assertAttendanceAllowed(attendance({
    volunteerActivity: activity({
      participationMode: ParticipationMode.ALL_SCHEDULES,
      selectedScheduleIds: [],
    }),
    erpScheduleId: 'SCH-002',
  })));
});

test('rejects attendance for a schedule that is not in the ERP activity', () => {
  assertRule('SCHEDULE_NOT_IN_ACTIVITY', () => assertAttendanceAllowed(attendance({
    erpScheduleId: 'SCH-999',
  })));
});

test('rejects attendance on an ERP schedule not selected by the volunteer', () => {
  assertRule('SCHEDULE_NOT_SELECTED', () => assertAttendanceAllowed(attendance({
    erpScheduleId: 'SCH-002',
  })));
});

test('rejects attendance when the volunteer differs from the volunteer activity', () => {
  assertRule('VOLUNTEER_ACTIVITY_MISMATCH', () => assertAttendanceAllowed(attendance({
    volunteerId: 'VOL-2',
  })));
});

test('rejects duplicate attendance for the volunteer, ERP schedule, and date', () => {
  assertRule('ATTENDANCE_ALREADY_RECORDED', () => assertAttendanceAllowed(attendance({
    existingRecords: [{
      volunteerId: 'VOL-1',
      erpScheduleId: 'SCH-001',
      occurrenceDate: new Date('2026-09-23T00:00:00.000Z'),
    }],
  })));
});

test('allows attendance on a different date or a different schedule', () => {
  assert.doesNotThrow(() => assertAttendanceAllowed(attendance({
    existingRecords: [{
      volunteerId: 'VOL-1',
      erpScheduleId: 'SCH-001',
      occurrenceDate: '2026-09-22',
    }],
  })));
  assert.doesNotThrow(() => assertAttendanceAllowed(attendance({
    erpScheduleId: 'SCH-003',
    existingRecords: [{
      volunteerId: 'VOL-1',
      erpScheduleId: 'SCH-001',
      occurrenceDate: '2026-09-23',
    }],
  })));
});

test('rejects malformed occurrence dates', () => {
  assertRule('INVALID_OCCURRENCE_DATE', () => assertAttendanceAllowed(attendance({
    occurrenceDate: '2026-02-30',
  })));
});
