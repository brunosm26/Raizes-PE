# Backend Raízes PE (Express + TypeScript)

API REST independente do app Next. Requer Node.js 20.19+, 22.12+ ou 24+ (exigência do Prisma 7). Todos os comandos rodam dentro da pasta `backend/`.

## Instalar

```bash
cd backend
npm install
```

O `npm install` já gera o client do Prisma (não precisa de `.env` nem de banco).

Crie o `.env` a partir do modelo. Sem ele o servidor sobe com `PORT=4000` e `NODE_ENV=development`, mas nada que use o banco funciona (veja "Prisma").

```bash
# Windows (cmd)
copy .env.example .env
# Mac/Linux
cp .env.example .env
```

## Rodar em desenvolvimento (recarrega ao salvar)

```bash
npm run dev
```

## Compilar e rodar a versão compilada

```bash
npm run typecheck
npm run build
npm start
```

O `build` gera o JavaScript em `backend/dist/`.

## Testar a rota de saúde

Com o servidor rodando, abra <http://localhost:4000/api/saude> no navegador ou rode:

```bash
curl.exe http://localhost:4000/api/saude
```

Resposta esperada (status 200): `{"ok":true}`. No PowerShell, use `curl.exe`, e não `curl`, que é um apelido do `Invoke-WebRequest`.

## Prisma

O Prisma 7 lê o banco do Neon (esquema `origem`) pelo adapter `@prisma/adapter-pg`.

### Preencher o `.env`

Peça as connection strings a quem administra o banco, por um canal privado. No painel do Neon, ambas ficam em **Connect** e terminam em `?sslmode=require`:

- `DATABASE_URL`: a connection string **pooled** (com *Connection pooling* ligado; o host tem `-pooler`). É a que o app usa em runtime: o pooler do Neon aguenta muitas conexões curtas.
- `DIRECT_URL`: a connection string **direta** (com o pooling desligado; o host não tem `-pooler`). É a que a CLI do Prisma usa (`prisma:pull`), porque a introspecção precisa de uma conexão de sessão comum.

O aviso `SECURITY WARNING: The SSL modes 'prefer', 'require'...` vem do driver `pg` e é inofensivo: hoje `sslmode=require` já funciona como `verify-full`, o modo mais seguro.

### Comandos

```bash
npm run prisma:generate   # regera o client em src/generated/ (não versionado)
npm run prisma:verificar  # SÓ LEITURA: conta as linhas das 8 tabelas e da view
npm run prisma:pull       # SÓ LEITURA: reintrospecta o banco e reescreve prisma/schema.prisma
```

Depois de um `prisma:pull`, rode `git diff prisma/schema.prisma`: se não houver diferença, o schema bate com o banco. Não use `prisma migrate` nem `prisma db push`: o banco é compartilhado, e o esquema é mantido pelos scripts de `db/`.

### Decisões

- **O banco é a fonte da verdade.** O `schema.prisma` vem do `db pull`. Os modelos foram renomeados para PascalCase (`ItemPedido`) e os campos para camelCase (`precoUnitario`), e os nomes reais ficam em `@@map`/`@map`. Um novo `db pull` preserva esses nomes.
- **Relações com nomes claros:** `Pedido.comprador`, `Pedido.itens`, `Produto.itensPedido`, `Usuario.pedidos` etc.
- **Sem enums no Prisma:** `usuario.tipo` e `pedido.status` são `VARCHAR` com `CHECK` no banco, não enums do Postgres, por isso ficam `String`.
- **CHECKs, gatilhos e `SELECT ... FOR UPDATE` ficam no SQL**, e não são replicados no Prisma.
- **A view `vw_popularidade_produto` não é modelo Prisma.** Ela é lida com `$queryRaw` em `src/repositories/popularidadeRepository.ts`, com o resultado tipado. Consultas pesadas (agregações, ranking, recomendação) também ficam em `$queryRaw` nos repositories.
- **Há um único client**, em `src/config/prisma.ts`. Ele é criado no primeiro uso (o servidor sobe sem `DATABASE_URL`) e desconectado quando o servidor é encerrado.

### Problemas comuns

- **`EPERM: operation not permitted, rmdir ...src\generated...`:** acontece quando o projeto está no OneDrive, que trava a pasta. Rode `npm run prisma:generate`, que apaga `src/generated` antes de gerar.
- **`DATABASE_URL não configurada`:** falta o `.env` (veja acima).
