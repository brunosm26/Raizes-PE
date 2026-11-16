# Migração dos dados de exemplo para a API real (histórico)

**Subtarefa:** PI4-116 (história PI4-113, W10 – Preparação do ambiente para integração). Atualizado na PI4-135, na PI4-143, na PI4-144 e na PI4-146.
**Situação em:** 16/11/2026. **A migração do front terminou:** todas as telas leem e gravam pela API, e os dados de exemplo foram removidos (fase 8, PI4-144). Seguem pendentes a troca dos repositories para o Prisma (fase 10, decisão do time), a remoção das rotas do Next (fase 13) e a baseline das migrations no Neon (fase 14).
**Documentos relacionados:** `docs/CONTRATO_API.md` (contrato proposto), `docs/estrategia-autenticacao.md` (PI4-117), `docs/arquitetura-backend.md` (PI4-122, camadas do Express), `backend/README.md` (Express, Prisma e migrations), `docs/publicacao.md` (Vercel, Render e Neon), `db/` (modelo físico)

## 1. Objetivo, regra de ouro e onde o código ficou

**Objetivo (cumprido):** trocar os dados mockados por consultas ao PostgreSQL **sem quebrar as telas durante a migração**.

**Regra de ouro (histórico):** durante a migração, as telas continuaram chamando as mesmas funções do antigo `lib/apiFalsa.ts` (mesmo nome, mesmos parâmetros, mesmo tipo de retorno de `lib/tipos.ts`). Só o corpo de cada função mudou, de "ler array em memória" (os dados de `lib/dadosFalsos.ts`) para `fetch("/api/...")`. Na PI4-144, os dois arquivos foram apagados. As funções que chamam a API, com as mesmas assinaturas, ficaram em:

- `lib/apiCatalogo.ts`: catálogo (vitrine, produto, relacionados, avaliações e perfil do artesão);
- `lib/apiAdminFiltros.ts`: `GET /api/artesaos` (admin) e `GET /api/filtros` (opções dos filtros).

As demais leituras e todas as escritas ficam nos contextos (`lib/contexto*.tsx`) e em algumas telas. Todas passam por `apiFetch` (`lib/apiUrl.ts`).

Caminho em uso:

```
Tela / contexto  ->  lib/apiCatalogo.ts, lib/apiAdminFiltros.ts ou contexto  ->  apiFetch("/api/...")
  com API_URL (padrão do .env.example e do site publicado):
      Next repassa  ->  Express: routes -> middlewares -> controllers -> services -> repositories  ->  PostgreSQL (schema origem)
  sem API_URL (alternativa para rodar só o front):
      app/api (route handler)  ->  lib/servidor/*.ts  ->  pool (lib/db.ts)  ->  PostgreSQL (schema origem)
```

O Express em `backend/` (PI4-119) e as rotas `app/api/*` do Next têm o mesmo contrato. A escolha é feita pela `API_URL` (PI4-132: `rewrites` no `next.config.mjs`, `lib/apiUrl.ts`, `CORS_ORIGIN` e `COOKIE_SAMESITE` no backend). `app/api/*`, `lib/servidor/*` e `lib/db.ts` saem do Next na fase 13.

**Acesso ao banco no backend:** em dois caminhos.

- `pg`: o pool de `backend/src/config/db.ts`, usado por todos os repositories das rotas (produtos, pedidos, artesãos, avaliações, estatísticas, usuários e saúde do banco), com o mesmo SQL que roda no Next.
- **Prisma 7 + `@prisma/adapter-pg`** (PI4-128): client em `backend/src/config/prisma.ts` e schema em `backend/prisma/schema.prisma`. Hoje só `repositories/popularidadeRepository.ts` (view de popularidade) usa o Prisma, e **nenhuma rota chama esse repository ainda**: ele é exercitado pelo `npm run prisma:verificar`. Desde a PI4-147, as migrations do Prisma (`backend/prisma/migrations`) definem o DDL.

Passar os repositories do `pg` para o Prisma (ou manter os dois, cada um com seu papel) é uma **decisão pendente do time**. Pelas regras de `docs/arquitetura-backend.md`, a troca mexe só em `repositories/`.

Regras de arquitetura:

- Código que usa `pg` fica **só no servidor** (`lib/servidor/*`, `app/api/*`, `lib/db.ts`, `lib/motorRecomendacao.ts`, e `backend/`). Componentes de cliente nunca importam esses arquivos (o driver precisa de `fs` e quebra o build do navegador). Quando a tela precisa do dado, ela chama a rota.
- Toda rota de escrita pega o usuário **da sessão** (JWT no cookie `httpOnly`), nunca do corpo da requisição, e confere o perfil (`comprador`, `artesao`, `admin`) antes de tocar no banco. Vale no Next e no Express.
- Pedido e itens são gravados na **mesma transação** (o gatilho do banco confere `valor_total = soma dos itens` no `COMMIT`). Estoque é travado com `SELECT ... FOR UPDATE`. No Express, a transação fica em `backend/src/repositories/transacao.ts`.
- Erro 404 vira `undefined` na função do front (a tela mostra "não encontrado"); qualquer outro erro é lançado e a tela oferece "tentar de novo".

## 2. Mapa: chamada do front → rota → tabelas

Coluna **Express**: se a rota equivalente existe em `backend/` (o front a usa quando a `API_URL` está definida). Coluna **Antes**: a função dos dados de exemplo que a chamada substituiu.

### 2.1 Leitura

| Chamada no front | Rota | Tabelas | Antes (removido na PI4-144) | Express |
|---|---|---|---|---|
| `getProdutos(tecnica?, busca?, regiao?, categoria?)` em `lib/apiCatalogo.ts` (`VisaoVitrine`) | `GET /api/produtos?tecnica=&busca=&regiao=&categoria=` | `produto`, `artesao`, `usuario` | `getProdutos` (fase 1) | Existe |
| `getProdutoPorId(id)` em `lib/apiCatalogo.ts` (página do produto) | `GET /api/produtos/:id` | `produto`, `artesao`, `usuario` | `getProdutoPorId` (fase 1) | Existe |
| `getProdutosRelacionados(produtoId, limite)` em `lib/apiCatalogo.ts` | `GET /api/produtos/:id/relacionados?limite=` (mesma técnica, exclui o próprio produto) | `produto`, `artesao`, `usuario` | `getProdutosRelacionados` (fase 1) | Existe |
| `getResumoAvaliacoes(produtoId)` em `lib/apiCatalogo.ts` | `GET /api/produtos/:id/avaliacoes` (média e quantidade) | `avaliacao` | `getResumoAvaliacoes` (fase 1) | Existe |
| `getPerfilArtesao(artesaoId)` em `lib/apiCatalogo.ts` (perfil público) | `GET /api/artesaos/:id` | `artesao`, `usuario`, `produto` | `getPerfilArtesao` (fase 1) | Existe |
| `produtos` e `produtosDoArtesao(usuarioId)` em `contextoProdutos` | `GET /api/produtos` (filtrado por `artesaoUsuarioId` no contexto) | `produto`, `artesao`, `usuario` | `getProdutosDoArtesao`, `getProdutosBase` | Existe |
| `contextoPedidos` | `GET /api/pedidos` (o pedido já vem com os itens; comprador vê os dele, artesão os que têm produtos dele, admin todos) | `pedido`, `item_pedido`, `produto`, `usuario` | `getPedidos`, `getItensPedido` | Existe |
| painel do artesão (`app/painel`) | `GET /api/painel/estatisticas` (usa a sessão; o admin não tem loja e recebe tudo zerado) | `pedido`, `item_pedido`, `produto`, `artesao` | `getEstatisticasPainel` | Existe |
| `SecaoRecomendados` | `GET /api/recomendacoes?limite=` (o motor lê as avaliações e as compras no servidor) | `avaliacao`, `produto`, `item_pedido` | `getAvaliacoesTodas` | Existe |
| `getArtesaosAdmin()` em `lib/apiAdminFiltros.ts` (`/admin`, `/admin/artesaos`, `/admin/produtos`) | `GET /api/artesaos` (nome, região, técnicas, total de produtos, `temLogin` e data de cadastro; só `admin`) | `artesao`, `usuario`, `produto` | `getArtesaos`, `getUsuarios` (PI4-143) | Existe |
| `getOpcoesFiltros()` em `lib/apiAdminFiltros.ts` (filtros da vitrine e `/admin/categorias`) | `GET /api/filtros` (regiões distintas de `artesao.regiao_origem`, categorias distintas de `produto.categoria` e a lista fixa de técnicas) | `artesao`, `produto` | `regioes`, `categorias` (PI4-143) | Existe |
| constante `TECNICAS` em `lib/tipos.ts` (vitrine, rodapé, modal de produto) | — (o domínio do `CHECK` de `produto.tecnica`) | — | `tecnicas` (PI4-143) | — |

### 2.2 Escrita (nos contextos e nas telas)

Estas operações nunca passaram pelos dados de exemplo (viviam no estado local dos contextos) e foram direto para rotas.

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

**Verificação das rotas de escrita e do painel no Express (PI4-131, 28/10/2026):** `GET/POST /api/pedidos`, `PATCH /api/pedidos/:id`, `POST /api/produtos`, `PATCH /api/produtos/:id` e `GET /api/painel/estatisticas` aplicam as regras de negócio abaixo, as mesmas do Next. O que muda é o **corpo de erro**: o Express responde `{ "ok": false, "erro": ... }` e as rotas de escrita do Next respondem só `{ "erro": ... }`. Status e mensagens são os mesmos. O front confere só o status e o campo `erro`, então essa diferença não o afeta.

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

Na escrita, como na leitura, o front chama o Express quando a `API_URL` está definida (o padrão do `.env.example` e do site publicado) e as rotas do Next sem ela (PI4-132).

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
| 7 | **Admin**: lista de artesãos → `GET /api/artesaos`; regiões e categorias → `GET /api/filtros` | **Concluída** na PI4-143: rotas no Express e no `app/api` do Next (PR #50), telas do admin e filtros da vitrine (PR #52), senha dos artesãos e documentação (PR #51). Decisões D1 a D4 na seção 3.1 |
| 8 | Limpeza: apagar as funções sem uso e, por último, os dados de exemplo | **Concluída** na PI4-144 (PR #53): `lib/apiFalsa.ts` e `lib/dadosFalsos.ts` apagados, funções reais movidas para `lib/apiCatalogo.ts` e testes reescritos (seção 3.2) |
| 9 | Backend Express em camadas com as mesmas rotas, OpenAPI e Swagger (PI4-119: PI4-122 a PI4-126; PRs #26 e #30) | Concluída |
| 10 | Prisma no backend (PI4-128, PR #28) | **Em andamento**: Prisma configurado e conectado (lê as 8 tabelas e a view no `prisma:verificar`); os repositories das rotas continuam em `pg` (ver seção 1) |
| 11 | Front chamando o Express em vez de `app/api/*` (URL base, CORS e cookie): `lib/apiUrl.ts`, `rewrites` com `API_URL`, `CORS_ORIGIN` e `COOKIE_SAMESITE` | **Concluída** (PI4-132). É o modo do site publicado (PI4-134, `docs/publicacao.md`) e o padrão do `.env.example` |
| 12 | Sessão com JWT (HS256, `jose`) em cookie `httpOnly`, no Next e no Express, com o mesmo `SESSION_SECRET` (ver `docs/estrategia-autenticacao.md`, seção 12) | Concluída (PI4-130) |
| 13 | Remoção de `app/api/*`, `lib/servidor/*` e `lib/db.ts` | **Pendente** (decisão do time; hoje servem para rodar só o front) |
| 14 | Migrations do Prisma versionadas (`backend/prisma/migrations`: `0_init` do `schema.prisma` e `1_regras_sql` com CHECK, gatilhos, funções, view, perfis e comentários) e DDL final gerado (`db/ddl_final.sql`, `npm run db:ddl`). Um banco vazio migrado fica igual, pelo comparador de catálogo, ao montado pelos scripts de `db/` (PI4-147) | **Concluída** em banco local. Falta o responsável marcar a baseline no Neon (`migrate resolve --applied`, ver `backend/README.md`, seção Migrations) |

Fases 1 a 6 vieram do PR #23, que só chegou à `main` pelo PR #29.

### 3.1 Fase 7 na PI4-143: decisões

| Decisão | O que foi decidido | Como ficou |
|---|---|---|
| D1 | Categorias derivadas dos produtos, sem tabela própria | `GET /api/filtros` devolve as categorias distintas de `produto.categoria` e as regiões distintas de `artesao.regiao_origem`. As técnicas continuam a lista fixa do `CHECK` |
| D2 | Aprovação de artesãos e moderação de produtos continuam no navegador (`localStorage`), sem coluna nova no banco | As telas guardam esse estado pelo UUID do banco, não mais pelos ids do mock (aprovação por `artesao.id`, moderação por `produto.id`), e mostram um aviso de que é demonstração. Pendente é o artesão sem login; em revisão é o produto sem foto ou cadastrado nos últimos 7 dias |
| D3 | Senha dos artesãos sem login por um script com dry-run, preparado e testado só em banco descartável | `npm run contas:artesao`. No Neon, quem roda é o responsável pelo banco (`docs/estrategia-autenticacao.md`, seção 13) |
| D4 | Três PRs com base `main`; as rotas novas no Express e no `app/api` do Next, com o mesmo contrato | PR #50 (rotas), PR #52 (telas) e PR #51 (script e documentação); a fase 8 veio em seguida, no PR #53 (PI4-144). As duas rotas novas respondem erro em `{ "ok": false, "erro" }` também no Next |

### 3.2 Fase 8 na PI4-144 e o que fica no backlog

- **Removido:** as funções sem uso e as constantes dos dados de exemplo, os dois arquivos (`lib/apiFalsa.ts` e `lib/dadosFalsos.ts`) e os campos `visitasNoPerfil`/`visitasDeltaPct` de `lib/tipos.ts`. As cinco funções que já chamavam a API foram para `lib/apiCatalogo.ts` sem mudar assinatura nem comportamento.
- **Testes:** `tests/catalogo.test.mjs` testa `lib/apiCatalogo.ts` com um `fetch` dublê (URL, opções, 404 e erros). `tests/recomendacao.test.mjs` usa `tests/fixtures/cargaDemo.mjs`, um recorte da carga `db/05` com os UUIDs reais. A busca manual por importações que esta fase pedia virou o **`tests/telasSemMock.test.mjs`**: ele varre todo o código do repositório e falha se algum arquivo importar os dois módulos removidos ou se eles voltarem a existir.
- **Cobertura:** técnica, busca sem acento, produto, relacionados, avaliações, perfil e painel são testados nas rotas em `backend/test/catalogoAuthPainel.test.ts` (com banco). O filtro por região e categoria de `/api/produtos` ainda não tem teste de rota no backend.

**Backlog:** tabela de categorias, colunas de aprovação de artesão e de moderação de produto no banco, tela de criação de artesão no admin e troca de senha pelo próprio usuário.

## 4. Como as assinaturas foram preservadas

- O tipo de retorno de cada função continua sendo o de `lib/tipos.ts`. A rota devolve exatamente esse formato (campos como `artesaoNome` e `artesaoRegiao` já vêm juntados no SQL).
- Campos que o modelo físico não tinha foram **acrescentados como opcionais** (por exemplo, `artesaoUsuarioId?`), para nenhuma tela existente quebrar. Os campos de visitas ao perfil, que só os dados de exemplo preenchiam, saíram na PI4-144.
- Os ids do front viraram UUID no banco. `resolverId("p1")` converte o id antigo no UUID correspondente, então links antigos e o estado salvo no navegador continuam funcionando. No Express, a mesma ponte fica em `backend/src/utils/ids.ts`.

## 5. Pontos de atenção e diferenças em relação ao `CONTRATO_API.md`

1. O contrato propõe respostas no envelope `{ "sucesso": true, "dados": ... }`. As rotas implementadas devolvem **o JSON direto** (array ou objeto do tipo de `tipos.ts`). Nos erros, as rotas do Next respondem `{ "erro": "..." }` (as de leitura mais antigas ainda usam `"mensagem"`), e as do Express respondem sempre `{ "ok": false, "erro": "..." }`. Decisão a registrar com o time: atualizar o contrato para o que está implementado (recomendado, menos código) ou adaptar as rotas ao envelope. O contrato real do Express está em `backend/openapi.yaml`. Na PI4-143, o `CONTRATO_API.md` passou a descrever o formato de erro implementado, o `POST /api/auth/cadastro` e as duas rotas novas; os outros exemplos continuam os da proposta, como avisa o topo do contrato. As duas rotas novas do Next (`GET /api/artesaos` e `GET /api/filtros`) respondem erro em `{ "ok": false, "erro" }`, como o Express.
2. O contrato descrevia `POST /api/usuarios` (comprador ou artesão); o que existe é `POST /api/auth/cadastro`, só para comprador, e o contrato foi atualizado na PI4-143. Artesãos novos continuam sendo criados por script SQL (a tela do admin está no backlog). Os que já estão no banco sem senha ganham uma pelo `npm run contas:artesao` (`docs/estrategia-autenticacao.md`, seção 13).
3. Visitas ao perfil não existem no modelo físico. Os campos `visitasNoPerfil` e `visitasDeltaPct`, que só os dados de exemplo preenchiam, saíram de `lib/tipos.ts` na PI4-144, e o painel não mostra esse número. Se o time quiser, é uma nova coluna/tabela.
4. Não há tabela `categoria` no modelo. Pela decisão D1 da PI4-143, as categorias são as dos produtos, devolvidas por `GET /api/filtros`. A tela `/admin/categorias` é só de leitura: lista as categorias de `GET /api/filtros`, com a contagem de produtos por categoria, e não grava mais nada no `localStorage`. A aprovação de artesãos (`/admin/artesaos`, por `artesao.id`; pendente é o artesão sem login) e a moderação de produtos (`/admin/produtos`, por `produto.id`; em revisão é o produto sem foto ou cadastrado nos últimos 7 dias) continuam só no `localStorage` (D2), como demonstração. Tabela de categorias e colunas de aprovação e moderação ficam no backlog (seção 3.2).
5. O limite de tentativas de login fica em memória, no Next e no Express (some ao reiniciar e não vale entre várias instâncias). Para produção, mover para o banco ou um cache.

## 6. Critérios de aceite (PI4-116)

- [x] Toda função dos antigos dados de exemplo tem rota ou consulta equivalente descrita (seção 2)
- [ ] Ordem de migração definida **e alinhada com o time** (seção 3 pronta; falta a revisão do time de WEB)
- [x] Documento versionado no repositório (`docs/plano-migracao-api.md`)
