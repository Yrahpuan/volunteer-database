const assert = require('node:assert/strict');
const { randomInt, randomUUID } = require('node:crypto');
const { test } = require('node:test');

const databaseUrl = process.env.DATABASE_URL;

test('PostgreSQL enforces uniqueness, relations, and referential actions', {
  skip: databaseUrl ? false : 'Set DATABASE_URL and apply migrations to run database integration tests.',
}, async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let volunteerId;
  let userId;

  try {
    await prisma.$connect();

    const volunteer = await prisma.volunteer.create({
      data: {
        fullName: 'Integration Test Volunteer',
        cpf: randomInt(0, 100_000_000_000).toString().padStart(11, '0'),
        crmPersonId: `CRM-${randomUUID()}`,
        volunteerType: 'REGISTERED_MEMBER',
      },
    });
    volunteerId = volunteer.id;

    await assert.rejects(
      prisma.volunteer.create({
        data: {
          fullName: 'Duplicate CPF Volunteer',
          cpf: volunteer.cpf,
          volunteerType: 'REGISTERED_MEMBER',
        },
      }),
      (error) => error.code === 'P2002',
    );
    await assert.rejects(
      prisma.volunteer.create({
        data: {
          fullName: 'Duplicate CRM Volunteer',
          cpf: randomInt(0, 100_000_000_000).toString().padStart(11, '0'),
          crmPersonId: volunteer.crmPersonId,
          volunteerType: 'REGISTERED_MEMBER',
        },
      }),
      (error) => error.code === 'P2002',
    );

    await assert.rejects(
      prisma.volunteerActivity.create({
        data: {
          volunteerId: randomUUID(),
          erpActivityId: `ACT-${randomUUID()}`,
          participationMode: 'ALL_SCHEDULES',
          selectedScheduleIds: [],
        },
      }),
      (error) => error.code === 'P2003',
    );

    const volunteerActivity = await prisma.volunteerActivity.create({
      data: {
        volunteerId,
        erpActivityId: `ACT-${volunteerId}`,
        participationMode: 'ALL_SCHEDULES',
        selectedScheduleIds: [],
      },
    });

    await assert.rejects(
      prisma.volunteerActivity.create({
        data: {
          volunteerId,
          erpActivityId: volunteerActivity.erpActivityId,
          participationMode: 'ALL_SCHEDULES',
          selectedScheduleIds: [],
        },
      }),
      (error) => error.code === 'P2002',
    );

    const attendance = {
      volunteerId,
      volunteerActivityId: volunteerActivity.id,
      erpScheduleId: 'SCH-001',
      occurrenceDate: new Date('2026-09-23T00:00:00.000Z'),
      status: 'PRESENT',
    };

    await prisma.attendanceRecord.create({ data: attendance });

    await assert.rejects(
      prisma.attendanceRecord.create({ data: attendance }),
      (error) => error.code === 'P2002',
    );

    await prisma.attendanceRecord.create({
      data: { ...attendance, erpScheduleId: 'SCH-002' },
    });
    await prisma.attendanceRecord.create({
      data: {
        ...attendance,
        occurrenceDate: new Date('2026-09-24T00:00:00.000Z'),
      },
    });

    await assert.rejects(
      prisma.attendanceRecord.create({
        data: {
          ...attendance,
          volunteerActivityId: randomUUID(),
          erpScheduleId: 'SCH-INVALID-FK',
        },
      }),
      (error) => error.code === 'P2003',
    );

    const attendanceCount = await prisma.attendanceRecord.count({ where: { volunteerId } });
    assert.equal(attendanceCount, 3);

    const user = await prisma.user.create({
      data: {
        email: `integration-${randomUUID()}@example.test`,
        passwordHash: 'test-only-not-a-real-password-hash',
        role: 'VOLUNTEER',
        volunteerId,
      },
    });
    userId = user.id;

    await prisma.volunteer.delete({ where: { id: volunteerId } });
    volunteerId = undefined;

    assert.equal(await prisma.volunteerActivity.count({ where: { volunteerId: volunteer.id } }), 0);
    assert.equal(await prisma.attendanceRecord.count({ where: { volunteerId: volunteer.id } }), 0);
    assert.equal((await prisma.user.findUnique({ where: { id: userId } })).volunteerId, null);
  } finally {
    if (volunteerId) {
      await prisma.volunteer.delete({ where: { id: volunteerId } });
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  }
});
