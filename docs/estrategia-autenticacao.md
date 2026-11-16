# Estratégia de autenticação: Raízes PE

PI4-117, subtarefa da PI4-113 (W10, Preparação do ambiente para integração). Atualizado na PI4-135, na PI4-130 e na PI4-143.
**Situação em 15/11/2026:**

- **Implementado:** sessão em **JWT (HS256, biblioteca `jose`) guardado no cookie `httpOnly` `raizes_sessao`**, assinado com o `SESSION_SECRET`, com a senha em scrypt. O mesmo token é emitido e aceito pelo app Next (`lib/sessao.ts`) e pelo backend Express (`backend/src/utils/tokenSessao.ts`). A troca do antigo cookie assinado próprio (HMAC-SHA256, "corpo.assinatura") pelo JWT é da PI4-130 (seção 12).
- **Senha das contas de artesão (PI4-143):** os artesãos que estão no banco sem senha ganham uma pelo script `npm run contas:artesao`, rodado pelo responsável pelo banco do time (seção 13).
- As seções 1 a 10 registram a decisão original da PI4-117; onde a PI4-130 mudou algo, há uma nota. A seção 11 descreve o Express.

Este documento registra a decisão que está no código. Ele substitui a proposta inicial (Auth.js com bcrypt, PR #21); as diferenças estão na seção 10.

## 1. Contexto

Antes da integração, o login em `/login` comparava e-mail e senha com três credenciais fixas e as áreas logadas usavam usuários de demonstração cravados no código (`u2` no `/painel`, `u7` no `/meus-pedidos` e no checkout). O cadastro em `/cadastro` não gravava nada.

Com o PostgreSQL no Neon (PI4-114) e a conexão pronta (PI4-115), a autenticação precisa:

- validar as credenciais contra a tabela `usuario`;
- guardar a senha de forma segura;
- saber o perfil de quem está logado (comprador, artesão ou admin) e bloquear rotas de acordo;
- funcionar no deploy atual sem serviço externo pago.

## 2. Opções avaliadas

| Critério | A. Sessão em tabela do banco | B. Cookie assinado próprio (token sem estado) | C. Auth.js v5 (Credentials + JWT) | D. Serviço gerenciado (Clerk, Supabase Auth, Firebase) |
|---|---|---|---|---|
| Esforço de implementação | Alto | Médio | Baixo | Baixo |
| Segurança "de fábrica" (CSRF, rotação, expiração) | Depende de nós | Depende de nós | Pronta e mantida | Pronta |
| Usa a nossa tabela `usuario` | Sim | Sim | Sim | Não: duplica usuários fora do nosso banco |
| Exige tabela nova no banco | Sim (`sessao`) | Não | Não | Não |
| Dependência nova no projeto | Não | Não | Sim (`next-auth`, configuração, tipos) | Sim (conta externa) |
| Roda no middleware (Edge) e nas rotas (Node) com o mesmo código | Não (precisa do banco no middleware) | Sim (Web Crypto) | Sim | Sim |
| Revogar a sessão na hora | Sim | Não (só por expiração), mas a API revalida o usuário no banco | Não | Sim |
| Custo / lock-in | Nenhum | Nenhum | Nenhum | Plano gratuito com limites |

## 3. Decisão

**Opção B: cookie de sessão assinado (HMAC-SHA256), sem estado no servidor, com a senha em scrypt.**

> **Atualização da PI4-130:** o token sem estado continua, mas o formato próprio "corpo.assinatura" virou um **JWT HS256** gerado pela biblioteca `jose` (seção 12). Com isso, o primeiro motivo abaixo ("sem dependência nova") deixou de valer: a `jose` entrou no projeto. Os demais continuam valendo, já que a `jose` usa Web Crypto e roda no Edge.

### Por que

- **Sem dependência nova.** Usa só `node:crypto` (senha) e Web Crypto (assinatura do cookie). Nada para instalar, atualizar ou configurar.
- **Mesmo código no middleware e na API.** A verificação do cookie usa Web Crypto, que existe tanto no runtime Edge do `middleware.ts` quanto no Node das rotas.
- **Código pequeno e auditável.** Toda a autenticação está em `lib/sessao.ts` (cookie) e `lib/servidor/auth.ts` (senha, login, cadastro, sessão). O time consegue ler inteiro.
- **A autorização não confia só no cookie.** Toda rota de API revalida no banco se o usuário ainda existe e se o perfil é o mesmo (`obterSessao`), então conta removida ou perfil alterado deixa a sessão sem efeito na API.
- **Não cria tabela nova** nem acopla a escolha do banco ou do driver.

### Por que as outras ficaram de fora

- **A, sessão em tabela:** é a melhor para revogar na hora, mas exige tabela `sessao`, limpeza de sessões vencidas e acesso ao banco no middleware, que roda no Edge.
- **C, Auth.js:** é uma boa opção e continua possível. Para um fluxo de um único provider, o ganho não compensou a dependência e a configuração extra neste prazo. A fronteira (`obterSessao` e `exigirSessao`) ficou isolada, então uma troca futura mexe em poucos arquivos.
- **D, serviço gerenciado:** os usuários passariam a viver fora do nosso banco, quebrando as chaves estrangeiras de `artesao`, `pedido`, `avaliacao` e `carrinho`, e criaria dependência de conta externa para o time e para a avaliação.

### Limitações aceitas

- **O cookie vale até expirar** (7 dias). O logout apaga o cookie do navegador, mas um cookie copiado antes continuaria válido até o vencimento. Mitigação: a API revalida usuário e perfil no banco a cada requisição.
- **O middleware só confere assinatura e validade do cookie**, porque o runtime Edge não acessa o banco. A barreira que vale é a da API. O middleware serve para redirecionar páginas.
- **Sem token CSRF dedicado.** A proteção é o `SameSite=Lax` do cookie.
- **O freio de tentativas de login fica na memória do servidor.** Basta para a demonstração; em produção deve ir para um armazenamento externo ou para o banco.

## 4. Armazenamento de senha

- **Algoritmo:** scrypt (`node:crypto`), N=16384, r=8, p=1, sal aleatório de 16 bytes, chave de 64 bytes.
- **Formato na coluna:** `scrypt$N$r$p$sal$hash` (base64), em `usuario.senha_hash VARCHAR(200)`, aceitando nulo. Nulo significa conta sem acesso ao login. A coluna é criada por `db/07_autenticacao.sql`.
- Comparação em tempo constante (`timingSafeEqual`). Quando o e-mail não existe, o sistema gasta o mesmo tempo de uma verificação real, para o tempo de resposta não revelar quais e-mails estão cadastrados.
- A senha nunca é guardada em texto, nunca é registrada em log e o hash nunca sai em resposta de API.
- **E-mail:** comparado sem diferenciar maiúsculas (`lower(email)`) e gravado em minúsculas. Único no banco.
- **Regras do cadastro:** nome de até 150 caracteres, e-mail válido, senha de 8 a 200 caracteres, sem exigência de símbolo (público com baixo letramento digital).
- **Dados de exemplo:** `db/07_autenticacao.sql` define hashes para as três contas de demonstração (`ana.beatriz@raizespe.dev`, `tacaratu@raizespe.dev` e `admin@raizespe.dev`, senha `demo123`). Na carga de demonstração ficam sem senha os outros 5 artesãos e o comprador Carlos Andrade. Os artesãos ganham senha pelo script da seção 13; a senha deles não fica no repositório.

### Mensagens de erro

- Login inválido: sempre "E-mail ou senha incorretos.", sem dizer qual dos dois errou.
- Muitas tentativas: "Muitas tentativas. Aguarde alguns minutos e tente de novo." (HTTP 429).
- E-mail já cadastrado: "Este e-mail já está cadastrado." (HTTP 409).

## 5. Cookie e sessão

- **Nome:** `raizes_sessao`. `httpOnly`, `SameSite=Lax`, `Secure` em produção, `path=/`, validade de 7 dias.
- **Conteúdo (claims do JWT):** `sub` (id do usuário), `nome`, `tipo`, `iat` e `exp`. E-mail e hash de senha não entram.
- **Assinatura:** JWT HS256 (`jose`) com o `SESSION_SECRET` (mínimo de 32 caracteres, nunca versionado). Ele fica no `.env.local` do front e, com o **mesmo valor**, no `backend/.env`, para os dois lados aceitarem o mesmo cookie. Sem o segredo configurado o sistema recusa criar ou validar sessão.
- **Sessão da requisição:** `obterSessao()` confere a assinatura e a validade do cookie e depois consulta o banco para ver se o usuário ainda existe com o mesmo perfil. O nome exibido vem do banco.

## 6. Controle de acesso por perfil

O perfil vem do campo `tipo` da tabela `usuario` (`comprador`, `artesao`, `admin`).

### Páginas (middleware)

| Rota | Visitante | Comprador | Artesão | Admin |
|---|---|---|---|---|
| `/`, `/produto/[id]`, `/artesao/[id]`, `/login`, `/cadastro` | liberado | liberado | liberado | liberado |
| `/checkout` | vai para `/login` | liberado | volta para `/` | volta para `/` |
| `/meus-pedidos` | vai para `/login` | liberado | volta para `/` | liberado |
| `/painel` | vai para `/login` | volta para `/` | liberado | liberado |
| `/admin/**` | vai para `/login` | volta para `/` | volta para `/` | liberado |

Sem login, o usuário vai para `/login?proxima=<rota>` e volta para a página pedida depois de entrar. O admin acessa tudo, exceto o checkout, que é exclusivo do comprador.

### API (cada rota confere de novo no servidor)

| Rota | Quem pode |
|---|---|
| `GET /api/produtos`, `GET /api/produtos/:id` (e `relacionados`, `avaliacoes`), `GET /api/artesaos/:id`, `GET /api/filtros`, `GET /api/recomendacoes`, `GET /api/saude-bd` | público |
| `POST /api/auth/login`, `POST /api/auth/cadastro`, `POST /api/auth/logout`, `GET /api/auth/me` | público (o `me` devolve o usuário ou `null`) |
| `GET /api/pedidos` | qualquer usuário logado; cada perfil vê só o que é seu (comprador, os próprios; artesão, os que contêm produtos dele; admin, todos) |
| `POST /api/pedidos` | comprador (o comprador é o usuário da sessão) |
| `PATCH /api/pedidos/:id` | artesão ou admin |
| `POST /api/produtos` | artesão (o artesão é o usuário da sessão) |
| `PATCH /api/produtos/:id` | artesão dono do produto ou admin |
| `GET /api/painel/estatisticas` | artesão ou admin |
| `GET /api/artesaos` | admin |

### Onde a regra é aplicada

1. `middleware.ts`: primeira barreira, só para páginas. Rápida, mas não basta sozinha.
2. Rotas de API: `exigirSessao([...perfis])` confere sessão e perfil, com revalidação no banco. O identificador do comprador ou do artesão vem sempre da sessão, nunca do corpo da requisição.
3. Banco: os gatilhos e restrições do modelo físico (ex.: pedido só de usuário comprador) continuam como última barreira.

O cliente nunca decide permissão. Esconder botão na tela é só UX.

## 7. Fluxos

### Login
1. O usuário envia e-mail, senha e a aba escolhida (comprador, artesão ou admin) em `/login`.
2. O servidor busca o usuário pelo e-mail e confere a senha. Se não bater, ou se o usuário não existir, devolve a mensagem genérica.
3. A aba escolhida precisa bater com o perfil real da conta; o admin pode entrar por qualquer aba.
4. Se tudo bater, grava o cookie de sessão e a tela redireciona: comprador para `/`, artesão para `/painel`, admin para `/admin` (ou para a página que foi pedida, se houver `proxima`).

### Cadastro
1. O usuário informa nome, e-mail e senha em `/cadastro`.
2. Validação no servidor (seção 4). O cadastro público **sempre cria um comprador**.
3. Grava o hash e faz o login automático.
4. Contas de artesão e admin não têm autocadastro: são criadas por quem administra a plataforma (hoje por script SQL; a tela de criação de artesão no admin, prevista na PI4-118, continua no backlog). Os artesãos que já estão no banco sem senha ganham uma pelo `npm run contas:artesao` (seção 13).

### Logout
`POST /api/auth/logout` apaga o cookie e a tela volta para a vitrine.

### Sessão atual
`GET /api/auth/me` devolve `{ usuario }` ou `{ usuario: null }`. O `lib/contextoSessao.tsx` usa essa rota para saber quem está logado em todas as telas.

## 8. Arquivos afetados

| Onde | Mudança |
|---|---|
| `lib/sessao.ts` (novo) | Criar e ler o token da sessão (JWT HS256 desde a PI4-130), duração, perfis por área |
| `lib/servidor/auth.ts` (novo) | Hash e verificação de senha, login, cadastro de comprador, `obterSessao`, `exigirSessao` |
| `middleware.ts` (novo) | Barreira de acesso por perfil nas páginas protegidas |
| `app/api/auth/{login,cadastro,logout,me}/route.ts` (novos) | Rotas de autenticação |
| `lib/contextoSessao.tsx` (novo) e `app/provedores.tsx` | Estado do usuário logado em todo o app |
| `app/(auth)/login` e `app/(auth)/cadastro` | Chamam as rotas reais |
| `components/BarraNavegacao.tsx` | Mostra os itens do perfil e o botão "Sair" |
| `lib/contextoPedidos.tsx`, `lib/contextoProdutos.tsx`, `/checkout`, `/meus-pedidos`, `/painel` | Usam o usuário da sessão no lugar de `u2` e `u7` |
| `db/07_autenticacao.sql` (novo) | Coluna `usuario.senha_hash` e senha das contas de demonstração |
| `.env.example` | `SESSION_SECRET` |
| `backend/` (PI4-124) | A mesma autenticação no Express; os arquivos estão na seção 11 |

## 9. Dependências com as outras subtarefas e pontos em aberto

- **PI4-114:** o banco tem a coluna `usuario.senha_hash` e as contas de demonstração (`db/07_autenticacao.sql`).
- **PI4-115:** a conexão usa o `pg` (`lib/db.ts`); a autenticação consulta o banco por essa conexão. No backend, a consulta a `usuario` também é feita com `pg` (`backend/src/repositories/usuarioRepository.ts`, pelo pool de `backend/src/config/db.ts`).
- **PI4-116:** as rotas de escrita (pedidos e produtos) leem o usuário da sessão.

Fora do escopo nesta etapa, e registrado para a próxima sprint (PI4-118 e backlog):

- criação de contas de artesão (tela do admin). A senha dos artesãos que já estão no banco foi resolvida na PI4-143 pelo script da seção 13;
- troca de senha pelo próprio usuário (os artesãos recebem do script a mesma senha inicial, seção 13.4);
- recuperação de senha por e-mail, login social e confirmação de e-mail;
- freio de tentativas em armazenamento persistente;
- token CSRF dedicado;
- revogação imediata de sessão (por exemplo, uma tabela de sessões).

## 10. Diferenças em relação à proposta inicial (PR #21)

| Ponto | Proposta inicial | Implementado |
|---|---|---|
| Biblioteca | Auth.js v5 (`next-auth`) | Cookie assinado próprio (Web Crypto); desde a PI4-130, JWT HS256 com `jose` |
| Hash de senha | bcrypt (`bcryptjs`), custo 12 | scrypt (`node:crypto`), N=16384 |
| Coluna | `senha_hash VARCHAR(60) NOT NULL` | `senha_hash VARCHAR(200)`, aceitando nulo (nulo = sem acesso) |
| Duração da sessão | 8 horas | 7 dias |
| Cadastro público | Comprador ou artesão | Somente comprador |
| Admin em `/painel` e `/meus-pedidos` | Bloqueado | Liberado (o admin acessa tudo, menos o checkout) |
| Freio de tentativas de login | Fora do escopo | Implementado em memória (5 falhas por e-mail e IP a cada 15 minutos) |
| Revogação | Só por expiração | Só por expiração do cookie, com revalidação de usuário e perfil no banco a cada requisição de API |
| Variável de ambiente | `AUTH_SECRET` | `SESSION_SECRET` |
| Arquivos | `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/senha.ts` | `lib/sessao.ts`, `lib/servidor/auth.ts` e as quatro rotas de `app/api/auth/` |

## 11. A mesma autenticação no backend Express (implementado)

O backend em `backend/` (PI4-119/PI4-124) tem as mesmas quatro rotas de autenticação (`POST /api/auth/login`, `POST /api/auth/cadastro`, `POST /api/auth/logout`, `GET /api/auth/me`), com as mesmas regras das seções 3 a 7:

- **O mesmo cookie:** nome `raizes_sessao`, com o mesmo JWT HS256 (seção 12), `httpOnly`, `SameSite=Lax`, `Secure` em produção, `path=/` e 7 dias. Com o mesmo `SESSION_SECRET` nos dois `.env`, um token emitido pelo Express é aceito pelo `middleware.ts` do Next, e vice-versa. Isso é coberto por `backend/test/tokenSessao.test.ts`.
- **Senha:** o mesmo scrypt (N=16384, r=8, p=1, sal de 16 bytes, chave de 64 bytes) e o mesmo formato `scrypt$N$r$p$sal$hash`.
- **Freio de tentativas:** 5 falhas por e-mail e IP a cada 15 minutos, também em memória.
- **Perfis:** `exigirSessao(perfis?)` responde 401 sem login e 403 com o perfil errado, e revalida usuário e perfil no banco a cada requisição (`services/sessaoService.ts`). O `carregarSessao` lê a sessão sem bloquear (usado em `GET /api/recomendacoes`).
- **Erros:** no formato do backend, `{ "ok": false, "erro": "<mensagem>" }`, com as mesmas mensagens.

| Onde (em `backend/src/`) | O que faz |
|---|---|
| `utils/tokenSessao.ts` | Criar e ler o JWT do cookie, ambos assíncronos (equivale a `lib/sessao.ts`) |
| `utils/senha.ts` | Hash e verificação scrypt |
| `utils/cookies.ts` | Lê o cabeçalho `Cookie`, sem dependência nova |
| `services/authService.ts` | Login, cadastro de comprador e freio de tentativas |
| `services/sessaoService.ts` | Revalida a sessão no banco |
| `middlewares/sessao.ts` | `carregarSessao` e `exigirSessao(perfis?)` |
| `controllers/authController.ts`, `routes/authRoutes.ts` | As quatro rotas de `/api/auth` |

**O front usa essas rotas quando a `API_URL` está definida** (PI4-132): as telas continuam chamando `/api/...` relativo e o Next repassa ao Express, então o cookie fica no domínio do site e o `middleware.ts` valida o mesmo JWT. Sem a variável, valem as rotas do Next na porta 3000. O modo de chamada direta em outra origem (CORS e `COOKIE_SAMESITE=none`) e seus limites estão em `docs/arquitetura-backend.md`, seção 3.5.

### Cuidados de segurança (valem para o Next e para o Express)

- **`SESSION_SECRET` forte e privado:** 32+ caracteres aleatórios, nunca versionado, nunca no Jira ou no chat. Trocar o segredo invalida todas as sessões abertas.
- **IP do freio de tentativas:** os dois lados usam o primeiro valor do cabeçalho `x-forwarded-for`. Esse valor é enviado pelo próprio cliente quando não há um proxy confiável na frente, então pode ser forjado para escapar do limite. Atrás do proxy do deploy, o correto é confiar só no IP que o proxy acrescenta.
- **Revogação:** um cookie copiado continua válido até expirar (7 dias). A revalidação no banco só derruba a sessão se a conta sumir ou mudar de perfil.

## 12. JWT em cookie `httpOnly` (PI4-130): implementado

A PI4-121 adotou a stack de referência da disciplina (Node.js, Express, Prisma e JWT). Na PI4-130, o cookie assinado próprio foi trocado por um **JWT guardado no mesmo cookie `httpOnly`**, sem mudar as regras deste documento: scrypt, perfis, revalidação no banco, freio de tentativas e flags do cookie continuam iguais.

| Item | Como ficou |
|---|---|
| Biblioteca | [`jose`](https://github.com/panva/jose) 6.2.13, nos dois lados (`package.json` da raiz e do `backend/`). Ela usa só Web Crypto, então roda no runtime Edge do `middleware.ts`, onde a `jsonwebtoken` não roda. No backend CommonJS, a `jose` 6 (só ESM) é carregada pelo `require()` de ESM, que vem ligado por padrão no Node 20.19+ e 22.12+, as versões do `engines` do backend |
| Algoritmo | **HS256**. A leitura usa `algorithms: ["HS256"]`, então tokens com `alg: "none"`, HS512 ou qualquer outro algoritmo são recusados. A leitura também exige as claims `sub`, `iat` e `exp` (`requiredClaims`) |
| Cabeçalho | `{ "alg": "HS256", "typ": "JWT" }` |
| Claims | `sub` = id do usuário (UUID), `nome`, `tipo` (`comprador`, `artesao` ou `admin`), `iat` e `exp`. Tipo fora dessa lista é recusado |
| Expiração | 7 dias (`DURACAO_SESSAO_SEG`), igual ao `maxAge` do cookie |
| Segredo | O mesmo **`SESSION_SECRET`** (32+ caracteres), no `.env.local` e no `backend/.env`. Não foi renomeado para `JWT_SECRET`, para não quebrar o login publicado até alguém ajustar a variável no deploy |
| Cookie | Sem mudança: `raizes_sessao`, `httpOnly`, `SameSite=Lax`, `Secure` em produção, `path=/`, 7 dias. O logout continua apagando o cookie |
| Interface | `criarToken(usuario, duracaoSeg?)` e `lerToken(token)` devolvem `Promise`; `lerToken` devolve `DadosSessao { id, nome, tipo, exp }` ou `null`. No backend as duas passaram a ser assíncronas (`authController` e `sessaoService` foram ajustados). No Next elas já eram assíncronas, então nenhum chamador mudou |
| Sem `SESSION_SECRET` | Igual a antes: `criarToken` lança erro nos dois lados. `lerToken` lança no backend e devolve `null` no Next, onde o `middleware.ts` trata a falta de sessão |

**Cookies antigos.** Quem tinha um cookie no formato anterior ("corpo.assinatura" em HMAC) passa a ser tratado como visitante: o `lerToken` devolve `null`, sem erro, e a pessoa precisa entrar de novo uma única vez. Isso acontece no primeiro acesso depois do deploy.

**Testes:** `backend/test/tokenSessao.test.ts` e `tests/sessao.test.mjs`.

- Criar e ler o token, com as claims e a validade de 7 dias.
- Recusa de token adulterado, expirado, com `alg: "none"`, com HS512, assinado com outro segredo, com perfil inválido e no formato antigo.
- Compatibilidade nos dois sentidos: token do Express aceito pelo Next, e o inverso.
- Cookie antigo dando 401 numa rota protegida.

O freio de tentativas é coberto pelo teste com banco de `backend/test/catalogoAuthPainel.test.ts`, que só roda com `TEST_DATABASE_URL`.

**Continua fora do escopo:** revogação imediata (lista de bloqueio ou tabela de sessões), rotação de chave e token CSRF dedicado (seção 9).

## 13. Senha das contas de artesão (PI4-143): `npm run contas:artesao`

Na carga de demonstração (`db/05` + `db/07`), só a Cooperativa de Tacaratu tem senha entre os 6 artesãos. Os outros 5 (Ateliê Barro Vivo, José Bezerra, Marlene Costa, Raimundo Silva e Vitalino Neto) não conseguem entrar no `/painel`. Em `/admin/artesaos` (PR #52), eles aparecem como "Pendente (sem login)" e, depois do script, como "Aprovado (tem login)". O botão "Aprovar" dessa tela é só demonstração no navegador e não cria login. A decisão D3 da PI4-143 foi resolver isso com um script com dry-run, preparado e testado só em banco descartável. No banco do time, quem roda é o responsável pelo banco.

### 13.1 O que o script faz

| Item | Como funciona |
|---|---|
| Arquivo | `backend/scripts/contas-artesao.ts`, rodado com `npm run contas:artesao` na pasta `backend/` |
| Banco | A `DATABASE_URL` do terminal ou, sem ela, a do `backend/.env` |
| Padrão (`--dry-run`) | Só lê: lista pelo **nome** os usuários `tipo = 'artesao'` com `senha_hash IS NULL`, e o total. A consulta não seleciona `senha_hash` nem e-mail |
| `--aplicar` | Numa transação, grava em cada um desses artesãos o hash da senha da variável `SENHA_ARTESAOS`, com o mesmo `hashSenha` do login (scrypt, seção 4) e um sal novo por conta. O `UPDATE` só alcança `tipo = 'artesao' AND senha_hash IS NULL`: o artesão que já tem senha, os compradores e o admin ficam como estão. Rodar de novo não muda nada (atualiza 0). Imprime só a contagem |
| Banco fora de localhost | O `--aplicar` exige também `--sim-eu-tenho-autorizacao`. Sem ela, o script recusa, explica o motivo e não abre conexão. O dry-run não exige a flag |
| `SENHA_ARTESAOS` | Vem só do terminal: o script não lê essa variável do `backend/.env`. Precisa ter de 8 a 200 caracteres. São recusados: valor vazio, `demo123`, espaço no começo ou no fim e valor entre aspas |
| Saída | Nomes de artesãos e contagens. Nunca a senha, o hash, e-mails nem a connection string; numa falha de banco, só o código do erro. Código de saída: 0 deu certo, 1 falha no banco (nada é gravado), 2 recusado antes de conectar |

**Testes:** `backend/test/contasArtesao.test.ts`.

- Sem banco: validação da `SENHA_ARTESAOS`, a exigência da flag para host remoto e a saída sem a senha e sem nada com formato de hash.
- Com banco (`TEST_DATABASE_URL` local; com host remoto, esses testes são pulados): o dry-run não grava; o `--aplicar` grava só nos 5 artesãos sem senha; a segunda execução não muda nada; e um desses artesãos entra com a senha de teste. No fim, a suíte devolve os 5 artesãos ao estado sem senha.

### 13.2 Quem roda e por que a senha não está no repositório

- **Quem roda no banco do time:** o responsável pelo banco, que tem a connection string do Neon e a autorização do time para gravar nele. O resto do time pode rodar o dry-run e testar o script num banco descartável, mas não roda o `--aplicar` no Neon.
- **Por que a senha não está no repositório:** o repositório é público. O que é versionado fica no histórico do Git mesmo depois de apagado e pode ser lido por qualquer pessoa. O `demo123` aparece nos docs porque vale só para as três contas de demonstração. A senha dos artesãos dá acesso ao painel (cadastrar e editar produtos, marcar pedidos como enviados), por isso não vai para o código, o `db/`, o `.env.example`, o Jira nem a descrição de PR.
- **Por que também não fica no `backend/.env`:** o arquivo continua no disco e, numa pasta sincronizada como o OneDrive, vai também para a nuvem. A variável do terminal some quando o terminal é fechado.
- No banco fica só o hash scrypt, como em qualquer outra conta (seção 4).

### 13.3 Passo a passo para o responsável pelo banco

Na pasta `backend/`, com o `backend/.env` apontando para o banco do time (ou com a `DATABASE_URL` definida no terminal). Escolha uma senha nova, de 8 a 200 caracteres, que não seja `demo123` nem uma senha usada em outro lugar. Uma frase de três ou quatro palavras é fácil de digitar e difícil de adivinhar.

1. **Defina a senha só no terminal.** Ela é digitada como resposta, então não fica no comando nem no histórico. No PowerShell e no cmd, o que você digita aparece na tela:

   ```powershell
   # PowerShell
   $env:SENHA_ARTESAOS = Read-Host "Senha inicial dos artesaos"
   ```

   ```bat
   :: cmd
   set /p SENHA_ARTESAOS=Senha inicial dos artesaos:
   ```

   ```bash
   # Mac/Linux (digite a senha e Enter; nada aparece na tela)
   read -rs SENHA_ARTESAOS && export SENHA_ARTESAOS
   ```

2. **Rode o dry-run e confira:** `npm run contas:artesao`. A saída deve mostrar `Banco: fora de localhost`, os 5 nomes (Ateliê Barro Vivo, José Bezerra, Marlene Costa, Raimundo Silva e Vitalino Neto) e `Total: 5`. Se aparecer outro nome ou outro total, pare e confira com o time antes de seguir.
3. **Grave:** `npm run contas:artesao -- --aplicar --sim-eu-tenho-autorizacao`. A saída deve ser `Contas de artesão atualizadas: 5`. O `--` antes das flags é necessário: sem ele, o npm não as repassa e o script roda só o dry-run.
4. **Confira de novo:** `npm run contas:artesao` deve mostrar `Nenhum artesão sem senha.` e `Total: 0`.
5. **Apague a variável e feche o terminal:** `Remove-Item Env:SENHA_ARTESAOS` (PowerShell), `set SENHA_ARTESAOS=` (cmd) ou `unset SENHA_ARTESAOS` (Mac/Linux).
6. **Avise os artesãos** (13.4).

Se o script recusar (código 2), nada foi gravado: a mensagem diz o que corrigir. Se falhar no banco (código 1), a transação é desfeita e também nada foi gravado.

### 13.4 Como avisar os artesãos

- As 5 contas são da carga de demonstração (e-mails `@raizespe.dev`, em `db/05_dados_raizes_pe.sql`). Hoje, quem precisa da senha são as pessoas do time que vão usar essas contas.
- Passe a senha a cada pessoa individualmente, por um canal privado (pessoalmente, por ligação ou por mensagem direta). Nunca no grupo do time, no Jira ou Trello, em PR, em commit ou em e-mail com cópia.
- Diga como entrar: em `/login`, aba **Artesão**, com o e-mail da conta e a senha recebida.
- **Limitação:** as 5 contas recebem a mesma senha inicial e ainda não existe troca de senha (backlog, seção 9). Quem tem a senha e sabe o e-mail de outro artesão consegue entrar na conta dele; por isso a senha não deve ser repassada.
- **Se a senha vazar:** o responsável pelo banco apaga a senha dessas contas e repete o passo a passo com uma senha nova. O comando abaixo, rodado no SQL Editor do Neon, apaga a senha de todos os artesãos, menos a conta de demonstração da Cooperativa de Tacaratu. Hoje isso alcança só as 5 contas; se o banco tiver outros artesãos com senha própria, restrinja o `WHERE` a essas contas:

  ```sql
  UPDATE origem.usuario SET senha_hash = NULL
   WHERE tipo = 'artesao' AND lower(email) <> 'tacaratu@raizespe.dev';
  ```
