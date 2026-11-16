# Plano de migração: de `lib/apiFalsa.ts` para a API real

**Subtarefa:** PI4-116 (história PI4-113, W10 – Preparação do ambiente para integração). Atualizado na PI4-135 e na PI4-143.
**Situação em:** 15/11/2026, com a fase 7 (PI4-143). A revisão anterior foi de 27/10/2026, com os PRs #28, #29 e #30 na `main`.
**Documentos relacionados:** `docs/CONTRATO_API.md` (contrato proposto), `docs/estrategia-autenticacao.md` (PI4-117), `docs/arquitetura-backend.md` (PI4-122, camadas do Express), `backend/README.md` (Express e Prisma), `db/` (modelo físico)

## 1. Objetivo e regra de ouro

Trocar os dados mockados (`lib/dadosFalsos.ts`) por consultas ao PostgreSQL **sem quebrar as telas durante a migração**.
A regra que guiou tudo: as telas continuam chamando as mesmas funções de `lib/apiFalsa.ts` (mesmo nome, mesmos parâmetros, mesmo tipo de retorno de `lib/tipos.ts`). Só o corpo da função mudou, de "ler array em memória" para `fetch("/api/...")`.

Caminho que **está em uso hoje** (as telas chamam `/api/...` relativo, ou seja, as rotas do Next):

```
Tela / contexto  ->  função de lib/apiFalsa.ts  ->  fetch /api/...  ->  lib/servidor/*.ts  ->  pool (lib/db.ts)  ->  PostgreSQL (schema origem)
   (cliente)            (assinatura mantida)         (route handler)       (regras + SQL)
```

Caminho **opcional**: o backend Express em `backend/` (PI4-119) tem as mesmas rotas, com o mesmo contrato. O front passa a chamá-lo quando a `API_URL` está definida (PI4-132: `lib/apiUrl.ts`, `rewrites` no `next.config.mjs`, `CORS_ORIGIN` e `COOKIE_SAMESITE` no backend). `app/api/*`, `lib/servidor/*` e `lib/db.ts` continuam como alternativa e saem do Next só quando o time adotar o Express como padrão (fase 13).

```
fetch <URL da API>/api/...  ->  routes -> middlewares -> controllers -> services -> repositories  ->  PostgreSQL (schema origem)
```

**Acesso ao banco no backend:** hoje, em dois caminhos.

- `pg`: o pool de `backend/src/config/db.ts`, usado por todos os repositories das rotas (produtos, pedidos, artesãos, avaliações, estatísticas, usuários e saúde do banco), com o mesmo SQL que roda no Next.
- **Prisma 7 + `@prisma/adapter-pg`** (PI4-128): client em `backend/src/config/prisma.ts` e schema em `backend/prisma/schema.prisma`, introspectado do esquema `origem`. Hoje só `repositories/popularidadeRepository.ts` (view de popularidade) usa o Prisma, e **nenhuma rota chama esse repository ainda**: ele é exercitado pelo `npm run prisma:verificar`.

Passar os repositories do `pg` para o Prisma (ou manter os dois, cada um com seu papel) é uma **decisão pendente do time**. Pelas regras de `docs/arquitetura-backend.md`, a troca mexe só em `repositories/`.

Regras de arquitetura:

- Código que usa `pg` fica **só no servidor** (`lib/servidor/*`, `app/api/*`, `lib/db.ts`, `lib/motorRecomendacao.ts`, e `backend/`). Componentes de cliente nunca importam esses arquivos (o driver precisa de `fs` e quebra o build do navegador). Quando a tela precisa do dado, ela chama a rota.
- Toda rota de escrita pega o usuário **da sessão** (JWT no cookie `httpOnly`), nunca do corpo da requisição, e confere o perfil (`comprador`, `artesao`, `admin`) antes de tocar no banco. Vale no Next e no Express.
- Pedido e itens são gravados na **mesma transação** (o gatilho do banco confere `valor_total = soma dos itens` no `COMMIT`). Estoque é travado com `SELECT ... FOR UPDATE`. No Express, a transação fica em `backend/src/repositories/transacao.ts`.
- Erro 404 vira `undefined` na função do front (a tela mostra "não encontrado"); qualquer outro erro é lançado e a tela oferece "tentar de novo".

## 2. Mapa completo: função de `apiFalsa.ts` → rota → tabelas

Legenda de situação: **Migrada** (já lê do banco pelas rotas do Next), **Sem uso** (nenhuma tela chama mais; substituída pela rota indicada), **Pendente** (ainda lê o mock).
Coluna **Express**: se a rota equivalente já existe em `backend/` (o front a chama quando a `API_URL` está definida; PI4-132).

### 2.1 Leitura

| Função em `apiFalsa.ts` | Rota / consulta equivalente | Tabelas | Situação | Express |
|---|---|---|---|---|
| `getProdutos(tecnica?, busca?, regiao?, categoria?)` | `GET /api/produtos?tecnica=&busca=&regiao=&categoria=` | `produto`, `artesao`, `usuario` | **Migrada** (usada em `VisaoVitrine`) | Existe |
| `getProdutoPorId(id)` | `GET /api/produtos/:id` | `produto`, `artesao`, `usuario` | **Migrada** (página do produto) | Existe |
| `getProdutosRelacionados(produtoId, limite)` | `GET /api/produtos/:id/relacionados?limite=` (mesma técnica, exclui o próprio produto) | `produto`, `artesao`, `usuario` | **Migrada** | Existe |
| `getResumoAvaliacoes(produtoId)` | `GET /api/produtos/:id/avaliacoes` (média e quantidade) | `avaliacao` | **Migrada** | Existe |
| `getPerfilArtesao(artesaoId)` | `GET /api/artesaos/:id` | `artesao`, `usuario`, `produto` | **Migrada** (perfil público) | Existe |
| `getProdutosDoArtesao(usuarioId)` | `GET /api/produtos` filtrado por `artesaoUsuarioId` em `contextoProdutos` | `produto`, `artesao` | **Sem uso** (ainda é mock; remover) | — |
| `getEstatisticasPainel(usuarioId)` | `GET /api/painel/estatisticas` (usa a sessão; artesão vê o próprio; o admin não tem loja e recebe tudo zerado) | `pedido`, `item_pedido`, `produto`, `artesao` | **Sem uso** (a tela chama a rota; remover) | Existe |
| `getProdutosBase()` | `GET /api/produtos` | `produto` | **Sem uso** (remover) | Existe |
| `getPedidos()` e `getItensPedido()` | `GET /api/pedidos` (já devolve o pedido com seus itens; comprador vê os dele, artesão vê os que contêm produtos dele, admin vê todos) | `pedido`, `item_pedido`, `produto`, `usuario` | **Sem uso** (`contextoPedidos` usa a rota; remover) | Existe |
| `getAvaliacoesTodas()` | Lida direto pelo servidor em `lib/motorRecomendacao.ts`; o front consome `GET /api/recomendacoes?limite=` | `avaliacao`, `produto`, `item_pedido` | **Sem uso** (remover) | Existe (`GET /api/recomendacoes`) |
| `getArtesaos()` | `GET /api/artesaos` (lista com nome, região, técnicas, total de produtos, `temLogin` e data de cadastro; só `admin`) | `artesao`, `usuario`, `produto` | **Migrada** na PI4-143: a rota entra com o PR #50, e `/admin`, `/admin/produtos` e `/admin/artesaos` passam a usá-la com o PR #52. Depois disso a função fica sem uso e sai na fase 8 | Entra com o PR #50 |
| `getUsuarios()` | Fundida com `GET /api/artesaos`, que já traz o nome (a única tela que a usa é a de gestão de artesãos, e só para achar o nome) | `usuario` | **Migrada** na PI4-143: a gestão de artesãos passa a usar a rota com o PR #52. Depois disso a função fica sem uso e sai na fase 8 | Entra com o PR #50 (`GET /api/artesaos`) |
| `tecnicas` (constante) | Constante `TECNICAS` de `lib/tipos.ts`, o domínio do `CHECK` da coluna `produto.tecnica` (a mesma lista que `GET /api/filtros` devolve) | — | **Migrada** na PI4-143: com o PR #52, a vitrine, o rodapé e o modal de produto passam a usar `TECNICAS` de `lib/tipos.ts`. Depois disso a constante de `apiFalsa.ts` fica sem uso e sai na fase 8 | — |
| `regioes`, `categorias` (constantes calculadas do mock) | `GET /api/filtros`, com as regiões distintas de `artesao.regiao_origem` e as categorias distintas de `produto.categoria` (D1: sem tabela de categorias); devolve também a lista fixa de `tecnicas` | `artesao`, `produto` | **Migrada** na PI4-143: a rota entra com o PR #50, e os filtros da vitrine e `/admin/categorias` passam a usá-la com o PR #52. Depois disso as constantes ficam sem uso e saem na fase 8 | Entra com o PR #50 |

### 2.2 Escrita (hoje nos contextos, não em `apiFalsa.ts`)

Estas operações nunca existiram em `apiFalsa.ts` (viviam em estado local dos contextos). Foram direto para rotas.

| Operação no front | Rota | Perfil exigido | Tabelas e regra | Express |
|---|---|---|---|---|
| `criarPedido` (`contextoPedidos`) | `POST /api/pedidos` | `comprador` | `pedido` + `item_pedido` **na mesma transação**; trava estoque; devolve 409 se faltar; ROLLBACK em qualquer erro | Existe |
| `marcarComoEnviado` | `PATCH /api/pedidos/:id` | `artesao` (dono) ou `admin` | atualiza `pedido.status` | Existe |
| Cadastrar produto (painel) | `POST /api/produtos` | `artesao` | insere em `produto` ligado ao artesão da sessão; foto como data URL de até 2 MB | Existe |
| Editar produto | `PATCH /api/produtos/:id` | `artesao` (dono) ou `admin` | atualiza `produto` | Existe |
| Login | `POST /api/auth/login` | público (limite de tentativas) | lê `usuario.senha_hash`; cria cookie de sessão | Existe |
| Cadastro | `POST /api/auth/cadastro` | público | cria `usuario` do tipo `comprador` e já inicia a sessão (conta de artesão não tem autocadastro; é criada por script/admin) | Existe |
| Logout / sessão atual | `POST /api/auth/logout`, `GET /api/auth/me` | — | só cookie; `me` revalida usuário e perfil no banco | Existe |
| Teste de conexão | `GET /api/saude-bd` | público | conta os produtos (`SELECT count(*) FROM origem.produto`); usado na validação do setup | Existe |

O Express tem ainda `GET /api/saude` (saúde da API, sem banco) e a documentação da API em `/api-docs` (Swagger UI) e `/api-docs.json`.

**Verificação das rotas de escrita e do painel no Express (PI4-131, 28/10/2026):** `GET/POST /api/pedidos`, `PATCH /api/pedidos/:id`, `POST /api/produtos`, `PATCH /api/produtos/:id` e `GET /api/painel/estatisticas` aplicam as regras de negócio abaixo, as mesmas do Next. O que muda é o **corpo de erro**: o Express responde `{ "ok": false, "erro": ... }` e as rotas de escrita do Next respondem só `{ "erro": ... }`. Status e mensagens são os mesmos. Hoje o front confere só o status, mas na PI4-132 qualquer código que leia `ok` ou compare o corpo inteiro precisa contar com essa diferença.

- Sessão obrigatória (401) e perfil (403) no middleware `exigirSessao`.
- Comprador e artesão vindos sempre da sessão: `compradorId`, `usuarioId`, `artesaoId`, `valorTotal` e `precoUnitario` enviados no corpo são ignorados.
- Dono do produto e do pedido conferido no service.
- Preço, total e estoque lidos do banco com `SELECT ... FOR UPDATE`, com pedido e itens na mesma transação.
- Quantidade inteira de 1 a 99 por linha.
- Foto em data URL de até ~2 MB (corpo JSON de até 4 MB, acima disso 413).
- Erros em `{ "ok": false, "erro": ... }`.

Testes:

- `backend/test/escritaSemBanco.test.ts`: 401, 403 e validação, sem banco.
- `backend/test/pedidosProdutos.test.ts`: gravação, dono e identidade da sessão. Só roda com `TEST_DATABASE_URL` (definida no terminal) apontando para um banco **descartável**. O `test/ajudantes.ts` aborta se ela for o mesmo banco (host sem `-pooler`, porta e nome) de alguma `DATABASE_URL`/`DIRECT_URL` do ambiente, do `backend/.env` ou do `.env.local`/`.env` da raiz, e exige `TEST_DB_REMOTO_DESCARTAVEL=1` para host remoto. No fim, a suíte apaga os pedidos e produtos que criou e restaura o estoque.
- `backend/test/travaBanco.test.ts`: testes unitários dessa trava.

Na escrita, o front chama o Next por padrão e o Express quando a `API_URL` está definida (PI4-132).

## 3. Ordem de migração e estado de cada fase

Princípio: **leitura primeiro, escrita depois, autenticação antes de qualquer escrita sensível**, sempre uma tela por vez e com o site funcionando ao final de cada fase.

| Fase | O que migra | Estado |
|---|---|---|
| 0 | Banco no ar, `lib/db.ts`, `DATABASE_URL`, rota `/api/saude-bd` (PI4-114 e PI4-115) | Concluída |
| 1 | Leitura do catálogo: vitrine, produto, relacionados, avaliações, perfil do artesão | Concluída |
| 2 | Ponte de ids antigos (`p1`, `u1`...) para UUID em `lib/idsLegados.ts`, para links e favoritos antigos não darem 404 | Concluída |
| 3 | Recomendação lendo do banco (`/api/recomendacoes`), com a regra de ranking isolada em `lib/rankingRecomendacao.ts` para o teste não depender do banco | Concluída |
| 4 | Escrita de pedidos (checkout e envio) | Concluída |
| 5 | Escrita de produtos (cadastro e edição pelo painel) | Concluída |
| 6 | Autenticação real, proteção por perfil (middleware + checagem em cada rota) e estatísticas do painel | Concluída |
| 7 | **Admin**: `getArtesaos`/`getUsuarios` → `GET /api/artesaos`; `regioes`/`categorias` → `GET /api/filtros` | **Concluída** na PI4-143, em três PRs com base `main`: rotas no Express e no `app/api` do Next (PR #50), telas do admin e filtros da vitrine (PR #52), senha dos artesãos e documentação (PR #51). Decisões D1 a D4 na seção 3.1 |
| 8 | Limpeza: apagar as funções "Sem uso" de `apiFalsa.ts` e, por último, `dadosFalsos.ts` | **Pendente**, na PI4-144 (o que entra está na seção 3.1) |
| 9 | Backend Express em camadas com as mesmas rotas, OpenAPI e Swagger (PI4-119: PI4-122 a PI4-126; PRs #26 e #30) | Concluída |
| 10 | Prisma no backend (PI4-128, PR #28) | **Em andamento**: Prisma configurado e conectado (lê as 8 tabelas e a view no `prisma:verificar`); os repositories das rotas continuam em `pg` (ver seção 1) |
| 11 | Front chamando o Express em vez de `app/api/*` (URL base, CORS e cookie): `lib/apiUrl.ts`, `rewrites` com `API_URL`, `CORS_ORIGIN` e `COOKIE_SAMESITE` | **Concluída**, opcional por variável de ambiente (PI4-132) |
| 12 | Sessão com JWT (HS256, `jose`) em cookie `httpOnly`, no Next e no Express, com o mesmo `SESSION_SECRET` (ver `docs/estrategia-autenticacao.md`, seção 12) | Concluída (PI4-130) |
| 13 | Remoção de `app/api/*`, `lib/servidor/*` e `lib/db.ts` | **Pendente** (depois de o time adotar o Express como padrão e validar login e escrita com o banco do time) |

Fases 1 a 6 vieram do PR #23, que só chegou à `main` pelo PR #29.

Antes de apagar `dadosFalsos.ts` (fase 8): rodar `npm test`, `npm run lint` e `npx tsc --noEmit`, e procurar por importações com `grep -rn dadosFalsos app components lib tests`. Hoje ele é importado por `lib/apiFalsa.ts` e pelos testes `tests/catalogo.test.mjs` e `tests/recomendacao.test.mjs`.

### 3.1 Fase 7 na PI4-143: decisões e o que fica para a fase 8

| Decisão | O que foi decidido | Como ficou |
|---|---|---|
| D1 | Categorias derivadas dos produtos, sem tabela própria | `GET /api/filtros` devolve as categorias distintas de `produto.categoria` e as regiões distintas de `artesao.regiao_origem`. As técnicas continuam a lista fixa do `CHECK` |
| D2 | Aprovação de artesãos e moderação de produtos continuam no navegador (`localStorage`), sem coluna nova no banco | Com o PR #52, as telas guardam esse estado pelo UUID do banco, não mais pelos ids do mock (aprovação por `artesao.id`, moderação por `produto.id`), e mostram um aviso de que é demonstração. Pendente é o artesão sem login; em revisão é o produto sem foto ou cadastrado nos últimos 7 dias |
| D3 | Senha dos artesãos sem login por um script com dry-run, preparado e testado só em banco descartável | `npm run contas:artesao` (PR #51). No Neon, quem roda é o responsável pelo banco (`docs/estrategia-autenticacao.md`, seção 13) |
| D4 | Três PRs com base `main`; as rotas novas no Express e no `app/api` do Next, com o mesmo contrato | PR #50 (rotas), PR #52 (telas) e PR #51 (script e documentação). As duas rotas novas respondem erro em `{ "ok": false, "erro" }` também no Next |

**Fica para a fase 8 (PI4-144):**

- Apagar de `lib/apiFalsa.ts` as funções marcadas como **Sem uso** na seção 2.1 (`getProdutosDoArtesao`, `getEstatisticasPainel`, `getProdutosBase`, `getPedidos`, `getItensPedido` e `getAvaliacoesTodas`) e, depois de o PR #52 trocar as telas pelas rotas e pela constante `TECNICAS`, também `getArtesaos`, `getUsuarios` e as constantes `tecnicas`, `regioes` e `categorias`. Nenhuma tela chama as seis primeiras, mas o `tests/catalogo.test.mjs` ainda usa `getProdutosDoArtesao`, `getEstatisticasPainel` e as três constantes, então o teste muda junto. Continua a constante `TECNICAS` de `lib/tipos.ts` (seção 2.1).
- Apagar `lib/dadosFalsos.ts` por último, depois de ajustar `tests/catalogo.test.mjs` e `tests/recomendacao.test.mjs`, com a verificação do parágrafo acima.

**Fica no backlog, fora da fase 8:** tabela de categorias, colunas de aprovação de artesão e de moderação de produto no banco, tela de criação de artesão no admin e troca de senha pelo próprio usuário.

## 4. Como as assinaturas foram preservadas

- O tipo de retorno de cada função continua sendo o de `lib/tipos.ts`. A rota devolve exatamente esse formato (campos como `artesaoNome` e `artesaoRegiao` já vêm juntados no SQL).
- Campos que o modelo físico não tinha foram **acrescentados como opcionais** (`artesaoUsuarioId?`, `visitasNoPerfil?`...), para nenhuma tela existente quebrar.
- Os ids do front viraram UUID no banco. `resolverId("p1")` converte o id antigo no UUID correspondente, então links antigos e o estado salvo no navegador continuam funcionando. No Express, a mesma ponte fica em `backend/src/utils/ids.ts`.

## 5. Pontos de atenção e diferenças em relação ao `CONTRATO_API.md`

1. O contrato propõe respostas no envelope `{ "sucesso": true, "dados": ... }`. As rotas implementadas devolvem **o JSON direto** (array ou objeto do tipo de `tipos.ts`). Nos erros, as rotas do Next respondem `{ "erro": "..." }` (as de leitura mais antigas ainda usam `"mensagem"`), e as do Express respondem sempre `{ "ok": false, "erro": "..." }`. Decisão a registrar com o time: atualizar o contrato para o que está implementado (recomendado, menos código) ou adaptar as rotas ao envelope. O contrato real do Express está em `backend/openapi.yaml`. Na PI4-143, o `CONTRATO_API.md` passou a descrever o formato de erro implementado, o `POST /api/auth/cadastro` e as duas rotas novas; os outros exemplos continuam os da proposta, como avisa o topo do contrato. As duas rotas novas do Next (`GET /api/artesaos` e `GET /api/filtros`) já respondem erro em `{ "ok": false, "erro" }`, como o Express.
2. O contrato descrevia `POST /api/usuarios` (comprador ou artesão); o que existe é `POST /api/auth/cadastro`, só para comprador, e o contrato foi atualizado na PI4-143. Artesãos novos continuam sendo criados por script SQL (a tela do admin está no backlog). Os que já estão no banco sem senha ganham uma pelo `npm run contas:artesao` (`docs/estrategia-autenticacao.md`, seção 13).
3. Visitas ao perfil (`visitasNoPerfil`) não existem no modelo físico; hoje o painel não mostra esse número. Se o time quiser, é uma nova coluna/tabela, fora do escopo desta etapa.
4. Não há tabela `categoria` no modelo. Pela decisão D1 da PI4-143, as categorias são as dos produtos, devolvidas por `GET /api/filtros`. Com o PR #52, a tela `/admin/categorias` fica só de leitura: lista as categorias de `GET /api/filtros`, com a contagem de produtos por categoria, e não grava mais nada no `localStorage`. A aprovação de artesãos (`/admin/artesaos`, por `artesao.id`; pendente é o artesão sem login) e a moderação de produtos (`/admin/produtos`, por `produto.id`; em revisão é o produto sem foto ou cadastrado nos últimos 7 dias) continuam só no `localStorage` (D2), como demonstração. Tabela de categorias e colunas de aprovação e moderação ficam no backlog (seção 3.1).
5. O limite de tentativas de login fica em memória, no Next e no Express (some ao reiniciar e não vale entre várias instâncias). Para produção, mover para o banco ou um cache.

## 6. Critérios de aceite (PI4-116)

- [x] Toda função de `apiFalsa.ts` tem rota ou consulta equivalente descrita (seção 2)
- [ ] Ordem de migração definida **e alinhada com o time** (seção 3 pronta; falta a revisão do time de WEB)
- [x] Documento versionado no repositório (`docs/plano-migracao-api.md`)
