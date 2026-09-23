# volunteer-database

Protótipo do modelo PostgreSQL e das integrações de dados do Sistema de
Voluntários. Os contratos e regras que dependem dos sistemas reais ainda
precisam ser confirmados com as equipes do ERP e do CRM.

## Modelo de dados

O schema Prisma está em `prisma/schema.prisma`; a migração inicial fica em
`prisma/migrations/20260923190000_init/`. Os modelos representam usuários,
voluntários, vínculos com atividades, frequências, documentos, tipos de
documento e auditoria.

Atividades e horários são propriedade do ERP. O banco local **não** cria tabelas
para eles: `VolunteerActivity.erpActivityId`,
`VolunteerActivity.selectedScheduleIds` e `AttendanceRecord.erpScheduleId`
guardam referências externas, sem chaves estrangeiras para o ERP. As tabelas e
os campos físicos usam nomes em inglês.

## Configurar e iniciar

Requisitos: Node.js com npm e Docker Compose. Copie `.env.example` para `.env`;
os valores são apenas para desenvolvimento local.

```sh
cp .env.example .env
docker compose up -d db cache
npm install
npm run db:migrate
npm start
```

O servidor usa `HOST` e `PORT` (padrão `127.0.0.1:3000`), PostgreSQL por meio
de `DATABASE_URL` e Redis por meio de `REDIS_URL`. O Redis precisa estar
disponível para o servidor iniciar, pois o endpoint CRM usa Redis para
idempotência. A prontidão da rota `/health/ready` verifica a conexão com o
PostgreSQL; `/health/live` verifica se o processo HTTP está ativo.

Para parar os containers sem remover os dados locais:

```sh
docker compose down
```

## Integração ERP → Sistema de Voluntários

Os contratos TypeScript e o exemplo de resposta estão em
`src/integrations/erp/contracts.ts` e
`src/integrations/erp/examples/activities.response.json`. O cliente HTTP está
em `erp.client.js`; `erp-activity.service.js` implementa leitura de atividades,
consulta por ID e validação de horários usando os IDs retornados pelo ERP.

O serviço aplica cache-aside no Redis: consulta primeiro o cache e, em caso de
cache miss, chama o ERP e armazena a resposta. Listas usam a chave
`erp:activities:{page}:{pageSize}:{filtersHash}`; consultas por ID usam
`erp:activity:{activityId}`. O TTL, compartilhado por essas consultas, é
configurado por `ERP_ACTIVITIES_CACHE_TTL_SECONDS` (padrão: 300 segundos).
Rotas, paginação, filtros, cabeçalhos de autenticação e formatos de resposta
do ERP são provisórios. A fábrica permite configurar a URL base, caminhos e
cabeçalhos, mas **o serviço ERP ainda não está ligado a uma rota HTTP do
servidor**.

## Integração CRM → Sistema de Voluntários

O endpoint implementado é `POST /api/integrations/crm/volunteers`. Envia-se o
token configurado em `CRM_INTEGRATION_TOKEN`, uma chave `Idempotency-Key` e um
JSON compatível com `src/integrations/crm/contracts.ts`. Um exemplo de payload
está em `src/integrations/crm/examples/volunteer.request.json`.

Exemplo local (substitua o token e a chave):

```sh
curl -i http://127.0.0.1:3000/api/integrations/crm/volunteers \
  -H 'Authorization: Bearer replace-with-a-local-prototype-token' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: crm-event-000123' \
  --data-binary @src/integrations/crm/examples/volunteer.request.json
```

O processamento valida o token e os campos do payload, procura primeiro por
`crmPersonId` e depois por CPF, e cria ou atualiza o voluntário. CPF é
normalizado para dígitos. Campos opcionais omitidos são preservados na
atualização; campos enviados como `null` são limpos. Operações são registradas
em `AuditLog` com `source` e `occurredAt`.

Criação retorna `201`; atualização retorna `200`. A chave de idempotência fica
no Redis por `CRM_IDEMPOTENCY_TTL_SECONDS` (padrão: 86400 segundos). Repetir a
mesma chave e o mesmo payload reproduz status e resposta armazenados. Reutilizar
a chave com outro payload ou durante processamento retorna `409`.
`src/integrations/crm/examples/volunteer.response.json` mostra o formato da
resposta.

## Contratos provisórios e limites

Os contratos ERP e CRM foram montados a partir de
`prs/Banco_de_Dados_e_Integracoes_Sistema_de_Voluntarios.md`; não substituem as
especificações das APIs reais. Antes de conectar os ambientes, confirmar nomes
e tipos de campos, IDs, paginação, autenticação, regras de CPF, semântica de
atualização e política de idempotência. A validação atual do CPF verifica que
há 11 dígitos, mas não calcula os dígitos verificadores.

Além dos erros definidos no documento, o endpoint CRM pode retornar
`IDEMPOTENCY_KEY_CONFLICT` (`409`) e `CRM_INTEGRATION_UNAVAILABLE` (`503`).
Payload inválido usa `400 INVALID_PAYLOAD`; corpos acima de 1 MB usam `413
INVALID_PAYLOAD`. Token inválido usa `401
INVALID_INTEGRATION_TOKEN`; conflito de identidade usa `409
CRM_PERSON_CONFLICT`. Exemplos dos erros documentados estão em
`src/integrations/erp/examples/errors/` e
`src/integrations/crm/examples/errors/`.

## Verificações

```sh
npm test
npm run types:check
npm run db:validate
```

`npm test` executa testes unitários e de contrato. Para incluir verificações
contra serviços locais, inicie os containers e aplique as migrações:

```sh
npm run test:db
npm run test:cache
```

Os dois comandos carregam `.env`; o primeiro verifica restrições do PostgreSQL
e o segundo TTL e operações no Redis. `npm run db:validate` valida o schema
Prisma sem exigir que o banco esteja ativo. `npm run db:deploy` aplica
migrações já criadas em um ambiente de deploy.

Ainda não há testes do upsert CRM contra PostgreSQL e Redis reais; os testes CRM
atuais exercitam rota e serviço com dependências simuladas.
