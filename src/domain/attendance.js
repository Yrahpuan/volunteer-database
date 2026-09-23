const { DomainRuleError } = require('./domain-rule-error');
const { ParticipationMode } = require('./volunteer-activity');

function normalizeDate(value) {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DomainRuleError('INVALID_OCCURRENCE_DATE', 'Occurrence date must use YYYY-MM-DD.');
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new DomainRuleError('INVALID_OCCURRENCE_DATE', 'Occurrence date must be a valid calendar date.');
  }
  return date;
}

function assertAttendanceAllowed({
  volunteerActivity,
  volunteerId,
  erpScheduleId,
  occurrenceDate,
  availableScheduleIds,
  existingRecords = [],
}) {
  if (!volunteerActivity || !Array.isArray(availableScheduleIds) || !Array.isArray(existingRecords)) {
    throw new DomainRuleError('INVALID_ATTENDANCE_CONTEXT', 'Attendance context is incomplete.');
  }

  if (volunteerActivity.volunteerId !== volunteerId) {
    throw new DomainRuleError(
      'VOLUNTEER_ACTIVITY_MISMATCH',
      'Attendance volunteer must match the volunteer activity.',
    );
  }

  if (!availableScheduleIds.includes(erpScheduleId)) {
    throw new DomainRuleError(
      'SCHEDULE_NOT_IN_ACTIVITY',
      'Attendance schedule does not belong to the ERP activity.',
    );
  }

  if (volunteerActivity.participationMode === ParticipationMode.SELECTED_SCHEDULES) {
    if (!volunteerActivity.selectedScheduleIds?.includes(erpScheduleId)) {
      throw new DomainRuleError(
        'SCHEDULE_NOT_SELECTED',
        'Attendance schedule is not selected for this volunteer.',
      );
    }
  } else if (volunteerActivity.participationMode !== ParticipationMode.ALL_SCHEDULES) {
    throw new DomainRuleError(
      'INVALID_PARTICIPATION_MODE',
      'Volunteer activity has an unsupported participation mode.',
    );
  }

  const dateKey = normalizeDate(occurrenceDate);
  const duplicate = existingRecords.some((record) => (
    record.volunteerId === volunteerId
    && record.erpScheduleId === erpScheduleId
    && normalizeDate(record.occurrenceDate) === dateKey
  ));
  if (duplicate) {
    throw new DomainRuleError(
      'ATTENDANCE_ALREADY_RECORDED',
      'Attendance already exists for this volunteer, schedule, and date.',
    );
  }
}

module.exports = { assertAttendanceAllowed, normalizeDate };
