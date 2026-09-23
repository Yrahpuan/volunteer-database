# Banco de Dados e Integrações — Sistema de Voluntários

## 3. Banco de Dados e Integrações

### 3.1 Premissas arquiteturais

#### Sistemas e responsabilidades

| Sistema | Responsabilidade |
|---|---|
| **ERP** | Atividades, horários e dados próprios da atividade |
| **Sistema de Voluntários** | Voluntários, vínculos, seleção de horários, frequência e documentos |
| **CRM** | Cadastro/origem de pessoas que também podem se tornar voluntárias |
| **Redis** | Cache das consultas de atividades/horários do ERP |

O Sistema de Voluntários deve consumir as atividades via API REST/JSON do ERP.

### Regra fundamental

**Não criar `Activity` ou `ActivitySchedule` no banco local.**

O banco local somente armazenará referências externas vindas do ERP:

```text
VolunteerActivity
 ├── volunteer_id
 ├── erp_activity_id
 └── selected_schedule_ids[]
```

Os `selected_schedule_ids` deverão corresponder exclusivamente aos IDs de horários retornados pelo ERP.

Isso implementa diretamente as regras de que os horários escolhidos devem ser derivados dos horários da atividade e que o sistema não deve criar horários independentes.

---

# 3.2 Modelo físico

## Entidades locais

```text
users
volunteers
volunteer_activities
attendance_records
document_types
documents
audit_logs
```

### Relações principais

```text
Volunteer
    │
    ├──< VolunteerActivity >── ERP Activity ID
    │             │
    │             └── selectedScheduleIds
    │
    ├──< AttendanceRecord
    │
    └──< Document >── DocumentType

User
    └──< AuditLog
```

Não existe FK física para `erp_activity_id` ou `schedule_id`, porque esses registros não pertencem ao PostgreSQL local.

---

# 3.3 `schema.prisma`

**[SUPOSIÇÃO]** Como o documento não informa o tipo dos IDs do ERP, eles serão tratados como `String`. Isso permite trabalhar com UUID, códigos numéricos ou IDs alfanuméricos sem acoplar o banco a uma implementação específica do ERP.

Se a API do ERP confirmar que os IDs são inteiros ou UUID, basta alterar o tipo.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  INSTITUTE_COORDINATOR
  VOLUNTEER
}

enum VolunteerType {
  REGISTERED_MEMBER
  EFFECTIVE_MEMBER
}

enum VolunteerActivityStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum ParticipationMode {
  ALL_SCHEDULES
  SELECTED_SCHEDULES
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  JUSTIFIED
}

enum DocumentStatus {
  PENDING
  VALID
  EXPIRING
  EXPIRED
  REJECTED
}

enum DocumentAccessLevel {
  VOLUNTEER
  COORDINATOR
  ADMIN
}

enum DocumentTypeCode {
  BACKGROUND_CHECK
  VOLUNTEER_AGREEMENT
  LGPD_CONSENT
  FOOD_HANDLING
  DRIVER_RESPONSIBILITY
  CONFIDENTIALITY
  IMAGE_USAGE
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  role         UserRole
  volunteerId  String?  @unique @map("volunteer_id") @db.Uuid
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  volunteer Volunteer? @relation(fields: [volunteerId], references: [id])
  auditLogs AuditLog[]

  @@map("users")
}

model Volunteer {
  id                    String        @id @default(uuid()) @db.Uuid
  crmPersonId           String?       @unique @map("crm_person_id")
  fullName              String        @map("full_name")
  cpf                   String        @unique
  email                 String?
  phone                 String?
  birthDate             DateTime?     @map("birth_date") @db.Date

  street                String?
  number                String?
  complement            String?
  neighborhood          String?
  city                  String?
  state                 String?
  postalCode            String?       @map("postal_code")

  emergencyContactName  String?       @map("emergency_contact_name")
  emergencyContactPhone String?       @map("emergency_contact_phone")

  volunteerType         VolunteerType @map("volunteer_type")

  isActive              Boolean       @default(true) @map("is_active")

  createdAt             DateTime      @default(now()) @map("created_at")
  updatedAt             DateTime      @updatedAt @map("updated_at")

  user                  User?
  activities            VolunteerActivity[]
  attendanceRecords     AttendanceRecord[]
  documents             Document[]

  @@index([fullName])
  @@index([crmPersonId])
  @@index([volunteerType])
  @@map("volunteers")
}

model VolunteerActivity {
  id                   String                  @id @default(uuid()) @db.Uuid
  volunteerId          String                  @map("volunteer_id") @db.Uuid

  // External reference owned by ERP.
  erpActivityId        String                  @map("erp_activity_id")

  // IDs of schedules owned by ERP.
  selectedScheduleIds  String[]                @map("selected_schedule_ids")

  participationMode    ParticipationMode       @map("participation_mode")

  status               VolunteerActivityStatus @default(ACTIVE)

  startedAt            DateTime                @default(now()) @map("started_at")
  endedAt              DateTime?               @map("ended_at")

  createdAt             DateTime                @default(now()) @map("created_at")
  updatedAt             DateTime                @updatedAt @map("updated_at")

  volunteer            Volunteer               @relation(
    fields: [volunteerId],
    references: [id],
    onDelete: Cascade
  )

  attendanceRecords    AttendanceRecord[]

  @@unique([volunteerId, erpActivityId])
  @@index([erpActivityId])
  @@index([volunteerId, status])
  @@map("volunteer_activities")
}

model AttendanceRecord {
  id                  String   @id @default(uuid()) @db.Uuid
  volunteerId         String   @map("volunteer_id") @db.Uuid
  volunteerActivityId String   @map("volunteer_activity_id") @db.Uuid

  // Schedule ID comes from ERP.
  erpScheduleId       String   @map("erp_schedule_id")

  occurrenceDate      DateTime @map("occurrence_date") @db.Date
  status              AttendanceStatus

  notes               String?

  recordedByUserId    String?  @map("recorded_by_user_id") @db.Uuid

  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  volunteer            Volunteer         @relation(
    fields: [volunteerId],
    references: [id],
    onDelete: Cascade
  )

  volunteerActivity    VolunteerActivity @relation(
    fields: [volunteerActivityId],
    references: [id],
    onDelete: Cascade
  )

  @@unique([
    volunteerId,
    erpScheduleId,
    occurrenceDate
  ])

  @@index([volunteerId, occurrenceDate])
  @@index([erpScheduleId, occurrenceDate])
  @@map("attendance_records")
}

model DocumentType {
  id                  String              @id @default(uuid()) @db.Uuid
  code                DocumentTypeCode    @unique
  name                String
  description         String?
  required            Boolean             @default(false)
  defaultValidityDays Int?                @map("default_validity_days")
  accessLevel         DocumentAccessLevel @default(ADMIN) @map("access_level")

  documents            Document[]

  @@map("document_types")
}

model Document {
  id                 String         @id @default(uuid()) @db.Uuid
  volunteerId        String         @map("volunteer_id") @db.Uuid
  documentTypeId     String         @map("document_type_id") @db.Uuid

  fileName           String         @map("file_name")
  storageKey         String         @map("storage_key")
  mimeType           String         @map("mime_type")
  fileSize           Int            @map("file_size")

  issueDate          DateTime?      @map("issue_date") @db.Date
  expirationDate     DateTime?      @map("expiration_date") @db.Date

  certificateNumber  String?        @map("certificate_number")

  status             DocumentStatus @default(PENDING)

  uploadedAt         DateTime       @default(now()) @map("uploaded_at")
  updatedAt          DateTime       @updatedAt @map("updated_at")

  volunteer          Volunteer      @relation(
    fields: [volunteerId],
    references: [id],
    onDelete: Cascade
  )

  documentType       DocumentType   @relation(
    fields: [documentTypeId],
    references: [id]
  )

  @@index([volunteerId])
  @@index([documentTypeId])
  @@index([expirationDate])
  @@index([status])
  @@map("documents")
}

model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String?  @map("user_id") @db.Uuid

  action      String
  entity      String
  entityId    String?  @map("entity_id")

  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")

  metadata    Json?

  createdAt   DateTime @default(now()) @map("created_at")

  user        User? @relation(
    fields: [userId],
    references: [id],
    onDelete: SetNull
  )

  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

# 3.4 Ponto importante: `VolunteerActivity`

A tabela física fica deliberadamente assim:

```text
volunteer_activities
--------------------------------
id
volunteer_id
erp_activity_id
selected_schedule_ids[]
participation_mode
status
started_at
ended_at
created_at
updated_at
```

### Exemplo

O ERP retorna:

```json
{
  "id": "ACT-100",
  "name": "Sopa Fraterna",
  "instituteId": "INST-04",
  "instituteName": "Instituto da Caridade",
  "status": "ACTIVE",
  "schedules": [
    {
      "id": "SCH-001",
      "dayOfWeek": 1,
      "startTime": "18:00",
      "endTime": "20:00"
    },
    {
      "id": "SCH-002",
      "dayOfWeek": 3,
      "startTime": "18:00",
      "endTime": "20:00"
    },
    {
      "id": "SCH-003",
      "dayOfWeek": 5,
      "startTime": "18:00",
      "endTime": "20:00"
    }
  ]
}
```

Se o voluntário escolher somente segunda e sexta:

```json
{
  "volunteerId": "uuid-do-voluntario",
  "erpActivityId": "ACT-100",
  "participationMode": "SELECTED_SCHEDULES",
  "selectedScheduleIds": [
    "SCH-001",
    "SCH-003"
  ]
}
```

**Não será criado:**

```text
activities
activity_schedules
```

Isso mantém a fonte de verdade no ERP.

---

# 3.5 Regra de integridade dos horários

Existe uma limitação importante do PostgreSQL nesse desenho: como `SCH-001` pertence ao ERP, o PostgreSQL local **não consegue criar uma FK física para ele**.

Portanto, a validação deve ocorrer na aplicação:

```text
1. Usuário escolhe atividade ERP.
2. Backend consulta atividade no ERP/cache.
3. Backend obtém os schedule IDs válidos.
4. Usuário seleciona horários.
5. Backend compara os IDs selecionados com os IDs retornados pelo ERP.
6. Se algum ID não existir na atividade:
      rejeitar operação.
7. Caso todos sejam válidos:
      gravar VolunteerActivity.
```

### Regra

```text
selectedScheduleIds ⊆ ERP.activity.schedules[].id
```

---

# 4. Integração ERP → Sistema de Voluntários

## 4.1 GET de atividades

**[SUPOSIÇÃO]** A rota exata ainda não foi definida no material. Portanto, não deve ser considerada a rota real do ERP.

Contrato lógico:

```http
GET /activities
```

ou, caso o ERP utilize outro padrão:

```http
GET /api/activities
```

O importante para o contrato interno é a estrutura.

---

## 4.2 Interface TypeScript

```typescript
export interface ErpActivity {
  id: string;
  name: string;
  instituteId: string;
  instituteName?: string;
  status: "ACTIVE" | "INACTIVE";

  schedules: ErpActivitySchedule[];
}

export interface ErpActivitySchedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
}
```

### Response

```typescript
export interface ErpActivitiesResponse {
  data: ErpActivity[];

  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

JSON:

```json
{
  "data": [
    {
      "id": "ACT-100",
      "name": "Sopa Fraterna",
      "instituteId": "INST-04",
      "instituteName": "Instituto da Caridade",
      "status": "ACTIVE",
      "schedules": [
        {
          "id": "SCH-001",
          "dayOfWeek": 1,
          "startTime": "18:00",
          "endTime": "20:00",
          "location": "Salão Principal"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

# 4.3 Cache Redis

O fluxo recomendado:

```text
                    ┌───────────────┐
                    │ Sistema Web   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Backend       │
                    └───────┬───────┘
                            │
                     procura cache
                            │
                   ┌────────▼────────┐
                   │      Redis      │
                   └───────┬─────────┘
                           │
                 ┌─────────┴─────────┐
                 │                   │
              CACHE HIT          CACHE MISS
                 │                   │
                 ▼                   ▼
              retorna           consulta ERP
                                     │
                                     ▼
                                   Redis
                                     │
                                     ▼
                                  retorna
```

### Chave sugerida

```text
erp:activities:{page}:{pageSize}:{filtersHash}
```

Exemplo:

```text
erp:activities:1:50:a82f91
```

### TTL

**[SUPOSIÇÃO]** Recomenda-se começar com:

```text
TTL = 5 minutos
```

O TTL deve ser configurável:

```env
ERP_ACTIVITIES_CACHE_TTL_SECONDS=300
```

---

# 4.4 Serviço de integração

```typescript
interface ErpActivityService {
  getActivities(
    params: GetActivitiesParams
  ): Promise<ErpActivitiesResponse>;

  getActivityById(
    activityId: string
  ): Promise<ErpActivity>;

  validateScheduleIds(
    activityId: string,
    scheduleIds: string[]
  ): Promise<boolean>;
}
```

### Estratégia

```typescript
async function getActivityById(
  activityId: string
): Promise<ErpActivity> {

  const cacheKey = `erp:activity:${activityId}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const activity = await erpClient.getActivity(activityId);

  await redis.set(
    cacheKey,
    JSON.stringify(activity),
    { EX: ERP_CACHE_TTL }
  );

  return activity;
}
```

---

# 5. Integração CRM → Sistema de Voluntários

O CRM pode encaminhar uma pessoa quando um doador também se tornar voluntário.

O endpoint deve ser pensado como **upsert**, e não simplesmente "criar".

## 5.1 Endpoint

```http
POST /api/integrations/crm/volunteers
```

### Autenticação

```http
Authorization: Bearer <CRM_INTEGRATION_TOKEN>
Content-Type: application/json
Idempotency-Key: <unique-key>
```

---

# 5.2 Payload CRM → Voluntários

```typescript
export interface CrmVolunteerPayload {
  crmPersonId: string;

  fullName: string;

  cpf: string;

  email?: string | null;

  phone?: string | null;

  birthDate?: string | null;

  address?: {
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  } | null;

  volunteerType: "REGISTERED_MEMBER" | "EFFECTIVE_MEMBER";

  source: "CRM";

  occurredAt: string;
}
```

### JSON

```json
{
  "crmPersonId": "CRM-000123",
  "fullName": "João da Silva",
  "cpf": "12345678900",
  "email": "joao@email.com",
  "phone": "86999999999",
  "birthDate": "1990-05-10",
  "address": {
    "street": "Rua Exemplo",
    "number": "100",
    "complement": null,
    "neighborhood": "Centro",
    "city": "Parnaíba",
    "state": "PI",
    "postalCode": "64200000"
  },
  "volunteerType": "EFFECTIVE_MEMBER",
  "source": "CRM",
  "occurredAt": "2026-09-23T14:30:00-03:00"
}
```

---

# 5.3 Response 201

```typescript
export interface CrmVolunteerResponse {
  id: string;
  crmPersonId: string;
  cpf: string;
  fullName: string;
  volunteerType: "REGISTERED_MEMBER" | "EFFECTIVE_MEMBER";
  createdAt: string;
}
```

```json
{
  "id": "8f87c5a0-7f3b-4b2e-9c1e-123456789abc",
  "crmPersonId": "CRM-000123",
  "cpf": "12345678900",
  "fullName": "João da Silva",
  "volunteerType": "EFFECTIVE_MEMBER",
  "createdAt": "2026-09-23T14:30:00Z"
}
```

---

# 5.4 Comportamento do POST

O CPF e/ou `crmPersonId` devem impedir duplicação.

```text
CRM
 │
 │ POST
 ▼
Sistema de Voluntários
 │
 ├── valida autenticação
 │
 ├── valida payload
 │
 ├── procura crmPersonId
 │
 ├── se não encontrou
 │      └── procura CPF
 │
 ├── se não encontrou
 │      └── CREATE Volunteer
 │
 └── se encontrou
        └── UPDATE Volunteer
```

### Regra

```text
crmPersonId = identificador da pessoa no CRM
cpf          = identificador de negócio da pessoa
```

Não devemos confiar somente no CPF como chave técnica do relacionamento entre sistemas.

---

# 6. Contrato de erros

## ERP

### 401

```json
{
  "error": {
    "code": "ERP_UNAUTHORIZED",
    "message": "Unable to authenticate with ERP"
  }
}
```

### 404

```json
{
  "error": {
    "code": "ERP_ACTIVITY_NOT_FOUND",
    "message": "Activity not found in ERP"
  }
}
```

### 503

```json
{
  "error": {
    "code": "ERP_UNAVAILABLE",
    "message": "ERP service temporarily unavailable"
  }
}
```

---

## CRM

### 400

```json
{
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "Request payload is invalid",
    "fields": {
      "cpf": "CPF is required"
    }
  }
}
```

### 409

```json
{
  "error": {
    "code": "CRM_PERSON_CONFLICT",
    "message": "CRM person is already associated with another volunteer"
  }
}
```

### 401

```json
{
  "error": {
    "code": "INVALID_INTEGRATION_TOKEN",
    "message": "Invalid integration credentials"
  }
}
```

---

# 7. Fluxo de vínculo voluntário + ERP

Esse é um dos fluxos mais importantes do sistema.

```text
                    VOLUNTÁRIO
                        │
                        ▼
              Seleciona atividade
                        │
                        ▼
             Backend consulta ERP
                        │
                        ▼
                 Redis possui?
                  /          \
                SIM           NÃO
                 │             │
                 │          consulta ERP
                 │             │
                 │          salva Redis
                 │             │
                 └──────┬──────┘
                        ▼
                 Lista horários
                        │
                        ▼
             Voluntário seleciona
              um ou mais horários
                        │
                        ▼
              Backend valida IDs
                        │
              ┌─────────┴─────────┐
              │                   │
           inválido             válido
              │                   │
            rejeita               ▼
                         grava VolunteerActivity
```

---

# 8. Regra para `ALL_SCHEDULES`

Quando o voluntário escolher **todos os horários**, não depender apenas de `selectedScheduleIds` para representar todos.

Nesse caso:

```json
{
  "erpActivityId": "ACT-100",
  "participationMode": "ALL_SCHEDULES",
  "selectedScheduleIds": []
}
```

O significado é:

```text
ALL_SCHEDULES
=
todos os horários atualmente válidos da atividade no ERP
```

Já:

```json
{
  "erpActivityId": "ACT-100",
  "participationMode": "SELECTED_SCHEDULES",
  "selectedScheduleIds": [
    "SCH-001",
    "SCH-003"
  ]
}
```

significa participação personalizada.

Isso evita copiar a estrutura de horários do ERP para o banco local.

---

# 9. Atenção especial à frequência

Para frequência, **não basta guardar apenas a atividade**.

Precisamos guardar:

```text
volunteer
     │
     ▼
volunteer_activity
     │
     └── erp_activity_id
             │
             └── erp_schedule_id
                       │
                       └── occurrence_date
```

Por isso `AttendanceRecord` possui:

```prisma
erpScheduleId String
occurrenceDate DateTime
```

Assim conseguimos distinguir:

```text
João
Sopa Fraterna
SCH-001
23/09/2026
PRESENT
```

de:

```text
João
Sopa Fraterna
SCH-001
25/09/2026
ABSENT
```

Sem criar o horário no nosso banco.

---

# 10. Índices principais

O PostgreSQL deverá ter índices especialmente para:

```text
volunteers.cpf
volunteers.crm_person_id

volunteer_activities.volunteer_id
volunteer_activities.erp_activity_id

attendance_records.volunteer_id + occurrence_date
attendance_records.erp_schedule_id + occurrence_date

documents.volunteer_id
documents.expiration_date
documents.status

audit_logs.entity + entity_id
audit_logs.created_at
```

O `@@unique([volunteerId, erpActivityId])` impede que o mesmo voluntário tenha duas relações duplicadas com a mesma atividade.

Caso posteriormente seja necessário permitir histórico de múltiplos vínculos com a mesma atividade, essa regra deverá ser revisada.

---

# 11. Migração inicial

```bash
npx prisma migrate dev --name init
```

Produção:

```bash
npx prisma migrate deploy
```

Geração do client:

```bash
npx prisma generate
```

---

# 12. Arquitetura dos módulos de integração

Sugestão de organização:

```text
src/
├── modules/
│   ├── volunteers/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── validators/
│   │   └── dto/
│   │
│   ├── volunteer-activities/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── validators/
│   │
│   ├── attendance/
│   ├── documents/
│   └── users/
│
├── integrations/
│   ├── erp/
│   │   ├── erp.client.ts
│   │   ├── erp.activity.service.ts
│   │   ├── erp.types.ts
│   │   └── erp.cache.ts
│   │
│   └── crm/
│       ├── crm.controller.ts
│       ├── crm.service.ts
│       ├── crm.types.ts
│       └── crm.validator.ts
│
├── infrastructure/
│   ├── database/
│   ├── redis/
│   ├── storage/
│   └── audit/
│
└── shared/
    ├── errors/
    ├── types/
    └── validators/
```

---

# 13. Decisão importante sobre as duas visões

O fato de o sistema possuir **visão do Administrador e visão do Voluntário** não exige bancos separados.

Usaremos:

```text
users.role
```

com:

```text
ADMIN
INSTITUTE_COORDINATOR
VOLUNTEER
```

O backend controla autorização.

### Voluntário

Pode:

- visualizar seus dados;
- visualizar seus vínculos;
- visualizar atividades disponíveis;
- selecionar horários;
- visualizar seus documentos;
- enviar documentos;
- acompanhar validade de seus documentos;
- visualizar sua frequência.

### Administrador/coordenador

Pode, conforme permissão:

- cadastrar/editar voluntários;
- consultar atividades do ERP;
- criar vínculos;
- alterar escalas;
- registrar frequência;
- consultar documentos;
- validar documentos;
- visualizar auditoria.

---

# 14. Prompt para Vibe Coding — módulo Banco + Integrações

```text
[MÓDULO]: Banco de Dados e Integrações do Sistema de Voluntários

[CONTEXTO]:
Criar o backend do Sistema de Voluntários utilizando PostgreSQL e Prisma.

O sistema possui duas visões principais:
1. Administrador/Coordenador
2. Voluntário

O sistema faz parte de um ecossistema integrado com ERP e CRM.

[REGRA ARQUITETURAL CRÍTICA]:
NÃO criar tabela Activity.
NÃO criar tabela ActivitySchedule.
As atividades e seus horários pertencem exclusivamente ao ERP.

O Sistema de Voluntários deve consumir atividades do ERP por API REST/JSON.

[ENTIDADES LOCAIS]:
User
Volunteer
VolunteerActivity
AttendanceRecord
DocumentType
Document
AuditLog

[RELACIONAMENTO COM ERP]:
VolunteerActivity.erpActivityId referencia logicamente o ID da atividade existente no ERP.

VolunteerActivity.selectedScheduleIds contém somente IDs de horários existentes no ERP.

AttendanceRecord.erpScheduleId contém o ID do horário do ERP utilizado para aquela ocorrência.

NÃO criar FK PostgreSQL para os IDs do ERP.

[REGRA DE HORÁRIOS]:
selectedScheduleIds deve ser validado contra os horários retornados pelo ERP.

Se participationMode = ALL_SCHEDULES, selectedScheduleIds pode ser vazio e o vínculo representa todos os horários válidos da atividade.

Se participationMode = SELECTED_SCHEDULES, selectedScheduleIds deve conter pelo menos um ID válido retornado pelo ERP.

Nunca aceitar schedule IDs inexistentes na atividade.

[ERP]:
Criar cliente HTTP para consumir a API do ERP.

Criar interfaces TypeScript para:
ErpActivity
ErpActivitySchedule
ErpActivitiesResponse

Implementar cache Redis.

Chave de cache:
erp:activity:{activityId}

TTL configurável por variável de ambiente.

[CRM]:
Criar:
POST /api/integrations/crm/volunteers

O endpoint recebe:
crmPersonId
fullName
cpf
email
phone
birthDate
address
volunteerType
source
occurredAt

O processamento deve ser idempotente.

Primeiro procurar crmPersonId.
Caso não exista, procurar CPF.
Caso não exista, criar Volunteer.
Caso exista, atualizar os dados permitidos.

[SEGURANÇA]:
Usar autenticação própria para integração CRM.
Validar Authorization Bearer Token.
Validar payload.
Registrar auditoria das operações relevantes.

[DOCUMENTOS]:
Suportar:
BACKGROUND_CHECK
VOLUNTEER_AGREEMENT
LGPD_CONSENT
FOOD_HANDLING
DRIVER_RESPONSIBILITY
CONFIDENTIALITY
IMAGE_USAGE

Controlar status e expirationDate.

[PADRÕES]:
Repository
Service
Controller
DTO
Adapter para ERP
Adapter para CRM
Cache-aside para Redis

[VALIDAÇÕES]:
CPF obrigatório e único.
crmPersonId único quando informado.
VolunteerActivity deve referenciar atividade existente no ERP.
selectedScheduleIds devem pertencer à atividade retornada pelo ERP.
Não permitir frequência para horário que não pertença ao vínculo do voluntário.
Não duplicar registro de frequência para volunteer + schedule + occurrenceDate.

[TRATAMENTO DE ERROS]:
Usar respostas JSON padronizadas.
400 para payload inválido.
401 para autenticação inválida.
403 para autorização insuficiente.
404 para recurso inexistente.
409 para conflito.
502/503 para indisponibilidade de integração externa.

[TESTES]:
Testar criação de voluntário.
Testar atualização via CRM.
Testar idempotência do POST CRM.
Testar consulta ERP com cache hit.
Testar consulta ERP com cache miss.
Testar invalidação/expiração do Redis.
Testar seleção de horário válido.
Testar rejeição de horário inexistente.
Testar participação ALL_SCHEDULES.
Testar participação SELECTED_SCHEDULES.
Testar frequência.
Testar duplicidade de frequência.
Testar permissões ADMIN, COORDINATOR e VOLUNTEER.

[IGNORAR]:
Não criar Activity.
Não criar ActivitySchedule.
Não copiar atividades do ERP para PostgreSQL.
Não criar horários locais.
Não permitir que o frontend determine diretamente quais schedule IDs são válidos.
Não confiar em dados do CRM sem validação.
Não expor documentos de um voluntário para outro.
```

---

# 15. Pendências para fechamento da integração

O documento-base não define os contratos reais das APIs do ERP e do CRM — nomes das rotas, autenticação, paginação, formato exato dos IDs e campos obrigatórios.

Portanto, os contratos acima estão estruturados para implementação, mas os campos marcados como **[SUPOSIÇÃO]** precisam ser confrontados com a documentação das APIs antes de fechar a integração em produção.

A decisão principal está fechada:

> **`VolunteerActivity` referencia os IDs externos do ERP; não haverá duplicação de atividades ou horários no banco de voluntários.**
