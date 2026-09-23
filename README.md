# volunteer-database
Repositório temporário para integração da base de dados do sistema de voluntários.

## Esquema do protótipo

O modelo inicial está em `prisma/schema.prisma`. Atividades e horários continuam
sendo propriedade do ERP: o banco local guarda apenas seus identificadores
externos. As regras que consultam o ERP serão implementadas na aplicação quando
os contratos reais estiverem disponíveis.

## Backend

Com `.env` configurado, inicie o servidor em modo de desenvolvimento ou normal:

```sh
npm run dev
# ou
npm start
```

O endereço padrão é `http://127.0.0.1:3000`. As rotas `/health/live` e
`/health/ready` verificam o processo HTTP e a conexão com o banco,
respectivamente. O POST de integração CRM está disponível no caminho descrito
abaixo.

## Contratos de integração

Os contratos TypeScript e exemplos JSON provisórios ficam em
`src/integrations/erp/` e `src/integrations/crm/`. Tipos de IDs, alguns campos,
enumerações, datas e paginação precisam ser confirmados quando recebermos as
especificações reais das APIs. Os envelopes de erro definidos no documento
também estão mapeados em `errors.ts` e têm exemplos JSON por status/código.

O endpoint `POST /api/integrations/crm/volunteers` recebe o payload do documento
e usa `Authorization: Bearer ...` (`CRM_INTEGRATION_TOKEN`). `Idempotency-Key` é
obrigatória; o protótipo guarda o resultado no Redis por 24 horas
(`CRM_IDEMPOTENCY_TTL_SECONDS`) e rejeita chave repetida com outro corpo ou
enquanto a primeira operação está em andamento. A duração, validação do CPF,
campos atualizados e status de criação/atualização são decisões provisórias a
confirmar com a equipe do CRM.

O cliente ERP e o serviço de cache-aside ficam em `src/integrations/erp/`.
Rota, filtros, cabeçalho de autenticação e rota por ID são configuráveis; os
valores do `.env.example` são apenas propostas para o protótipo.

### Verificações

```sh
npm test
npm run types:check
```

Os testes verificam o schema, regras de domínio e contratos do backend. O
comando `types:check` valida as interfaces TypeScript.
Para validar também a sintaxe com o Prisma CLI, configure `DATABASE_URL` (por
exemplo, copiando `.env.example` para `.env`) e execute:

```sh
npm run db:validate
```

Essa validação não exige que o PostgreSQL esteja rodando.

Os testes de integração exercitam as restrições reais do PostgreSQL. Com o banco
local iniciado e as migrações aplicadas, execute:

```sh
npm run test:db
```

Para testar TTL e leitura/escrita no Redis real, inicie o serviço `cache` e
execute:

```sh
docker compose up -d cache
npm run test:cache
```

### Banco local

Copie `.env.example` para `.env` e inicie PostgreSQL e Redis de protótipo:

```sh
docker compose up -d db cache
```

Com o banco iniciado, aplique a migração em desenvolvimento com:

```sh
npm run db:migrate
```

Para aplicar as migrações já criadas em um ambiente de deploy, use:

```sh
npm run db:deploy
```

Para parar o banco mantendo os dados locais, execute `docker compose down`.

A migração inicial está em `prisma/migrations/20260923190000_init/` e foi
gerada a partir do schema Prisma. Não inclui dados iniciais para tipos de
documento porque o documento de requisitos ainda não especifica quais tipos
são obrigatórios nem suas regras de validade.
