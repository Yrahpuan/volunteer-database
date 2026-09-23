import type { CrmVolunteerPayload, CrmVolunteerResponse } from '../src/integrations/crm/contracts';
import type { ErpActivitiesResponse, GetActivitiesParams } from '../src/integrations/erp/contracts';

const erpQuery: GetActivitiesParams = {
  page: 1,
  pageSize: 50,
  filters: { status: 'ACTIVE', instituteId: 'INST-PROTOTYPE-04' },
};

const erpActivities: ErpActivitiesResponse = {
  data: [{
    id: 'ACT-PROTOTYPE-100',
    name: 'Sopa Fraterna',
    instituteId: 'INST-PROTOTYPE-04',
    instituteName: 'Instituto da Caridade',
    status: 'ACTIVE',
    schedules: [{
      id: 'SCH-PROTOTYPE-001',
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '20:00',
      location: 'Salão Principal',
    }],
  }],
  meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
};

const crmRequest: CrmVolunteerPayload = {
  crmPersonId: 'CRM-PROTOTYPE-000123',
  fullName: 'Pessoa de Exemplo',
  cpf: '00000000000',
  email: 'pessoa@example.test',
  phone: '+5500000000000',
  birthDate: '1990-05-10',
  address: {
    street: 'Rua de Exemplo',
    number: '100',
    complement: null,
    neighborhood: 'Centro',
    city: 'Cidade de Exemplo',
    state: 'PI',
    postalCode: '00000000',
  },
  volunteerType: 'EFFECTIVE_MEMBER',
  source: 'CRM',
  occurredAt: '2026-09-23T14:30:00-03:00',
};

const crmResponse: CrmVolunteerResponse = {
  id: 'VOL-PROTOTYPE-000001',
  crmPersonId: 'CRM-PROTOTYPE-000123',
  cpf: '00000000000',
  fullName: 'Pessoa de Exemplo',
  volunteerType: 'EFFECTIVE_MEMBER',
  createdAt: '2026-09-23T17:30:00Z',
};

void [erpQuery, erpActivities, crmRequest, crmResponse];
