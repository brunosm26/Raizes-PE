# Regressão da entrega final da U2

Registro da regressão da entrega final da Unidade 2 (Semanas 16 e 17 de Desenvolvimento Web), com cache e processamento assíncrono. A regressão da W14 (PI4-140) fica como histórico em [`regressao-w14.md`](regressao-w14.md).

- **Site:** <https://raizes-pe-gules.vercel.app>
- **API:** <https://raizes-pe-api.onrender.com> (Swagger em `/api-docs`)
- **Código avaliado:** branch `docs/alinhamento-entrega-u2`, sobre `feature/fila-assincrona-notificacoes` (commit `16ad1b1`), que inclui o cache (`4bfad8a`)
- **Data:** 19/11/2026

## 1. Checagens automáticas

| Projeto | Comando | Resultado |
|---|---|---|
| Front | `npm run lint` | 0 erros, 1 aviso (fonte personalizada em `app/layout.tsx`, já existente) |
| Front | `npm test` | 90 testes em 12 suítes: **90 passam**, 0 falham, 0 pulados |
| Backend | `npm run lint` | sem erros |
| Backend | `npm run typecheck` | sem erros |
| Backend | `npm test` | 296 testes em 20 arquivos: **269 passam**, 0 falham, 27 pulados |

Os 27 pulados são os testes que gravam no banco e só rodam com `TEST_DATABASE_URL` apontando para um banco **descartável** (nunca o Neon do time): pedidos e produtos, artesãos e filtros com banco, cache com banco (`cacheCatalogoBanco.test.ts`) e notificações com banco (`notificacoesBanco.test.ts`). Para rodá-los, siga [`backend/README.md`](../backend/README.md#testes).

Checagens que também fazem parte da entrega (rodar na máquina do time e anotar): no backend, `npm run build`, `npm run openapi:lint` e, com a API no ar, `npm run openapi:conferir`; na raiz, `npm run build`.

## 2. Checklist de rotas (22 rotas do `backend/openapi.yaml`)

Teste pelo site publicado, com o Network (F12) aberto. Marque ✅ quando o status (e o header, quando houver) for o esperado. As contas estão em [logins de demonstração](../README.md#logins-de-demonstração).

| # | Rota | Acesso | Como conferir | Esperado | Resultado |
|---|---|---|---|---|---|
| 1 | `GET /api/saude` | público | abrir no navegador | 200 `{"ok":true}` | ☐ |
| 2 | `GET /api/saude-bd` | público | abrir no navegador | 200 com a contagem de produtos | ☐ |
| 3 | `POST /api/auth/login` | público | entrar em `/login` | 200 `{ "usuario" }` e `Set-Cookie: raizes_sessao` (HttpOnly, Secure) | ☐ |
| 4 | `POST /api/auth/cadastro` | público | criar conta em `/cadastro` | 201 e usuário logado | ☐ |
| 5 | `GET /api/auth/me` | público | recarregar a página logado | 200 com o usuário (`null` deslogado) | ☐ |
| 6 | `POST /api/auth/logout` | público | clicar em "Sair" | 200 e cookie removido | ☐ |
| 7 | `GET /api/produtos` | público | abrir a vitrine duas vezes em até 60 s | 200; `X-Cache: MISS` e depois `HIT` | ☐ |
| 8 | `GET /api/produtos/:id` | público | abrir a página de um produto | 200 | ☐ |
| 9 | `GET /api/produtos/:id/relacionados` | público | rolar a página do produto | 200 | ☐ |
| 10 | `GET /api/produtos/:id/avaliacoes` | público | rolar a página do produto | 200 | ☐ |
| 11 | `POST /api/produtos` | artesão | "Adicionar Produto" no painel | 201; a próxima vitrine vem `X-Cache: MISS` | ☐ |
| 12 | `PATCH /api/produtos/:id` | artesão ou admin | editar um produto | 200; a próxima vitrine vem `MISS` com o valor novo | ☐ |
| 13 | `GET /api/filtros` | público | abrir a vitrine duas vezes | 200; `X-Cache: MISS` e depois `HIT` | ☐ |
| 14 | `GET /api/artesaos` | admin | abrir `/admin/artesaos` | 200 com a lista | ☐ |
| 15 | `GET /api/artesaos/:id` | público | abrir o perfil de um artesão | 200 com os produtos dele | ☐ |
| 16 | `GET /api/pedidos` | logado | abrir "Meus Pedidos" | 200 | ☐ |
| 17 | `POST /api/pedidos` | comprador | finalizar o checkout | 201 na hora (job `pedido.criado` na fila) | ☐ |
| 18 | `PATCH /api/pedidos/:id` | artesão ou admin | marcar um pedido como enviado | 200 (job `pedido.status_atualizado` na fila) | ☐ |
| 19 | `GET /api/recomendacoes` | público | abrir a vitrine (logado e deslogado) | 200; `X-Cache` presente; logo após o checkout, `HIT` | ☐ |
| 20 | `GET /api/painel/estatisticas` | artesão ou admin | abrir `/painel` | 200 | ☐ |
| 21 | `GET /api/notificacoes` | logado | artesão depois de uma venda; comprador depois do envio | 200 com `pedido.nova_venda` / `pedido.enviado`; admin com `fila` | ☐ |
| 22 | `POST /api/notificacoes/ler` | logado | fechar o aviso em "Meus Pedidos" | 200 `{ "marcadas", "naoLidas": 0 }` | ☐ |

**Proteção (esperado em cada caso):** deslogado, `/painel` redireciona para `/login`; deslogado, `GET /api/painel/estatisticas` e `GET /api/notificacoes` respondem 401; comprador em `POST /api/produtos` e em `GET /api/artesaos` responde 403.

O roteiro para gravar essas evidências no screencast está em [`publicacao.md`](publicacao.md#roteiro-do-screencast-cache-e-processamento-assíncrono).

## 3. Observações

- Cache e notificações ficam na memória do processo: um reinício do Render (ou ele dormir) zera os dois. Os pedidos continuam no banco.
- O Render no plano gratuito dorme quando parado: acorde a API (`/api/saude`) antes de testar ou apresentar.
- Antes da regressão no site publicado, a API do Render precisa estar com o commit que tem cache e fila (confira `/api/notificacoes` sem login: deve responder 401, não 404).

## 4. Defeitos encontrados e correções

Nenhum defeito de produto aberto até o momento. Registrar aqui cada correção feita, com o PR.

| Onde | Problema | Correção |
|---|---|---|
| `backend/test/notificacoesSemBanco.test.ts` (PR da fila assíncrona) | O teste "POST /pedidos responde 201 antes do worker terminar" media o **primeiro** POST do servidor, que paga a carga a frio (de 270 a 370 ms numa máquina lenta, contra 4 a 6 ms nos seguintes) e passava do atraso simulado de 150 ms. A API não esperava o job: ele ainda não estava `concluido` na resposta | Cookie gerado e caminho do POST aquecido (`POST /notificacoes/ler`, que não cria job) antes de medir. O teste continua cobrando que o checkout não espera o worker |
