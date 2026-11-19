# Processamento assíncrono (fila em memória)

O checkout e a atualização de status disparam trabalho em background: uma fila de jobs em memória, com um worker que não bloqueia a resposta HTTP. Não usa Redis nem nenhum serviço externo, e **não cria tabela nem migration** (o banco compartilhado do Neon fica intocado).

## Fluxo

```
POST /api/pedidos ──► service grava pedido + itens + estoque (COMMIT)
                  ──► controller: invalidarCatalogo() → enfileira "pedido.criado" → responde 201
                                                               │
                                     (próximo giro do event loop, setImmediate)
                                                               ▼
                                         worker: avisa o comprador ("pedido.recebido")
                                                 avisa cada artesão ("pedido.nova_venda" + resumo pro WhatsApp)
                                                 recalcula as recomendações do comprador e guarda no cache

PATCH /api/pedidos/:id ──► grava o status → enfileira "pedido.status_atualizado" → responde 200
                                                               ▼
                                         worker: avisa o comprador ("pedido.pago" | "pedido.enviado" | "pedido.entregue")

GET  /api/notificacoes     ──► lê o que o worker já processou para o usuário logado (admin: + resumo da fila)
POST /api/notificacoes/ler ──► marca como lidas (todas, ou só os `ids` enviados)
```

## Onde está no código

| Peça | Express | Next (fallback sem `API_URL`) |
|---|---|---|
| Fila e worker (genéricos) | [`backend/src/utils/filaAssincrona.ts`](../backend/src/utils/filaAssincrona.ts) | [`lib/servidor/filaAssincrona.ts`](../lib/servidor/filaAssincrona.ts) (cópia idêntica) |
| Caixa de notificações e textos | [`backend/src/utils/notificacoesPedido.ts`](../backend/src/utils/notificacoesPedido.ts) | [`lib/servidor/notificacoesPedido.ts`](../lib/servidor/notificacoesPedido.ts) (cópia idêntica) |
| Jobs de pedido e instância da fila | [`backend/src/services/filaAssincronaService.ts`](../backend/src/services/filaAssincronaService.ts) | [`lib/servidor/processamentoAssincrono.ts`](../lib/servidor/processamentoAssincrono.ts) |
| Leitura e marcação | `routes/notificacaoRoutes.ts` → `controllers/notificacaoController.ts` → `services/notificacaoService.ts` | `app/api/notificacoes/route.ts` e `app/api/notificacoes/ler/route.ts` |
| Disparo | `controllers/pedidoController.ts` | `app/api/pedidos/route.ts` e `app/api/pedidos/[id]/route.ts` |
| Front | [`lib/contextoPedidos.tsx`](../lib/contextoPedidos.tsx) busca `/api/notificacoes` ao entrar, ao focar a aba e a cada 30 s com a aba visível | — |

`tests/filaNext.test.mjs` garante que as cópias do Next são iguais às do Express.

## Como a fila funciona

- **Status do job:** `pendente` → `processando` → `concluido` ou `erro`. Cada job guarda `tentativas`, `criadoEm`, `iniciadoEm`, `concluidoEm`, `ultimoErro` e a `referencia` (o id do pedido).
- **Não bloqueia:** `enfileirar()` é síncrono, só cria o job e agenda o worker com `setImmediate`. O controller nunca dá `await` no job, então a resposta sai antes do processamento. Se até o enfileiramento falhar, o erro vai pro log e o checkout responde normalmente (o pedido já foi gravado).
- **Um job por vez, em ordem de chegada:** os jobs de um mesmo pedido não se atropelam.
- **Novas tentativas:** um job que falha volta pra fila depois de 200 ms, depois 400 ms. Na 3ª falha fica em `erro` e é logado. A falha nunca chega na resposta HTTP.
- **Sem aviso duplicado:** cada notificação tem uma chave (pedido + tipo, ou pedido + status + job). A nova tentativa de um mesmo job não repete o aviso.
- **Histórico:** ficam os últimos 200 jobs terminados e as últimas 50 notificações de cada usuário.
- **Isolamento:** a rota sempre lê a caixa do usuário **da sessão**. O id de notificação de outra pessoa em `/ler` é ignorado. O admin vê o resumo da fila sem o payload (dados do pedido e de quem comprou).

## Limites (consequência de não ter tabela)

- Tudo fica na memória do processo: reiniciar a API (ou o Render dormir) apaga notificações e histórico da fila. Os pedidos continuam no banco.
- Cada instância tem a sua fila. Com uma instância só (o caso do Render hoje), tudo funciona. No Next em hospedagem serverless as instâncias não compartilham memória, por isso a demonstração é feita no Express.
- O telefone digitado no checkout não vai pro servidor (o `POST /api/pedidos` só recebe `itens`). Por isso o "resumo para o WhatsApp" é o texto pronto pro artesão mandar, sem o número.

## Demonstração no F12 (aba Network)

Use dois navegadores (ou uma janela anônima): um com o comprador e outro com o artesão das contas de demonstração do README.

1. **Comprador:** finalize uma compra no checkout. Na Network, o `POST /api/pedidos` responde `201` na hora.
2. **Artesão:** abra o painel (ou só foque a aba). Vai aparecer um `GET /api/notificacoes` com a venda (`pedido.nova_venda`) e o `resumoWhatsapp` em **Response**.
3. **Artesão:** marque o pedido como enviado. O `PATCH /api/pedidos/:id` responde `200`.
4. **Comprador:** volte pra aba de **Meus Pedidos**. O `GET /api/notificacoes` traz o `pedido.enviado` e o aviso aparece na tela. Ao fechar o aviso, sai um `POST /api/notificacoes/ler` com `{ "marcadas": ..., "naoLidas": 0 }`.
5. **Admin (opcional):** `GET /api/notificacoes` traz `fila.contagem` e `fila.jobsRecentes`, com os dois jobs `concluido` e o pedido em `referencia`.
6. **Recomendações pré-aquecidas:** depois do checkout, o próximo `GET /api/recomendacoes?limite=4` do comprador vem com `X-Cache: HIT` (o worker já calculou). Precisa de `CACHE_TTL_SEGUNDOS` maior que 0.

Pelo Swagger (`/api-docs`), as duas rotas novas estão na tag **Notificações**.

## Testes

- `backend/test/filaAssincrona.test.ts`: fila (não bloqueia, ordem, novas tentativas, erro, histórico), caixa (isolamento, sem duplicar, marcar lidas) e textos.
- `backend/test/notificacoesSemBanco.test.ts`: fluxo pela API sem banco (POST e PATCH respondem antes do job, isolamento por perfil, `/ler`, 400/401, falha do worker sem efeito na resposta, respostas validadas contra o `openapi.yaml`).
- `backend/test/notificacoesBanco.test.ts`: o mesmo fluxo com banco descartável (`TEST_DATABASE_URL`).
- `tests/filaNext.test.mjs`: paridade das rotas do Next e cópias idênticas.
