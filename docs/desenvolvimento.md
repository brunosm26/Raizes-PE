# Guia de desenvolvimento: Raízes PE

Complementa o "Como rodar" do [README](../README.md): os modos de ligar o front à API, a tabela de variáveis, o banco local, os testes, os scripts e os problemas comuns.

## Pré-requisitos

- [Node.js](https://nodejs.org/en/) **20.19+ ou 22.12+**. O backend exige isso por causa do Prisma 7 (`engines` do `backend/package.json`). O front roda nas mesmas versões.
- Um banco PostgreSQL: o Neon do time (connection string pedida ao responsável pelo banco, por canal privado) ou um Postgres local descartável em [Docker](https://www.docker.com/) (seção [Banco local em Docker](#banco-local-em-docker)). O Docker é opcional, mas é o único jeito de rodar os testes que gravam no banco sem tocar no Neon.
- `npm install` **nas duas pastas**: na raiz (front) e em `backend/` (API). Os testes e o typecheck do backend também usam a `jose` instalada na raiz.

## Front e API juntos

Use dois terminais, um para cada porta:

| Terminal | Pasta | Comando | Endereço |
|---|---|---|---|
| 1. API Express | `backend/` | `npm run dev` | <http://localhost:4000/api/saude> e <http://localhost:4000/api-docs> |
| 2. App Next | raiz do projeto | `npm run dev` | <http://localhost:3000> |

O front escolhe o caminho da API por variável de ambiente:

| Modo | Como ligar | Quando usar |
|---|---|---|
| **Proxy do Next (recomendado)** | `API_URL=http://localhost:4000` no `.env.local` (já vem no `.env.example`) | Padrão. É como o site publicado funciona: o `next.config.mjs` repassa todo `/api/*` para a API (`rewrites` com `beforeFiles`). O navegador só fala com a porta 3000, o cookie de sessão fica no domínio do site, não precisa de CORS e o `middleware.ts` valida o mesmo JWT |
| Só o Next | Sem `API_URL` e com `DATABASE_URL` no `.env.local` | Para mexer só no front. As rotas `app/api` do Next respondem, com o mesmo contrato, lendo o banco direto |
| Chamada direta (avançado) | `NEXT_PUBLIC_API_URL` no front, `CORS_ORIGIN` (e, entre domínios diferentes, `COOKIE_SAMESITE=none`) no `backend/.env` | Raramente. O cookie passa a ser do domínio da API e o `middleware.ts` não o vê, então as páginas protegidas voltam para `/login`. Detalhes em [`arquitetura-backend.md`](arquitetura-backend.md), seção 3.5 |

**Conferir o proxy:** <http://localhost:3000/api/saude> deve responder `{"ok":true}`. Essa rota só existe no Express, então a resposta pela porta 3000 prova que o Next está repassando `/api/*`. A `API_URL` é lida quando o `npm run dev` sobe e no `npm run build`: mudou, reinicie o Next.

**Documentação da API:** com a API rodando, abra <http://localhost:4000/api-docs> (Swagger UI). Para testar as rotas protegidas no próprio Swagger, execute primeiro `POST /auth/login` com um login de demonstração: o navegador guarda o cookie de sessão e o envia nas chamadas seguintes. A especificação crua fica em <http://localhost:4000/api-docs.json> e o arquivo-fonte é `backend/openapi.yaml`. No ambiente publicado, o caminho é o mesmo: `<url-da-api>/api-docs`.

Camadas do backend: [`arquitetura-backend.md`](arquitetura-backend.md). Prisma, migrations e testes da API: [`backend/README.md`](../backend/README.md). Publicação: [`publicacao.md`](publicacao.md).

## Variáveis de ambiente

Cada projeto tem o seu arquivo, criado a partir do modelo versionado. Nenhum dos dois vai para o GitHub (`.gitignore`):

- **Raiz:** `.env.local`, a partir do `.env.example`, lido pelo app Next.
- **API:** `backend/.env`, a partir do `backend/.env.example`, lido pela API Express e pela CLI do Prisma.

| Variável | Arquivo | Quem lê | Obrigatória? | Exemplo |
|---|---|---|---|---|
| `SESSION_SECRET` | `.env.local` e `backend/.env` | Next (`lib/sessao.ts`, usado pelo `middleware.ts` e pelas rotas `app/api`) e API (`backend/src/config/env.ts`) | **Sim**, com o **mesmo valor** nos dois e 32+ caracteres | `<64 caracteres hexadecimais>` |
| `API_URL` | `.env.local` | Next (`next.config.mjs`, na subida e no build) | Recomendada. Sem ela, valem as rotas `app/api` | `http://localhost:4000` |
| `DATABASE_URL` | `.env.local` | Next (`lib/db.ts`, rotas `app/api`) | Só sem `API_URL` | `postgresql://<usuario>:<senha>@<host>:<porta>/<banco>?sslmode=require` |
| `NEXT_PUBLIC_API_URL` | `.env.local` | Next (`lib/apiUrl.ts`, embutida no build) | Não (modo de chamada direta) | `http://localhost:4000` |
| `DATABASE_URL` | `backend/.env` | API (pool do `pg` e Prisma) e scripts `prisma:verificar` e `contas:artesao` | **Sim**. Sem ela só `/api/saude` responde | `postgresql://<usuario>:<senha>@<host>:<porta>/<banco>?sslmode=require` |
| `PORT` | `backend/.env` | API | Não (padrão `4000`) | `4000` |
| `NODE_ENV` | `backend/.env` | API (`production` liga o `Secure` do cookie) | Não (padrão `development`) | `development` |
| `DIRECT_URL` | `backend/.env` | CLI do Prisma (`prisma.config.ts`: `prisma:pull`, `migrate status`/`resolve`) | Só para a CLI do Prisma no Neon | `postgresql://<usuario>:<senha>@<host-direto>:<porta>/<banco>?sslmode=require` |
| `CORS_ORIGIN` | `backend/.env` | API (`middlewares/cors.ts`) | Só no modo de chamada direta | `http://localhost:3000` |
| `COOKIE_SAMESITE` | `backend/.env` | API (cookie de sessão) | Não (padrão `lax`) | `lax`, `strict` ou `none` (só com HTTPS) |
| `CACHE_TTL_SEGUNDOS` | `backend/.env` (e `.env.local`, no modo sem `API_URL`) | API (`services/cacheCatalogo.ts`) e Next (`lib/servidor/cacheCatalogo.ts`) | Não (padrão `60`; `0` desliga) | `60`. Detalhes em [`cache.md`](cache.md) |

Variáveis **só de terminal**, que não vão em arquivo nenhum: `TEST_DATABASE_URL` e `TEST_DB_REMOTO_DESCARTAVEL` (testes que gravam no banco, seção [Testes, lint e typecheck](#testes-lint-e-typecheck)), `MIGRATE_DATABASE_URL` (`db:migrar-descartavel`), `COMPARAR_URL_A` e `COMPARAR_URL_B` (`db:comparar`), `SENHA_ARTESAOS` (`contas:artesao`, que recusa ler a senha de arquivo) e `OPENAPI_CONFERIR_URL` (`openapi:conferir` em outra porta).

- Para gerar o `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- No painel do Neon, as connection strings ficam em **Connect** e terminam em `?sslmode=require`:
  - **pooled** (com *Connection pooling* ligado; o host tem `-pooler`): vai na `DATABASE_URL`. É a usada pelos apps em execução.
  - **direta** (com o pooling desligado; o host não tem `-pooler`): vai na `DIRECT_URL` do `backend/.env`. É a usada só pela CLI do Prisma.

## Banco local em Docker

Um PostgreSQL descartável, com o mesmo schema e a mesma carga de demonstração do Neon. O `db/07_autenticacao.sql` define as senhas das contas de demonstração; carregue-o como os outros, sem abrir nem editar.

**Windows (PowerShell)**, na raiz do projeto:

```powershell
# senha aleatória, só nesta janela do terminal
$env:PG_SENHA = [guid]::NewGuid().ToString("N")
docker run -d --name raizes-pg -e POSTGRES_PASSWORD=$env:PG_SENHA -e POSTGRES_DB=raizes -p 127.0.0.1:15433:5432 postgres:16
docker exec raizes-pg pg_isready -U postgres   # repita até aparecer "accepting connections"

foreach ($f in "01_ddl_origem.sql", "04_migracao_front.sql", "05_dados_raizes_pe.sql", "06_imagem_produto.sql", "07_autenticacao.sql") {
  docker cp "db\$f" "raizes-pg:/tmp/$f"
  docker exec raizes-pg psql -q -U postgres -d raizes -v ON_ERROR_STOP=1 -f "/tmp/$f"
}
```

**Mac/Linux (bash)**, na raiz do projeto:

```bash
export PG_SENHA=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
docker run -d --name raizes-pg -e POSTGRES_PASSWORD=$PG_SENHA -e POSTGRES_DB=raizes -p 127.0.0.1:15433:5432 postgres:16
docker exec raizes-pg pg_isready -U postgres   # repita até aparecer "accepting connections"

for f in 01_ddl_origem 04_migracao_front 05_dados_raizes_pe 06_imagem_produto 07_autenticacao; do
  docker cp "db/$f.sql" "raizes-pg:/tmp/$f.sql"
  docker exec raizes-pg psql -q -U postgres -d raizes -v ON_ERROR_STOP=1 -f "/tmp/$f.sql"
done
```

O `db/06` mostra um `NOTICE ... does not exist, skipping`, que é esperado. Depois, no `backend/.env` (e no `.env.local`, se for usar o modo "só o Next"):

```text
DATABASE_URL=postgresql://postgres:<a senha do PG_SENHA>@localhost:15433/raizes
```

Para ver a senha na mesma janela: `echo $env:PG_SENHA` (PowerShell) ou `echo $PG_SENHA` (bash). Para apagar tudo no fim: `docker rm -f raizes-pg`. Se o Docker disser `ports are not available`, troque a porta `15433` (veja "Problemas comuns").

Para montar o banco pelas **migrations do Prisma** em vez dos scripts de `db/`, siga [`backend/README.md`, seção Migrations](../backend/README.md#migrations).

## Banco do time (Neon)

Desde a PI4-147, a estrutura do banco é definida pelas **migrations do Prisma** (`backend/prisma/migrations`), e o `db/ddl_final.sql` é gerado a partir delas. Os scripts de dados de `db/` continuam sendo a carga de demonstração. Para montar um banco do zero só pelos scripts (por exemplo, um projeto novo no Neon), abra o **SQL Editor** do Neon e execute os arquivos **um por vez, nesta ordem**:

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `01_ddl_origem.sql` | Cria o esquema `origem`: 8 tabelas, gatilhos, índices, view de popularidade e perfis de acesso |
| 2 | `02_dados_exemplo_origem.sql` | Dados de exemplo do modelo físico (opcional: o `05` apaga e troca por outros) |
| 3 | `04_migracao_front.sql` | Acrescenta `descricao` e `imagem_url` em `produto` |
| 4 | `05_dados_raizes_pe.sql` | Carrega o catálogo de demonstração (9 usuários, 6 artesãos, 7 produtos, 3 pedidos, 6 avaliações) |
| 5 | `06_imagem_produto.sql` | `imagem_url` passa a aceitar foto enviada pelo artesão (até ~2 MB) |
| 6 | `07_autenticacao.sql` | Acrescenta `senha_hash` em `usuario` e define a senha dos 3 logins de demonstração |

Para conferir se ficou correto, cole o conteúdo de `db/validacao_resumo.sql` no SQL Editor e execute: o resultado é uma tabela de 8 linhas em que `esperado` deve ser igual a `obtido` em todas. O `03_consultas_validacao_origem.sql` traz as consultas de recomendação e de conferência do modelo físico, para rodar à mão.

> **Cuidado, o banco é compartilhado.** O `05_dados_raizes_pe.sql` **apaga** os dados existentes antes de carregar o catálogo, e o `01_ddl_origem.sql` tem uma linha de `DROP SCHEMA` comentada. Não execute esses scripts no banco oficial sem combinar com o time. As pendências do responsável pelo banco (baseline das migrations e `contas:artesao`) estão em [`publicacao.md`](publicacao.md#pendências-do-responsável-pelo-banco).

## Testes, lint e typecheck

**Antes de abrir um Pull Request**, rode os do projeto que você mexeu:

```bash
# front (na raiz)
npm test
npm run lint
npx tsc --noEmit

# API
cd backend
npm test        # inclui a conferência do openapi.yaml contra as rotas, os perfis e os limites
npm run lint
npm run typecheck
```

No GitHub, o workflow `.github/workflows/testes-recomendacao.yml` roda o `npm ci` e o `npm test` da raiz (Node 22) em cada Pull Request para a `main`. Lint, typecheck e os testes do backend não rodam no CI: rode-os na sua máquina.

Sem banco de teste, o `npm test` do backend pula os testes que gravam no banco e avisa quantos foram pulados. Para rodá-los, use um banco **descartável**, nunca o Neon do time, com a variável **no terminal** (os testes não a leem de arquivo). A trava de `backend/scripts/travaBanco.ts` recusa um banco igual ao da `DATABASE_URL` dos `.env`, então use um segundo banco no mesmo container do passo anterior:

```powershell
# PowerShell, na raiz do projeto, com o container raizes-pg rodando
docker exec raizes-pg createdb -U postgres raizes_teste
foreach ($f in "01_ddl_origem.sql", "04_migracao_front.sql", "05_dados_raizes_pe.sql", "06_imagem_produto.sql", "07_autenticacao.sql") {
  docker cp "db\$f" "raizes-pg:/tmp/$f"
  docker exec raizes-pg psql -q -U postgres -d raizes_teste -v ON_ERROR_STOP=1 -f "/tmp/$f"
}
$env:TEST_DATABASE_URL = "postgresql://postgres:$($env:PG_SENHA)@127.0.0.1:15433/raizes_teste"
cd backend
npm test
```

No bash, o mesmo com `export TEST_DATABASE_URL=...`. Host remoto (por exemplo, uma branch do Neon criada só para testes) exige também `TEST_DB_REMOTO_DESCARTAVEL=1`. Detalhes em [`backend/README.md`, seção Testes](../backend/README.md#testes).

## Scripts úteis

| Onde | Comando | Faz |
|---|---|---|
| raiz | `npm run dev` / `npm run build` / `npm start` | Sobe / compila / roda a versão compilada do app Next |
| raiz | `npm test`, `npm run lint`, `npx tsc --noEmit` | Testes, lint e typecheck do front |
| `backend/` | `npm run dev` / `npm run build` / `npm start` | Sobe a API em modo de desenvolvimento / compila / roda a versão compilada |
| `backend/` | `npm test`, `npm run lint`, `npm run typecheck` | Testes, lint e typecheck da API, cobrindo `src/`, `test/` e `scripts/` |
| `backend/` | `npm run openapi:lint` | Lint do `openapi.yaml` com o Redocly |
| `backend/` | `npm run openapi:conferir` | **Só leitura**, com a API local rodando: compara status e corpos reais com o `openapi.yaml` |
| `backend/` | `npm run openapi:conferir:sessao` | O mesmo, mais os GETs por perfil com login nas contas de demonstração (um login por conta, nada gravado) |
| `backend/` | `npm run prisma:generate` | Regera o client do Prisma (o `npm install` já faz isso) |
| `backend/` | `npm run prisma:verificar` | **Só leitura:** conta as linhas das 8 tabelas e da view no banco da `DATABASE_URL` |
| `backend/` | `npm run prisma:pull` | **Só leitura:** reintrospecta o banco da `DIRECT_URL` e reescreve o `schema.prisma` |
| `backend/` | `npm run db:migrar-descartavel` | Aplica as migrations num banco **local descartável** (`MIGRATE_DATABASE_URL`); recusa o banco do time |
| `backend/` | `npm run db:comparar` | Compara o schema `origem` de dois bancos locais (`COMPARAR_URL_A` e `COMPARAR_URL_B`) |
| `backend/` | `npm run db:ddl` | Regera o `db/ddl_final.sql` a partir das migrations |
| `backend/` | `npm run contas:artesao` | Grava a senha dos artesãos que estão sem login. Só o responsável pelo banco roda no Neon; o padrão é o dry-run, que não grava ([`estrategia-autenticacao.md`](estrategia-autenticacao.md), seção 13) |
| raiz | `python ia/avaliar_baseline.py` | Métricas do módulo de IA (veja [`ia/README.md`](../ia/README.md)) |

Os detalhes do Prisma e das migrations estão em [`backend/README.md`](../backend/README.md).

## Contas de demonstração

Os logins estão no [README](../README.md#logins-de-demonstração): comprador, artesão (Cooperativa de Tacaratu) e admin, todos com a senha `demo123`, gravada pelo `db/07`. A tela `/cadastro` cria um comprador novo. Os outros 5 artesãos da carga só entram depois do `contas:artesao`. Até lá, aparecem como "Pendente (sem login)" em `/admin/artesaos`.

## Problemas comuns

- **`http://localhost:3000/api/saude` responde 404:** o proxy está desligado. Confira a `API_URL` no `.env.local` (URL completa, com `http://`) e **reinicie** o `npm run dev` da raiz. A variável só é lida na subida.
- **`API_URL inválida` ao subir o Next:** falta o `http://` ou o `https://`.
- **Login funciona, mas `/painel` ou `/admin` volta para `/login`:** o `SESSION_SECRET` do `.env.local` e o do `backend/.env` estão diferentes (a API assina o cookie e o `middleware.ts` do Next não consegue validá-lo). Deixe os dois iguais e reinicie os dois servidores.
- **Login falha com erro de servidor:** falta o `SESSION_SECRET` (mínimo de 32 caracteres) no `.env` de quem respondeu: no `backend/.env` com a `API_URL`, no `.env.local` sem ela.
- **`DATABASE_URL não configurada` ou erro de conexão em `/api/saude-bd`:** confira a `DATABASE_URL` do `backend/.env` (ou do `.env.local` no modo "só o Next"). No Neon, a string termina com `?sslmode=require`, e o banco pode levar alguns segundos para "acordar" na primeira consulta.
- **`ports are not available ... bind` no `docker run` (Windows):** a porta caiu numa faixa reservada pelo Windows. Veja as faixas com `netsh int ipv4 show excludedportrange protocol=tcp` e troque a `15433` por outra, também na `DATABASE_URL`.
- **No Git Bash do Windows, o `docker exec ... -f /tmp/...` não acha o arquivo:** o Git Bash converte caminhos que começam com `/`. Rode os comandos no PowerShell ou prefixe com `MSYS_NO_PATHCONV=1`.
- **`relation "produto" does not exist` no SQL Editor:** o esquema não foi selecionado. Execute `SET search_path TO origem;` junto com a consulta.
- **`EPERM: operation not permitted, rmdir ...src\generated...` no `prisma generate`:** acontece com o projeto dentro do OneDrive. Veja "Problemas comuns" em [`backend/README.md`](../backend/README.md).

## Estrutura de pastas

```text
├── app/                  # Next.js App Router
│   ├── (publico)/        # Vitrine, produto/[id], artesao/[id], checkout, meus-pedidos
│   ├── (auth)/           # Login e cadastro
│   ├── painel/           # Painel do artesão
│   ├── admin/            # Painel administrativo
│   └── api/              # Rotas do Next (alternativa sem API_URL): produtos, pedidos, auth, artesaos, filtros, painel, recomendacoes, saude-bd
├── middleware.ts         # Protege as páginas por perfil (lê o cookie de sessão)
├── components/           # Componentes reutilizáveis (ex.: SecaoRecomendados, GraficoVendas)
├── lib/                  # Sessão, contextos (carrinho, produtos, pedidos), tema, tipos e acesso à API
│   ├── apiUrl.ts         # apiFetch: ponto único das chamadas do front à API
│   ├── apiCatalogo.ts    # Leituras do catálogo (vitrine, produto, perfil do artesão)
│   ├── apiAdminFiltros.ts # GET /api/artesaos (admin) e GET /api/filtros (vitrine)
│   ├── estadoAdmin.ts    # Aprovação e moderação de demonstração do admin (localStorage)
│   ├── servidor/         # Consultas SQL e regras das rotas app/api (só servidor)
│   └── motorRecomendacao.ts # Baseline de IA das rotas app/api (lê o banco; só servidor)
├── tests/                # Testes do front (node --test), listados por scripts/rodar-testes.mjs
│   └── fixtures/         # Recorte da carga db/05 para os testes sem banco
├── backend/              # API Express (ver backend/README.md)
├── ia/                   # Módulo de IA da AV2 (ver ia/README.md)
├── db/                   # Scripts SQL do banco, DDL final e consulta de validação
└── docs/                 # Documentação do projeto
```

Não existe pasta `src/` no front: o código fica na raiz, e o alias `@/` aponta para ela (`@/lib/tipos`, `@/components/CartaoProduto`).
