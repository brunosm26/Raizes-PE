# Backend Raízes PE (Express + TypeScript)

API REST independente do app Next. Requer Node.js 18 ou superior. Todos os comandos rodam dentro da pasta `backend/`.

## Instalar

```bash
cd backend
npm install
```

Crie o `.env` a partir do modelo e preencha `DATABASE_URL` e `SESSION_SECRET` com os **mesmos valores** do `.env.local` do front (sem eles, só a rota `/api/saude` funciona; valem `PORT=4000` e `NODE_ENV=development`).

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

## Documentação da API (Swagger)

Com o servidor rodando, abra <http://localhost:4000/api-docs>. Lá estão todas as rotas, com parâmetros, corpos, respostas e erros. Para chamar as rotas protegidas pelo "Try it out", execute antes `POST /auth/login` (por exemplo `ana.beatriz@raizespe.dev` / `demo123`): o navegador guarda o cookie de sessão.

A especificação fica em `openapi.yaml` (versionada) e também é servida crua em <http://localhost:4000/api-docs.json>. Ao criar ou mudar uma rota, atualize o `openapi.yaml`: o `npm test` falha se uma rota do Express não estiver documentada (ou o contrário).

## Camadas

`routes/` → `middlewares/` → `controllers/` → `services/` → `repositories/`. Services e repositories não importam `express`; só os repositories falam com o banco. Detalhes e o mapa da migração em [`docs/arquitetura-backend.md`](../docs/arquitetura-backend.md).

## Testes

```bash
npm test
```

Sobe o app numa porta livre e chama as rotas de verdade. Sem configuração, rodam os testes que não usam banco (401, 400, 404, spec x rotas). Os testes que gravam pedidos, produtos e usuários só rodam com `TEST_DATABASE_URL` apontando para um banco **descartável** carregado com `db/01`, `04`, `05`, `06` e `07`. **Nunca** aponte para o Neon do time.
