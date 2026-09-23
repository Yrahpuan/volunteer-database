const { DomainRuleError } = require('./domain-rule-error');

const ParticipationMode = Object.freeze({
  ALL_SCHEDULES: 'ALL_SCHEDULES',
  SELECTED_SCHEDULES: 'SELECTED_SCHEDULES',
});

function validateScheduleSelection({
  participationMode,
  selectedScheduleIds,
  availableScheduleIds,
}) {
  if (!Object.values(ParticipationMode).includes(participationMode)) {
    throw new DomainRuleError(
      'INVALID_PARTICIPATION_MODE',
      'Participation mode is not supported.',
    );
  }

  if (!Array.isArray(selectedScheduleIds) || !Array.isArray(availableScheduleIds)) {
    throw new DomainRuleError(
      'INVALID_SCHEDULE_LIST',
      'Selected and available schedules must be arrays of IDs.',
    );
  }

  if (participationMode === ParticipationMode.ALL_SCHEDULES) {
    if (selectedScheduleIds.length !== 0) {
      throw new DomainRuleError(
        'ALL_SCHEDULES_MUST_NOT_LIST_IDS',
        'ALL_SCHEDULES is represented by an empty selected schedule list.',
      );
    }
    return;
  }

  if (selectedScheduleIds.length === 0) {
    throw new DomainRuleError(
      'SCHEDULE_SELECTION_REQUIRED',
      'Select at least one schedule for SELECTED_SCHEDULES.',
    );
  }

  const available = new Set(availableScheduleIds);
  const invalidIds = selectedScheduleIds.filter((id) => !available.has(id));
  if (invalidIds.length > 0) {
    throw new DomainRuleError(
      'SCHEDULE_NOT_IN_ACTIVITY',
      `Schedule IDs do not belong to the activity: ${invalidIds.join(', ')}.`,
    );
  }
}

module.exports = { ParticipationMode, validateScheduleSelection };
