# Guia de desenvolvimento: Raízes PE

Complementa o "Como rodar" do [README](../README.md): front e backend juntos, variáveis de ambiente, banco, scripts e problemas comuns.

## Front e backend juntos

Use dois terminais, um para cada porta. Antes de subir a API, crie o `backend/.env` a partir do `backend/.env.example` (veja "Variáveis de ambiente").

| Terminal | Pasta | Comando | Endereço |
|---|---|---|---|
| 1. App Next (front + `app/api`) | raiz do projeto | `npm run dev` | <http://localhost:3000> |
| 2. API Express | `backend/` | `npm install` (só na primeira vez) e depois `npm run dev` | <http://localhost:4000/api/saude> e <http://localhost:4000/api-docs> |

Por padrão o front usa as rotas do próprio Next (`app/api/*`). O backend Express tem as mesmas rotas, com o mesmo contrato. Para o front chamá-lo (PI4-132):

1. Suba a API Express (terminal 2) com o `backend/.env` preenchido.
2. No `.env.local` da raiz, defina `API_URL=http://localhost:4000` e reinicie o `npm run dev`.
3. Confira: <http://localhost:3000/api/saude> deve responder `{"ok":true}`. Essa rota só existe no Express, então a resposta prova que o Next está repassando `/api/*` a ele. Login e rotas protegidas passam a valer com o JWT emitido pelo Express.

Sem a `API_URL`, nada muda. O navegador fala só com o Next (mesma origem): o cookie de sessão fica no domínio do site, sem CORS, e o `middleware.ts` valida o mesmo JWT. A chamada direta do navegador à API em outra origem (`NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`, `COOKIE_SAMESITE`) também é suportada; as diferenças estão em [`arquitetura-backend.md`](arquitetura-backend.md), seção 3.5.

Camadas e mapa da migração: [`arquitetura-backend.md`](arquitetura-backend.md). Instalação, Prisma e testes do backend: [`backend/README.md`](../backend/README.md).

**Documentação da API:** com a API rodando, abra <http://localhost:4000/api-docs> (Swagger UI). Para testar as rotas protegidas no próprio Swagger, execute primeiro `POST /auth/login` com um login de demonstração: o navegador guarda o cookie de sessão e o envia nas chamadas seguintes. A especificação crua fica em <http://localhost:4000/api-docs.json> e o arquivo-fonte é `backend/openapi.yaml`. No deploy, o caminho é o mesmo: `<url-da-api>/api-docs`.

## Variáveis de ambiente

Cada projeto tem o seu arquivo, e nenhum dos dois vai para o GitHub:

| Arquivo | Quem lê | Variáveis | Modelo |
|---|---|---|---|
| `.env.local` (raiz) | App Next | `DATABASE_URL`, `SESSION_SECRET`; opcionais: `API_URL` (proxy para o Express), `NEXT_PUBLIC_API_URL` | `.env.example` |
| `backend/.env` | API Express e CLI do Prisma | `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `PORT` (padrão 4000), `NODE_ENV`; opcionais: `CORS_ORIGIN`, `COOKIE_SAMESITE` | `backend/.env.example` |

- O `SESSION_SECRET` deve ser **o mesmo** nos dois arquivos, para o front e a API aceitarem o mesmo cookie de sessão. Para gerar um valor: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- No painel do Neon, ambas as strings ficam em **Connect** e terminam em `?sslmode=require`:
  - **pooled** (com *Connection pooling* ligado; o host tem `-pooler`): vai na `DATABASE_URL` dos dois arquivos. É a usada pelos apps em execução.
  - **direta** (com o pooling desligado; o host não tem `-pooler`): vai na `DIRECT_URL` do `backend/.env`. É a usada só pela CLI do Prisma (`npm run prisma:pull`).
- A `TEST_DATABASE_URL` (testes do backend que gravam no banco) **não** vai em arquivo: defina no terminal (cmd: `set TEST_DATABASE_URL=...`; PowerShell: `$env:TEST_DATABASE_URL="..."`), sempre com um banco descartável. Detalhes em [`backend/README.md`](../backend/README.md#testes).

## Banco de dados (Neon)

Os scripts SQL ficam na pasta `db/`. Para montar um banco do zero (por exemplo, um projeto novo no Neon), abra o **SQL Editor** do Neon e execute os arquivos **um por vez, nesta ordem**:

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `01_ddl_origem.sql` | Cria o esquema `origem`: 8 tabelas, gatilhos, índices, view de popularidade e perfis de acesso |
| 2 | `02_dados_exemplo_origem.sql` | Dados de exemplo do modelo físico |
| 3 | `04_migracao_front.sql` | Acrescenta `descricao` e `imagem_url` em `produto` |
| 4 | `05_dados_raizes_pe.sql` | Troca os dados de exemplo pelo catálogo do front (9 usuários, 6 artesãos, 7 produtos, 3 pedidos, 6 avaliações) |
| 5 | `06_imagem_produto.sql` | `imagem_url` passa a aceitar foto enviada pelo artesão (até ~2 MB) |
| 6 | `07_autenticacao.sql` | Acrescenta `senha_hash` em `usuario` e define a senha dos 3 logins de demonstração |

Para conferir se ficou correto, cole o conteúdo de `db/validacao_resumo.sql` no SQL Editor e execute: o resultado é uma tabela de 8 linhas em que `esperado` deve ser igual a `obtido` em todas. O `03_consultas_validacao_origem.sql` traz as consultas de recomendação e de conferência do modelo físico, para rodar à mão.

> **Cuidado, o banco é compartilhado.** O `05_dados_raizes_pe.sql` **apaga** os dados existentes antes de carregar o catálogo, e o `01_ddl_origem.sql` tem uma linha de `DROP SCHEMA` comentada. Não execute esses scripts no banco oficial sem combinar com o time.

## Scripts úteis

| Onde | Comando | Faz |
|---|---|---|
| raiz | `npm run dev` / `npm run build` | Sobe / compila o app Next |
| raiz | `npm test`, `npm run lint`, `npx tsc --noEmit` | Testes, lint e typecheck do front |
| `backend/` | `npm run dev` / `npm run build` / `npm start` | Sobe a API em modo de desenvolvimento / compila / roda a versão compilada |
| `backend/` | `npm test`, `npm run lint`, `npx tsc --noEmit` (ou `npm run typecheck`) | Testes, lint e typecheck da API, cobrindo `src/`, `test/` e `scripts/` (os testes incluem a conferência do `openapi.yaml`) |
| `backend/` | `npm run prisma:generate` | Regera o client do Prisma (o `npm install` já faz isso) |
| `backend/` | `npm run prisma:verificar` | **Só leitura:** conta as linhas das 8 tabelas e da view no Neon |
| raiz | `python ia/avaliar_baseline.py` | Métricas do módulo de IA (veja [`ia/README.md`](../ia/README.md)) |

Detalhes do Prisma, incluindo `prisma:pull`, estão em [`backend/README.md`](../backend/README.md).

**Antes de abrir um Pull Request**, rode os testes, o lint e o typecheck do projeto que você mexeu:

```bash
# front (na raiz)
npm test
npm run lint
npx tsc --noEmit

# backend
cd backend
npm test        # inclui o teste que confere se openapi.yaml cobre todas as rotas
npm run lint
npx tsc --noEmit
```

## Problemas comuns

- **Erro de conexão no `npm run dev` ou em `/api/saude-bd`:** confira a `DATABASE_URL` do `.env.local` (a string deve terminar com `?sslmode=require`) e reinicie o servidor. O Neon pode levar alguns segundos para "acordar" na primeira consulta; tente de novo.
- **Login falha com erro de servidor:** confira se o `SESSION_SECRET` está preenchido no `.env.local` (mínimo de 32 caracteres) e reinicie o `npm run dev`.
- **`relation "produto" does not exist` no SQL Editor:** o esquema não foi selecionado. Execute `SET search_path TO origem;` junto com a consulta.
- **`EPERM: operation not permitted, rmdir ...src\generated...` no `prisma generate`:** acontece com o projeto dentro do OneDrive. Veja "Problemas comuns" em [`backend/README.md`](../backend/README.md).

## Estrutura de pastas

```text
├── app/                  # Next.js App Router
│   ├── (publico)/        # Vitrine, produto/[id], artesao/[id], checkout, meus-pedidos
│   ├── (auth)/           # Login e cadastro
│   ├── painel/           # Painel do artesão
│   ├── admin/            # Painel administrativo
│   └── api/              # Rotas de API do Next (produtos, pedidos, auth, artesaos, painel, recomendacoes, saude-bd)
├── middleware.ts         # Protege as páginas por perfil (lê o cookie de sessão)
├── components/           # Componentes reutilizáveis (ex.: SecaoRecomendados, GraficoVendas)
├── lib/                  # Sessão, contextos (carrinho, produtos, pedidos), tema, tipos e acesso a dados
│   ├── servidor/         # Consultas SQL e regras que rodam só no servidor
│   ├── motorRecomendacao.ts # Baseline de IA do app (lê o banco; só servidor)
│   └── dadosFalsos.ts    # Dados mockados que ainda restam (admin e filtros)
├── tests/                # Testes do front (node --test), listados por scripts/rodar-testes.mjs
├── backend/              # API Express (ver backend/README.md)
├── ia/                   # Módulo de IA da AV2 (ver ia/README.md)
├── db/                   # Scripts SQL do banco e consulta de validação
└── docs/                 # Documentação do projeto
```

Não existe pasta `src/` no front: o código fica na raiz, e o alias `@/` aponta para ela (`@/lib/tipos`, `@/components/CartaoProduto`).
