# Arquitetura em camadas do backend: Raízes PE

**Subtarefa:** PI4-122 (história PI4-119, W13: organizar as camadas do backend e documentar a API)
**Situação em:** 22/10/2026
**Documentos relacionados:** `docs/plano-migracao-api.md` (PI4-116), `docs/estrategia-autenticacao.md` (PI4-117), `backend/README.md` (PI4-127)

## 1. Onde fica o backend

A decisão da PI4-121 adotou a stack de referência da disciplina (Node.js, Express, Prisma e JWT), com o front em Next.js. O backend é o projeto Express em `backend/`, criado na PI4-127. As rotas que hoje vivem em `app/api/*` (route handlers do Next) e as funções de `lib/servidor/*` são portadas para lá, uma camada por vez, **sem mudar o contrato** (mesmo método, caminho, corpo, resposta de sucesso e código HTTP).

Os repositories das rotas usam o `pg` diretamente (`config/db.ts`), com o mesmo SQL que já roda no Next. O Prisma (PI4-128) já está configurado (`config/prisma.ts`, `prisma/schema.prisma`), mas hoje só o `repositories/popularidadeRepository.ts` o usa, e nenhuma rota chama esse repository. Se o time decidir passar os repositories para o Prisma, **só os arquivos de `repositories/` mudam**; services, controllers e rotas continuam iguais. *(Atualizado na PI4-135, 27/10/2026.)*

## 2. As camadas

```
requisição HTTP
   │
   ▼
routes/        mapeia método + caminho → middlewares + controller
   │
middlewares/   sessão e perfil (exigirSessao), tratamento de erro, 404
   │
controllers/   lê req (params, query, body, sessão), chama o service, escreve res
   │
services/      regra de negócio e validação de entrada; lança ErroHttp
   │
repositories/  SQL (hoje pg, depois Prisma); devolve objetos de domínio
   │
config/        env validado e pool do banco
```

| Camada | Responsabilidade | Pode importar | Não pode |
|---|---|---|---|
| `routes/` | Declarar as rotas e encadear middlewares e controller | `express`, `controllers/`, `middlewares/` | Ter lógica |
| `controllers/` | Traduzir HTTP para chamada de função e de volta (status, cookie, JSON) | `express`, `services/`, `utils/` | Falar com o banco |
| `services/` | Validar entrada, aplicar regras (dono do produto, perfil que pode mudar status, estoque, total do pedido) | `repositories/`, `utils/`, `types/` | Importar `express` ou `pg` |
| `repositories/` | Executar SQL e converter linhas (snake_case) em objetos (`types/`) | `config/db`, `types/` | Importar `express`; decidir regra de negócio |
| `middlewares/` | Preocupações transversais: sessão, perfil, erros, rota inexistente | `express`, `services/`, `utils/` | Falar com o banco direto |
| `config/` | Ler e validar variáveis de ambiente; criar o pool | `pg`, `dotenv` | — |
| `utils/` | Funções puras e reaproveitáveis (ErroHttp, ids, senha, token, cookies) | Node (`node:crypto`) | Importar `express` ou o banco |
| `types/` | Tipos de domínio (espelho de `lib/tipos.ts` do front) | — | — |

**Regra de ouro (critério da PI4-122):** `services/` e `repositories/` não importam `express` (nem `next/*`). Assim a regra de negócio pode ser testada sem servidor HTTP e trocada de framework sem reescrita.

Erros: qualquer camada lança `ErroHttp(status, mensagem)`; o middleware `tratadorDeErros` responde `{ "ok": false, "erro": "<mensagem>" }` com o status certo. Erros inesperados viram 500 sem expor a mensagem interna.

## 3. Mapa: arquivo atual → camada de destino

Os caminhos à esquerda são os do app Next (a integração com o banco do PR #23 chegou à `main` pelo PR #29). À direita, tudo é relativo a `backend/src/`.

### 3.1 Infraestrutura e utilitários

| Arquivo atual | Destino | Observação |
|---|---|---|
| `lib/db.ts` | `config/db.ts` | Pool único; `DATABASE_URL` validada em `config/env.ts` |
| `lib/sessao.ts` (criar/ler token) | `utils/tokenSessao.ts` | Mesmo token do cookie `raizes_sessao`, compatível com o `middleware.ts` do Next: desde a PI4-130, um JWT HS256 (`jose`), nos dois lados |
| `lib/sessao.ts` (`PERFIS_POR_AREA`) | Fica no front | Só o `middleware.ts` e a barra de navegação usam |
| `lib/servidor/auth.ts` (`hashSenha`, `verificarSenha`) | `utils/senha.ts` | scrypt, sem mudança de formato |
| `lib/servidor/auth.ts` (`obterSessao`, `exigirSessao`) | `middlewares/sessao.ts` | `carregarSessao` (opcional) e `exigirSessao(perfis?)` reaproveitáveis em qualquer rota |
| `lib/idsLegados.ts` (`ehUuid`, `resolverId`) | `utils/ids.ts` | Ponte dos ids antigos (`p1`, `u2`) para UUID |
| Cookie no route handler (`resposta.cookies.set`) | `utils/cookies.ts` + controller | Leitura do cabeçalho `Cookie` sem dependência nova |
| `lib/tipos.ts` | `types/dominio.ts` | Cópia dos tipos que a API devolve |
| Tratamento de erro repetido em cada `route.ts` (`try/catch` + `NextResponse.json`) | `middlewares/erros.ts` | Um único tratador; corpo JSON inválido vira 400 |
| `app/api/saude-bd/route.ts` | `routes/saudeRoutes.ts` → `controllers/saudeController.ts` → `services/saudeService.ts` → `repositories/saudeRepository.ts` | `GET /api/saude-bd` |

### 3.2 Pedidos e produtos (escrita) — PI4-123

| Arquivo atual | Destino |
|---|---|
| `app/api/pedidos/route.ts` (GET, POST) | `routes/pedidoRoutes.ts`, `controllers/pedidoController.ts` |
| `app/api/pedidos/[id]/route.ts` (PATCH) | `routes/pedidoRoutes.ts`, `controllers/pedidoController.ts` |
| `lib/servidor/pedidos.ts` — validação, estoque, total, quem pode mudar o status | `services/pedidoService.ts` |
| `lib/servidor/pedidos.ts` — SELECT/INSERT/UPDATE de `pedido` e `item_pedido` | `repositories/pedidoRepository.ts` |
| `lib/servidor/pedidos.ts` — `BEGIN`/`COMMIT`/`ROLLBACK` | `repositories/transacao.ts` (`emTransacao`) |
| `app/api/produtos/route.ts` (POST) e `app/api/produtos/[id]/route.ts` (PATCH) | `routes/produtoRoutes.ts`, `controllers/produtoController.ts` |
| `lib/servidor/produtos.ts` — `validarCampos`, técnica válida, dono do produto | `services/produtoService.ts` |
| `lib/servidor/produtos.ts` — INSERT/UPDATE de `produto`, busca do artesão | `repositories/produtoRepository.ts`, `repositories/artesaoRepository.ts` |

### 3.3 Autenticação, catálogo, recomendações e painel — PI4-124

| Arquivo atual | Destino |
|---|---|
| `app/api/auth/login/route.ts` | `routes/authRoutes.ts`, `controllers/authController.ts`; limite de tentativas em `services/authService.ts` |
| `app/api/auth/cadastro/route.ts` | idem |
| `app/api/auth/logout/route.ts`, `app/api/auth/me/route.ts` | idem |
| `lib/servidor/auth.ts` — `autenticar`, `cadastrarComprador` | `services/authService.ts` |
| `lib/servidor/auth.ts` — consultas a `usuario` | `repositories/usuarioRepository.ts` |
| `app/api/produtos/route.ts` (GET), `app/api/produtos/[id]/route.ts` (GET) | `routes/produtoRoutes.ts`, `controllers/produtoController.ts` |
| `app/api/produtos/[id]/relacionados/route.ts`, `.../avaliacoes/route.ts` | `routes/produtoRoutes.ts`, `controllers/produtoController.ts` |
| `app/api/artesaos/[id]/route.ts` | `routes/artesaoRoutes.ts`, `controllers/artesaoController.ts` |
| `lib/servidor/catalogo.ts` — filtros, busca sem acento, limites | `services/catalogoService.ts` |
| `lib/servidor/catalogo.ts` — SQL de produto, artesão e avaliação | `repositories/produtoRepository.ts`, `repositories/artesaoRepository.ts`, `repositories/avaliacaoRepository.ts` |
| `app/api/recomendacoes/route.ts` | `routes/recomendacaoRoutes.ts`, `controllers/recomendacaoController.ts` |
| `lib/motorRecomendacao.ts` | `services/recomendacaoService.ts` (busca os dados nos repositories) |
| `lib/rankingRecomendacao.ts` | `services/rankingRecomendacao.ts` (regra pura, sem banco) |
| `app/api/painel/estatisticas/route.ts` | `routes/painelRoutes.ts`, `controllers/painelController.ts` |
| `lib/servidor/estatisticas.ts` — janela de 6 meses, variação, porcentagens | `services/painelService.ts` |
| `lib/servidor/estatisticas.ts` — SQL de vendas | `repositories/estatisticaRepository.ts` |

### 3.4 O que fica no front (Next)

| Arquivo | Por quê |
|---|---|
| `middleware.ts` | Protege **páginas** (redireciona para `/login`). Lê o mesmo cookie; continua no Next |
| `lib/apiUrl.ts` | Ponto único das chamadas do front à API (`apiFetch`): URL base (`NEXT_PUBLIC_API_URL`) e `credentials: "include"` |
| `lib/apiFalsa.ts`, `lib/contexto*.tsx`, `app/painel`, `SecaoRecomendados` | Clientes da API. Chamam sempre por `apiFetch` (PI4-132) |
| `app/api/*`, `lib/servidor/*`, `lib/db.ts` | Ficam como alternativa quando não há `BACKEND_URL`; saem quando o Express virar o padrão |

### 3.5 Ligação do front ao Express (PI4-132)

Dois modos, escolhidos por variável de ambiente:

| | Proxy do Next (recomendado) | Chamada direta em outra origem |
|---|---|---|
| Como ligar | `BACKEND_URL=http://localhost:4000` no `.env.local` (lida pelo `next.config.mjs`) | `NEXT_PUBLIC_API_URL=<url do Express>` no front (lida no build); `CORS_ORIGIN` no `backend/.env` |
| Origem vista pelo navegador | Uma só (a do site). `rewrites` com `beforeFiles` repassa `/api/*` ao Express | Duas (site e API) |
| CORS | Não precisa | Sim: `middlewares/cors.ts` libera só as origens de `CORS_ORIGIN`, com `Access-Control-Allow-Credentials` (nunca `*`) e responde o preflight |
| Cookie de sessão | Do domínio do site; `SameSite=Lax` basta | Do domínio da API. Entre domínios diferentes: `COOKIE_SAMESITE=none` (o backend força `Secure`, então só com HTTPS). Em `localhost` com portas diferentes o `Lax` funciona, pois as portas não mudam o "site" |
| `middleware.ts` | Vê o cookie e valida o JWT nas páginas protegidas | **Não vê o cookie** (ele pertence ao domínio da API): as páginas protegidas redirecionam para `/login` mesmo com sessão. Só funciona se front e API compartilharem um domínio pai com `Domain` no cookie |
| Corpo de erro | Igual ao do Express: `{ "ok": false, "erro": ... }` | Igual |

Por isso o proxy é o modo recomendado: é o que mantém o `middleware.ts` útil. Todas as chamadas passam por `lib/apiUrl.ts` (`apiFetch`), que envia o cookie nos dois modos. O front só lê o status e `erro` do corpo, então a diferença de `ok` descrita em `docs/plano-migracao-api.md` não o afeta.

Verificação rápida: com `BACKEND_URL` definida, `GET http://localhost:3000/api/saude` responde `{"ok":true}`; essa rota só existe no Express.

## 4. Estado da migração (22/10/2026)

| Grupo de rotas | Subtarefa | Situação no Express |
|---|---|---|
| `GET/POST /api/pedidos`, `PATCH /api/pedidos/:id` | PI4-123 | Migrada, com testes |
| `POST /api/produtos`, `PATCH /api/produtos/:id` | PI4-123 | Migrada, com testes |
| `POST /api/auth/login`, `/cadastro`, `/logout`, `GET /api/auth/me` | PI4-124 | Migrada, com testes |
| `GET /api/produtos`, `/:id`, `/:id/relacionados`, `/:id/avaliacoes`, `GET /api/artesaos/:id` | PI4-124 | Migrada, com testes |
| `GET /api/recomendacoes` | PI4-124 | Migrada, com testes |
| `GET /api/painel/estatisticas` | PI4-124 | Migrada, com testes |
| `GET /api/saude-bd` | PI4-124 | Migrada, com teste |

Middlewares reaproveitáveis: `exigirSessao(perfis?)` (401/403), `carregarSessao` (sessão opcional, usada nas recomendações), `naoEncontrado` e `tratadorDeErros` (corpo JSON inválido vira 400, corpo acima de 4 MB vira 413).

Pendências, todas fora do escopo da PI4-119:

- **Prisma (PI4-128)**: já configurado (PR #28), mas os repositories das rotas continuam em `pg`; passar para o Prisma é decisão pendente do time e troca só `repositories/`.
- **JWT (PI4-130)**: concluído; no backend, a troca ficou em `utils/tokenSessao.ts`, com o `authController` e o `sessaoService` passando a aguardar o token assíncrono (ver `docs/estrategia-autenticacao.md`, seção 12).
- **Front apontando para o Express (PI4-132)**: concluído por variável de ambiente (seção 3.5). Sem `BACKEND_URL`, o front continua usando os route handlers do Next, que respondem igual.
- **`GET /api/artesaos` (lista) e `GET /api/filtros`**: nunca existiram no Next (fase 7 do `plano-migracao-api.md`), então não são migração; entram como rotas novas.

### Testes

`cd backend && npm test` sobe o app numa porta livre e chama as rotas com `fetch` (`node:test`). Os testes que não tocam o banco (401, 400, 404, logout) rodam sempre. Os que gravam pedidos, produtos e usuários só rodam com `TEST_DATABASE_URL` (definida no terminal, não no `backend/.env`) apontando para um banco **descartável**, carregado com `db/01`, `04`, `05`, `06` e `07`; nunca use o Neon do time. A trava em `test/ajudantes.ts` aborta se for o mesmo banco do time e exige `TEST_DB_REMOTO_DESCARTAVEL=1` para host remoto (ver `backend/README.md`).

## 5. Contrato

Nenhuma rota muda de método, caminho, corpo de entrada, corpo de sucesso ou status. A única padronização é o **corpo de erro**: as rotas de leitura do catálogo respondiam `{ "mensagem": ... }` e as de escrita `{ "erro": ... }`; agora todas respondem `{ "ok": false, "erro": ... }` (formato do middleware da PI4-127). O front não lê o campo `mensagem` em nenhum lugar (confere só o status), então a mudança é compatível.

A especificação completa fica em `backend/openapi.yaml` (PI4-125) e é servida em `/api-docs` (PI4-126).
