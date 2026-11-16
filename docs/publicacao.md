# Publicação: site na Vercel, API no Render e banco no Neon

Como o projeto está publicado, como republicar a API e ligar o front a ela (PI4-134), o roteiro para testar os fluxos com o Network do navegador aberto e as pendências do responsável pelo banco.

## Estado atual (16/11/2026)

| Parte | Onde | Endereço |
|---|---|---|
| Site (Next: páginas + `middleware.ts`) | Vercel | <https://raizes-pe-gules.vercel.app> |
| API Express (`backend/`) | Render, plano gratuito, Blueprint do [`render.yaml`](../render.yaml) | <https://raizes-pe-api.onrender.com> (Swagger em `/api-docs`) |
| Banco PostgreSQL | Neon (`sa-east-1`) | só nos painéis, nunca no repositório |

```text
Navegador → Vercel (Next: front + middleware.ts) → rewrites /api/* → Render (API Express) → Neon (PostgreSQL)
```

O site publicado já usa a API pelo proxy: em 16/11/2026, <https://raizes-pe-gules.vercel.app/api/saude> respondeu `{"ok":true}`, e essa rota só existe no Express. O navegador fala **só com o domínio da Vercel**, e o Next repassa `/api/*` para a API (`API_URL`, PI4-132). Por isso o cookie `raizes_sessao` continua first-party, o `middleware.ts` enxerga o JWT e **não precisa de CORS**.

### Depois do merge da série PI4-143 a PI4-146: publique a API antes do front

As telas novas do admin e os filtros da vitrine chamam `GET /api/artesaos` e `GET /api/filtros`. Em 16/11/2026, a API publicada ainda não tinha essas rotas (`/api/filtros` respondia 404). Depois do merge na `main`:

1. Publique a API primeiro: no Render, confira em **Events** se o commit novo foi publicado (ou use **Manual Deploy > Deploy latest commit**) e abra `https://raizes-pe-api.onrender.com/api/filtros`, que deve responder 200 com `tecnicas`, `regioes` e `categorias`.
2. Depois, publique o front na Vercel (**Deployments > Redeploy** do último commit da `main`).

Se o front subir antes da API, a vitrine continua funcionando, mas os filtros de região e categoria ficam só com "Todas" e as telas do admin mostram erro com "tentar novamente".

## Passo 1: publicar a API no Render

O arquivo [`render.yaml`](../render.yaml) já descreve o serviço: pasta `backend`, build `npm ci --include=dev && npm run build`, start `npm start`, health check em `/api/saude`, `NODE_VERSION=22` e `NODE_ENV=production`.

1. No Render: **New > Blueprint**, conecte o repositório `brunosm26/Raizes-PE` e escolha a branch `main`.
2. Preencha as duas variáveis pedidas (ficam só no painel, não vão ao GitHub):
   - `DATABASE_URL`: a string **pooled** do Neon (host com `-pooler`).
   - `SESSION_SECRET`: **o mesmo valor** que estará na Vercel (32+ caracteres). Para gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Aguarde o deploy. A `DIRECT_URL` não é necessária em produção: só a CLI do Prisma usa. `CORS_ORIGIN` e `COOKIE_SAMESITE` também não, porque o front usa o proxy.
4. Teste no navegador (troque pelo endereço do serviço; o atual é `raizes-pe-api.onrender.com`):
   - `https://<sua-api>.onrender.com/api/saude` deve responder `{"ok":true}`;
   - `https://<sua-api>.onrender.com/api/saude-bd` deve confirmar a conexão com o banco;
   - `https://<sua-api>.onrender.com/api-docs` abre o Swagger.

Railway ou outro host equivalente serve do mesmo jeito: raiz `backend`, build `npm ci --include=dev && npm run build`, start `npm start`, Node 20.19+ ou 22.12+, as duas variáveis acima, `NODE_ENV=production` e `/api/saude` como health check.

## Passo 2: apontar o front da Vercel para a API

No projeto da Vercel, em **Settings > Environment Variables** (ambientes Production e, se quiser, Preview):

| Variável | Valor |
|---|---|
| `API_URL` | `https://<sua-api>.onrender.com` (com `https://`, sem barra no final) |
| `SESSION_SECRET` | o mesmo valor do Render |
| `DATABASE_URL` | opcional: só é usada pelas rotas `app/api` do Next, que respondem se a `API_URL` for removida |

A `API_URL` é lida **no build**: depois de salvar, faça um **novo deploy** (Deployments > Redeploy). Valor sem `http(s)://` derruba o build com a mensagem "API_URL inválida". A `NEXT_PUBLIC_API_URL` **não** deve ser definida (veja a última seção).

Confira: `https://raizes-pe-gules.vercel.app/api/saude` deve responder `{"ok":true}`. Essa rota só existe no Express, então a resposta prova que o proxy está ativo.

## Passo 3: testar os fluxos com o Network aberto

Abra o site publicado, aperte F12 e vá na aba **Network** (marque "Preserve log"). Para cada fluxo, confira as chamadas `/api/...` (sempre no domínio da Vercel, com status 2xx) e tire print.

| Fluxo | Como fazer | O que conferir |
|---|---|---|
| Login | `/login` com um [login de demonstração](../README.md#logins-de-demonstração) | `POST /api/auth/login` 200; na resposta, `Set-Cookie: raizes_sessao` com `HttpOnly`, `Secure` e `SameSite=Lax` |
| Sessão | recarregar a página logado | `GET /api/auth/me` devolve o usuário |
| Cadastro | `/cadastro` com e-mail novo | `POST /api/auth/cadastro` 201 e usuário logado em seguida |
| Vitrine | `/` e os filtros de região e categoria | `GET /api/filtros` 200 e `GET /api/produtos?...` 200 |
| Checkout | comprador: adicionar ao carrinho e finalizar | `POST /api/pedidos` 201; o pedido aparece em "Meus Pedidos" |
| Painel | artesão: `/painel`; cadastrar um produto | `GET /api/painel/estatisticas` 200; `POST /api/produtos` 201; contador de estoque sobe |
| Admin | admin: `/admin` e `/admin/artesaos` | `GET /api/artesaos` 200 e as páginas carregam |
| Proteção | deslogado, abrir `/painel` | redireciona para `/login` (o `middleware.ts` valida o JWT) |
| Proteção da API | deslogado, abrir `/api/painel/estatisticas` | 401 |

## Pendências do responsável pelo banco

Só quem administra o Neon do time faz estes passos, com autorização, a partir do próprio terminal. Ninguém mais roda comandos de escrita no banco do time.

1. **Baseline das migrations (PI4-147).** O Neon já tem o schema criado pelos scripts de `db/`, então as migrations não devem rodar lá: só ser marcadas como aplicadas (`migrate resolve --applied 0_init` e `--applied 1_regras_sql`). Isso cria a tabela `_prisma_migrations`. O passo a passo, com as conferências antes e depois, está em [`backend/README.md`, seção "Baseline no Neon do time"](../backend/README.md#baseline-no-neon-do-time-só-o-responsável-pelo-banco-com-autorização).
2. **Senha dos artesãos da carga (PI4-143).** Os 5 artesãos sem senha só entram no `/painel` depois do `npm run contas:artesao` (dry-run primeiro, depois `-- --aplicar --sim-eu-tenho-autorizacao`, com a `SENHA_ARTESAOS` só no terminal). A senha é passada a cada pessoa em particular. Passo a passo em [`estrategia-autenticacao.md`, seção 13](estrategia-autenticacao.md#13-senha-das-contas-de-artesão-pi4-143-npm-run-contasartesao).
3. **Senha do admin de demonstração.** As três contas de demonstração usam `demo123`, que está público no README. Enquanto o site for só a demonstração da disciplina, isso é aceitável. **Antes de qualquer uso real, troque a senha do `admin@raizespe.dev`** (ou desligue o login dele com `senha_hash = NULL`). Não há tela de troca de senha. O hash é gerado com a mesma função do login (scrypt, [`estrategia-autenticacao.md`, seção 4](estrategia-autenticacao.md#4-armazenamento-de-senha)):

   ```powershell
   cd backend
   $env:NOVA_SENHA_ADMIN = "<nova senha forte>"
   npx tsx -e "const { hashSenha } = require('./src/utils/senha'); hashSenha(process.env.NOVA_SENHA_ADMIN).then(console.log)"
   Remove-Item Env:NOVA_SENHA_ADMIN
   ```

   Depois, no SQL Editor do Neon: `UPDATE origem.usuario SET senha_hash = '<hash impresso>' WHERE email = 'admin@raizespe.dev';`. As sessões abertas continuam valendo até expirar (7 dias) ou até o `SESSION_SECRET` ser trocado.

## Pontos de atenção

- **Plano gratuito dorme.** O Render free suspende o serviço após alguns minutos sem requisições, e a primeira chamada depois disso demora dezenas de segundos (em 16/11/2026, entre 20 e 35 s pelo site). Isso pode estourar o tempo do proxy da Vercel. Antes de apresentar ou tirar os prints, abra `/api/saude` uma vez para "acordar" a API.
- **Região.** O Render não tem região em São Paulo e o Neon está em `sa-east-1`: cada consulta ganha latência. Para a demonstração é aceitável.
- **Limite de tentativas de login** fica em memória (some ao reiniciar o serviço e não vale entre várias instâncias).
- **Segredos.** `SESSION_SECRET` e `DATABASE_URL` só nos painéis do Render e da Vercel. Trocar o `SESSION_SECRET` derruba as sessões abertas, e ele precisa ser trocado nos dois painéis ao mesmo tempo.
- **Aprovação e moderação do admin são de demonstração:** ficam no `localStorage` de cada navegador e não chegam ao banco.
- **Reverter.** Para voltar ao Next sozinho, remova a `API_URL` da Vercel, confira se a `DATABASE_URL` está lá e faça um novo deploy.

## Alternativa: o navegador chamar a API direto (não recomendada)

Com `NEXT_PUBLIC_API_URL` no front, `CORS_ORIGIN` na API e `COOKIE_SAMESITE=none`, o navegador fala com a API em outro domínio. Nesse modo o cookie pertence ao domínio da API e o `middleware.ts` **não o enxerga**, então as páginas protegidas redirecionam para `/login`. Detalhes em [`arquitetura-backend.md`](arquitetura-backend.md), seção 3.5.
