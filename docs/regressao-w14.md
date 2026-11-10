# Regressão pós-migração (PI4-140)

Registro da regressão da W14 sobre a versão publicada: site na Vercel, API Express no Render e banco no Neon.

- **Site:** <https://raizes-pe-gules.vercel.app>
- **API:** <https://raizes-pe-api.onrender.com> (Swagger em `/api-docs`)
- **Código avaliado:** `main` no commit `2064816` (PR #39)
- **Data:** 10/11/2026

## 1. Checagens automáticas

Rodadas sobre uma cópia limpa da `main` (instalação do zero).

| Projeto | Comando | Resultado |
|---|---|---|
| Front | `npm run lint` | 0 erros, 1 aviso (fonte personalizada em `app/layout.tsx`, já existente) |
| Front | `npx tsc --noEmit` | sem erros |
| Front | `npm test` | 32 testes, 32 passam |
| Backend | `npm run lint` | sem erros |
| Backend | `npx tsc --noEmit` | sem erros |
| Backend | `npm test` | 88 testes: 72 passam, 0 falham, **16 pulados** |

Os 16 pulados são os testes que gravam no banco e só rodam com `TEST_DATABASE_URL` apontando para um banco **descartável** (nunca o Neon do time). Para rodá-los, crie uma branch do Neon só para testes, aplique os scripts de `db/` nela e defina no terminal:

```text
PowerShell:  $env:TEST_DATABASE_URL="postgresql://..."; $env:TEST_DB_REMOTO_DESCARTAVEL="1"
cmd:         set TEST_DATABASE_URL=postgresql://...  &  set TEST_DB_REMOTO_DESCARTAVEL=1
```

Depois, em `backend/`, rode `npm test`. Detalhes em [`backend/README.md`](../backend/README.md#testes).

## 2. Checklist de rotas (18 rotas da API)

Teste pelo site publicado, com o Network (F12) aberto. Marque ✅ quando o status for o esperado.

| # | Rota | Acesso | Como conferir | Esperado | Resultado |
|---|---|---|---|---|---|
| 1 | `GET /api/saude` | público | abrir no navegador | 200 `{"ok":true}` | ✅ |
| 2 | `GET /api/saude-bd` | público | abrir no navegador | 200 com a contagem de produtos | ✅ |
| 3 | `POST /api/auth/login` | público | entrar em `/login` | 200 e `Set-Cookie: raizes_sessao` (HttpOnly, Secure) | ✅ |
| 4 | `POST /api/auth/cadastro` | público | criar conta em `/cadastro` | 201 e usuário logado | ✅ |
| 5 | `GET /api/auth/me` | público | recarregar a página logado | 200 com o usuário | ✅ |
| 6 | `POST /api/auth/logout` | logado | clicar em "Sair" | 200 e cookie removido | ☐ |
| 7 | `GET /api/produtos` | público | abrir a vitrine | 200 com a lista | ✅ |
| 8 | `GET /api/produtos/:id` | público | abrir a página de um produto | 200 | ☐ |
| 9 | `GET /api/produtos/:id/relacionados` | público | rolar a página do produto | 200 | ☐ |
| 10 | `GET /api/produtos/:id/avaliacoes` | público | rolar a página do produto | 200 | ☐ |
| 11 | `POST /api/produtos` | artesão | "Adicionar Produto" no painel | 201 | ✅ |
| 12 | `PATCH /api/produtos/:id` | artesão ou admin | editar um produto | 200 | ☐ |
| 13 | `GET /api/artesaos/:id` | público | abrir o perfil de um artesão | 200 com os produtos dele | ☐ |
| 14 | `GET /api/pedidos` | logado | abrir "Meus Pedidos" | 200 | ☐ |
| 15 | `POST /api/pedidos` | comprador | finalizar o checkout | 201 | ✅ |
| 16 | `PATCH /api/pedidos/:id` | artesão ou admin | mudar o status de um pedido | 200 | ☐ |
| 17 | `GET /api/recomendacoes` | público | abrir a vitrine ou o carrinho | 200 | ☐ |
| 18 | `GET /api/painel/estatisticas` | artesão ou admin | abrir `/painel` | 200 | ✅ |

**Proteção (esperado em cada caso):** deslogado, `/painel` redireciona para `/login`; deslogado, `GET /api/painel/estatisticas` responde 401; comprador em `POST /api/produtos` responde 403.

## 3. Observações

- A rota do painel aceita `artesao` e `admin`: o admin abre o painel do artesão e vê tudo zerado, porque não tem loja. Confirmar se esse é o comportamento desejado.
- O Render no plano gratuito dorme quando parado: a primeira chamada pode demorar. Acorde a API (`/api/saude`) antes de testar ou apresentar.

## 4. Defeitos encontrados e correções

Nenhum defeito aberto até o momento. Registrar aqui cada correção feita, com o PR.
