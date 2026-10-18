# Estratégia de autenticação — Raízes PE

> PI4-117 · subtarefa da PI4-113 (W10 — Preparação do ambiente para integração)
> Status: proposta para revisão do time de WEB

## 1. Contexto

Hoje o login em `/login` compara e-mail e senha com três credenciais fixas (comprador, artesão e admin) e as áreas logadas usam usuários de demonstração cravados no código (`u2` no `/painel`, `u7` no `/meus-pedidos` e no checkout). O cadastro em `/cadastro` não persiste nada.

Com a chegada do PostgreSQL (PI4-114) e da camada de acesso ao banco (PI4-115), precisamos de uma autenticação real que:

- valide credenciais contra a tabela `usuario`;
- guarde a senha de forma segura;
- saiba o perfil de quem está logado (comprador, artesão ou admin) e bloqueie rotas de acordo;
- funcione no deploy atual (Vercel) sem serviço externo pago.

## 2. Opções avaliadas

| Critério | A. Sessão própria (cookie httpOnly + tabela de sessão) | B. JWT próprio (assinado à mão) | C. Auth.js v5 (Credentials + JWT em cookie httpOnly) | D. Serviço gerenciado (Clerk, Supabase Auth, Firebase) |
|---|---|---|---|---|
| Esforço de implementação | Alto | Médio | Baixo | Baixo |
| Segurança "de fábrica" (CSRF, assinatura, expiração, rotação) | Depende de nós | Depende de nós | Pronta e mantida | Pronta |
| Usa a nossa tabela `usuario` | Sim | Sim | Sim | Não: duplica usuários no serviço externo |
| Exige tabela nova no banco | Sim (`sessao`) | Não | Não | Não |
| Depende do ORM escolhido na PI4-115 | Sim | Não | Não (estratégia JWT dispensa adapter) | Não |
| Integração com Next.js App Router e middleware | Manual | Manual | Nativa | Boa |
| Custo / dependência externa | Nenhum | Nenhum | Nenhum | Plano gratuito com limites e lock-in |
| Revogar sessão na hora | Sim | Não | Não (só por expiração) | Sim |

## 3. Decisão

**Opção C: Auth.js v5 (pacote `next-auth`) com o provider Credentials e sessão JWT guardada em cookie httpOnly.**

### Por que

- **Menos código de segurança escrito por nós.** Assinatura do token, cookie `httpOnly`/`Secure`/`SameSite=Lax`, proteção CSRF e expiração já vêm prontos e testados.
- **Encaixa no que já existe.** Continua usando a nossa tabela `usuario` e o tipo `TipoUsuario` de `lib/tipos.ts`; o perfil vai dentro do token.
- **Não trava na PI4-115.** Com a estratégia JWT o Auth.js não precisa de adapter de banco. A única coisa que ele consulta é o usuário no login, e isso é uma função nossa (`buscarUsuarioPorEmail`) que vai usar o driver/ORM que o Gustavo escolher, seja `pg`, Prisma ou Drizzle.
- **Proteção de rotas centralizada** num único `middleware.ts`, em vez de checagem espalhada página por página.

### Por que as outras ficaram de fora

- **A — Sessão própria:** é a mais "correta" para revogar sessão, mas exige criar tabela `sessao`, escrever geração/rotação de token, CSRF e limpeza de sessões vencidas. Muito trabalho para o prazo do PI.
- **B — JWT próprio:** mesmo modelo de token da opção C, só que com todo o risco de implementar assinatura, expiração e cookie na mão. Não traz vantagem sobre usar a biblioteca.
- **D — Serviço gerenciado:** os usuários passariam a viver fora do nosso banco, quebrando o modelo físico já entregue (FKs de `artesao`, `pedido`, `avaliacao`, `carrinho` apontam para `usuario`). Também cria dependência de conta externa para o time e para a avaliação.

### Limitação aceita

JWT não pode ser revogado antes de expirar. Para mitigar:
- sessão com validade de **8 horas**;
- quando um admin bloquear um artesão (moderação em `/admin/artesaos`), o bloqueio vale no próximo login. Se for necessário bloqueio imediato no futuro, dá para checar um campo de status do usuário no callback `jwt` a cada requisição.

## 4. Armazenamento de senha

- **Algoritmo:** bcrypt via `bcryptjs` (JavaScript puro, sem build nativo, roda na Vercel), custo **12**.
- **Nunca** guardar senha em texto, nunca logar senha, nunca devolver o hash em resposta de API.
- **Coluna no banco:** `usuario.senha_hash VARCHAR(60) NOT NULL` (o hash bcrypt tem sempre 60 caracteres).
  - ⚠️ **Conferir no `01_ddl_origem.sql`** se essa coluna já existe. O modelo lógico em `lib/tipos.ts` não tem campo de senha. Se o DDL também não tiver, abrir uma migration adicionando a coluna (alinhar com o Bruno S., dono do modelo físico).
- **E-mail:** normalizado com `trim().toLowerCase()` antes de gravar e de comparar. Recomendado `UNIQUE` no e-mail (provavelmente já existe no DDL).
- **Regras mínimas de senha no cadastro:** mínimo de 8 caracteres. Sem regra de símbolo obrigatório, pensando no público com baixo letramento digital.
- **Dados de exemplo:** o `02_dados_exemplo_origem.sql` precisa ganhar hashes válidos para os usuários de teste, mantendo as três contas de demonstração do README (`demo123`) para não quebrar a apresentação.

### Mensagens de erro

- Login inválido: sempre **"E-mail ou senha incorretos."**, sem dizer qual dos dois errou (evita descobrir quais e-mails estão cadastrados).
- E-mail já cadastrado no `/cadastro`: "Já existe uma conta com este e-mail."

## 5. Controle de acesso por perfil

O perfil vem do campo `tipo` da tabela `usuario` (`comprador`, `artesao`, `admin`), o mesmo de `TipoUsuario` em `lib/tipos.ts`.

| Rota | Visitante | Comprador | Artesão | Admin |
|---|---|---|---|---|
| `/`, `/produto/[id]`, `/artesao/[id]` | ✅ | ✅ | ✅ | ✅ |
| `/login`, `/cadastro` | ✅ | ↪ redireciona para `/` | ↪ `/painel` | ↪ `/admin` |
| `/checkout`, `/meus-pedidos` | ↪ `/login` | ✅ | ⛔ | ⛔ |
| `/painel` | ↪ `/login` | ⛔ | ✅ | ⛔ |
| `/admin/**` | ↪ `/login` | ⛔ | ⛔ | ✅ |
| `GET /api/recomendacoes` | ✅ (cold start) | ✅ (personalizado) | ✅ | ✅ |

⛔ = redireciona para a página inicial do próprio perfil.

### Onde a regra é aplicada

1. **`middleware.ts` (raiz):** primeira barreira. Lê a sessão e redireciona conforme a tabela acima. Rápido, mas **não é suficiente sozinho**.
2. **Rotas de API e Server Actions que gravam dados:** checam sessão e perfil de novo no servidor. Ex.: só o artesão dono do produto pode editá-lo, e o `artesaoId` vem da sessão, nunca do corpo da requisição.
3. **Banco:** os gatilhos do modelo físico que validam o papel do usuário por tabela continuam como última barreira.

O cliente nunca decide permissão. Esconder botão na tela é só UX.

### Conteúdo do token / sessão

Apenas o necessário: `id`, `nome`, `tipo`. E-mail e hash de senha **não** entram no token.

## 6. Fluxos

### Login
1. Usuário envia e-mail e senha em `/login`.
2. `authorize()` do provider Credentials normaliza o e-mail e busca o usuário no banco.
3. Compara a senha com `bcrypt.compare`. Se não bater (ou o usuário não existir), retorna a mensagem genérica.
4. Se bater, o Auth.js gera o JWT com `id`, `nome` e `tipo` e grava em cookie httpOnly.
5. Redireciona pelo perfil: comprador → `/`, artesão → `/painel`, admin → `/admin`.

### Cadastro
1. Usuário preenche nome, e-mail, senha e escolhe o perfil (comprador ou artesão; **admin nunca pelo cadastro público**).
2. Validação no servidor: campos obrigatórios, e-mail válido, senha ≥ 8 caracteres, e-mail ainda não usado.
3. Gera `senha_hash` com bcrypt e insere em `usuario`. Se for artesão, insere também em `artesao` **na mesma transação**.
4. Faz login automático e redireciona pelo perfil.

### Logout
Botão "Sair" chama `signOut()`, que apaga o cookie e volta para `/`.

### Proteção de rota
Requisição → `middleware.ts` lê a sessão → aplica a tabela da seção 5 → libera ou redireciona.

## 7. Telas e código afetados

| Onde | Hoje | Depois |
|---|---|---|
| `/login` | Compara com 3 credenciais fixas | Chama `signIn("credentials")`; mostra erro genérico |
| `/cadastro` | Ilustrativo, não persiste | Grava no banco (via rota de API ou Server Action) e faz login |
| `/painel` | Usa artesão fixo `u2` | Usa o `id` do artesão logado |
| `/meus-pedidos`, `/checkout` | Usa compradora fixa `u7` | Usa o `id` do comprador logado |
| `/admin/**` | Aberto | Só admin |
| `lib/contextoPedidos.tsx` e contextos que assumem usuário fixo | IDs fixos | Recebem o usuário da sessão |
| `app/provedores.tsx` | — | Envolve o app com `SessionProvider` |
| Header / navegação | — | Mostra nome do usuário e botão "Sair" quando logado |
| **Novos arquivos** | — | `auth.ts` (config do Auth.js), `middleware.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/senha.ts` (hash/compare) |
| `.env.example` | — | `AUTH_SECRET=` (gerado com `npx auth secret`, nunca versionado) |
| README | Tabela de login de demonstração | Atualizar: as contas demo passam a existir no banco de exemplo |

## 8. Dependências com as outras subtarefas

- **PI4-114 (Bruno S.):** banco precisa ter `usuario.senha_hash` e os dados de exemplo com hashes. Ver seção 4.
- **PI4-115 (Gustavo):** a função `buscarUsuarioPorEmail` vai usar o driver/ORM escolhido. A decisão de auth **não depende** dessa escolha.
- **PI4-116 (Bruno D.):** rotas de escrita da API (pedidos, produtos) devem ler o usuário da sessão em vez de receber `compradorId`/`artesaoId` no corpo.

## 9. Fora do escopo agora

- Recuperação de senha por e-mail
- Login social (Google etc.)
- Confirmação de e-mail
- Limite de tentativas de login (rate limiting). Recomendado antes de produção real.

## 10. Ordem sugerida de implementação

1. Migration/ajuste do DDL com `senha_hash` + hashes nos dados de exemplo
2. `lib/senha.ts` e `auth.ts` com provider Credentials
3. `/login` real
4. `middleware.ts` com a tabela de acesso
5. Trocar usuários fixos (`u2`, `u7`) pela sessão
6. `/cadastro` real
7. Checagem de perfil nas rotas de API de escrita
