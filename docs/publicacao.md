# Publicação da API e testes no ambiente publicado (PI4-134)

Como colocar o backend Express no ar e ligar o front da Vercel a ele, e o roteiro para testar os fluxos com o Network do navegador aberto.

## Arquitetura publicada

```text
Navegador → Vercel (Next: front + middleware.ts) → rewrites /api/* → Render (API Express) → Neon (PostgreSQL)
```

O navegador fala **só com o domínio da Vercel**. O Next repassa `/api/*` para a API (proxy por `API_URL`, PI4-132). Por isso o cookie `raizes_sessao` continua first-party, o `middleware.ts` enxerga o JWT e **não precisa de CORS**.

## Passo 1: publicar a API no Render

O arquivo [`render.yaml`](../render.yaml) já descreve o serviço (pasta `backend`, build, start e health check em `/api/saude`).

1. No Render: **New > Blueprint**, conecte o repositório `brunosm26/Raizes-PE` e escolha a branch `main`.
2. Preencha as duas variáveis pedidas (ficam só no painel, não vão ao GitHub):
   - `DATABASE_URL`: a string **pooled** do Neon (host com `-pooler`), a mesma do `.env.local`.
   - `SESSION_SECRET`: **o mesmo valor** que estará na Vercel (32+ caracteres). Para gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Aguarde o deploy. A `DIRECT_URL` não é necessária em produção: só a CLI do Prisma usa.
4. Teste no navegador (troque pelo endereço que o Render mostrar):
   - `https://<sua-api>.onrender.com/api/saude` deve responder `{"ok":true}`;
   - `https://<sua-api>.onrender.com/api/saude-bd` deve confirmar a conexão com o banco;
   - `https://<sua-api>.onrender.com/api-docs` abre o Swagger.

Railway ou outro host equivalente serve do mesmo jeito: raiz `backend`, build `npm ci --include=dev && npm run build`, start `npm start`, as duas variáveis acima e `/api/saude` como health check.

## Passo 2: apontar o front da Vercel para a API

No projeto da Vercel, em **Settings > Environment Variables** (ambientes Production e, se quiser, Preview):

| Variável | Valor |
|---|---|
| `API_URL` | `https://<sua-api>.onrender.com` (com `https://`, sem barra no final) |
| `SESSION_SECRET` | o mesmo valor do Render |
| `DATABASE_URL` | já existente (continua servindo de fallback das rotas `app/api`) |

A `API_URL` é lida **no build**: depois de salvar, faça um **novo deploy** (Deployments > Redeploy). Valor sem `http(s)://` derruba o build com a mensagem "API_URL inválida".

Confira: `https://raizes-pe-gules.vercel.app/api/saude` deve responder `{"ok":true}`. Essa rota só existe no Express, então a resposta prova que o proxy está ativo.

## Passo 3: testar os fluxos com o Network aberto

Abra o site publicado, aperte F12 e vá na aba **Network** (marque "Preserve log"). Para cada fluxo, confira as chamadas `/api/...` (sempre no domínio da Vercel, com status 2xx) e tire print.

| Fluxo | Como fazer | O que conferir |
|---|---|---|
| Login | `/login` com um [login de demonstração](../README.md#logins-de-demonstração) | `POST /api/auth/login` 200; na resposta, `Set-Cookie: raizes_sessao` com `HttpOnly`, `Secure` e `SameSite=Lax` |
| Sessão | recarregar a página logado | `GET /api/auth/me` devolve o usuário |
| Cadastro | `/cadastro` com e-mail novo | `POST /api/auth/cadastro` 201 e usuário logado em seguida |
| Checkout | comprador: adicionar ao carrinho e finalizar | `POST /api/pedidos` 201; o pedido aparece em "Meus Pedidos" |
| Painel | artesão: `/painel`; cadastrar um produto | `GET /api/painel/estatisticas` 200; `POST /api/produtos` 201; contador de estoque sobe |
| Admin | admin: `/admin` | as páginas carregam e as chamadas voltam 200 |
| Proteção | deslogado, abrir `/painel` | redireciona para `/login` (o `middleware.ts` valida o JWT) |
| Proteção da API | deslogado, abrir `/api/painel/estatisticas` | 401 |

**Entrega do card:** a URL da API publicada e os prints dos fluxos acima funcionando.

## Pontos de atenção

- **Plano gratuito dorme.** O Render free suspende o serviço após alguns minutos sem requisições e a primeira chamada depois disso demora (dezenas de segundos), o que pode estourar o tempo do proxy da Vercel. Antes de apresentar ou tirar os prints, abra `/api/saude` uma vez para "acordar" a API.
- **Região.** O Render não tem região em São Paulo e o Neon está em `sa-east-1`: cada consulta ganha latência. Para a demonstração é aceitável.
- **Limite de tentativas de login** fica em memória (some ao reiniciar o serviço e não vale entre várias instâncias).
- **Segredos.** `SESSION_SECRET` e `DATABASE_URL` só nos painéis do Render e da Vercel. Trocar o `SESSION_SECRET` derruba as sessões abertas.
- **Reverter.** Para voltar ao Next sozinho, remova a `API_URL` da Vercel e faça um novo deploy.

## Alternativa: o navegador chamar a API direto (não recomendada)

Com `NEXT_PUBLIC_API_URL` no front, `CORS_ORIGIN` na API e `COOKIE_SAMESITE=none`, o navegador fala com a API em outro domínio. Nesse modo o cookie pertence ao domínio da API e o `middleware.ts` **não o enxerga**, então as páginas protegidas redirecionam para `/login`. Detalhes em [`arquitetura-backend.md`](arquitetura-backend.md), seção 3.5.
