# volunteer-database
Repositório temporário para integração da base de dados do sistema de voluntários.

## Esquema do protótipo

O modelo inicial está em `prisma/schema.prisma`. Atividades e horários continuam
sendo propriedade do ERP: o banco local guarda apenas seus identificadores
externos. As regras que consultam o ERP serão implementadas na aplicação quando
os contratos reais estiverem disponíveis.

### Verificações

```sh
npm test
```

Os testes verificam as entidades e restrições estruturais principais do schema.
Para validar também a sintaxe com o Prisma CLI, configure `DATABASE_URL` (por
exemplo, copiando `.env.example` para `.env`) e execute:

```sh
npm run db:validate
```

Essa validação não exige que o PostgreSQL esteja rodando.
