# Contrato da API: Raízes PE

**Versão:** 1.0 (Entrega Final U2)
**Status:** alinhado à API implementada. A especificação interativa completa, conferida por testes contra as rotas do Express, fica em [`backend/openapi.yaml`](../backend/openapi.yaml) e é servida em `/api-docs` (Swagger UI) e `/api-docs.json`.
**Projeto:** Raízes PE (Projeto Origem), Marketplace da Economia Criativa

Este documento resume o contrato para quem integra o front ou testa pelo navegador. Em caso de dúvida, vale o `openapi.yaml`: o `npm test` do backend falha se uma rota existir sem estar documentada lá, ou o contrário.

## 1. Padrões gerais

- Base: `/api`. No site publicado, o navegador chama o domínio da Vercel e o Next repassa `/api/*` para a API Express no Render.
- JSON em UTF-8. Só `Content-Type: application/json` é lido; corpo malformado responde 400 e acima de 4 MB, 413.
- **Sem envelope:** as respostas de sucesso devolvem o objeto ou o array direto. A única exceção é `GET /api/recomendacoes` (seção 6), que mantém `sucesso`, `origem` e `dados` desde a baseline de IA.
- Datas em ISO 8601 (`YYYY-MM-DD` ou timestamp ISO). Valores monetários em reais, como número, sem `R$`.
- **Ids:** onde a rota recebe `{id}`, aceita o UUID e os ids antigos da demonstração (`p1` para produto, `a2` para artesão). Id em formato inválido é tratado como inexistente (404 ou lista vazia), nunca 400.
- **Sessão:** cookie `httpOnly` `raizes_sessao` com um JWT HS256 de 7 dias, gravado por `POST /api/auth/login` e `POST /api/auth/cadastro`. Nenhum token sai no corpo. Detalhes em [`estrategia-autenticacao.md`](estrategia-autenticacao.md).
- **Perfis:** `comprador`, `artesao` e `admin`. Sem sessão, 401; com sessão de outro perfil, 403.

### Formato de erro

Todo erro responde neste formato, com a mensagem em português. Caminho inexistente responde 404 no mesmo formato. Erro inesperado responde 500 com `"Erro interno do servidor"`, sem expor a mensagem interna.

```json
{ "ok": false, "erro": "Faça login para continuar." }
```

As rotas `app/api` do Next (fallback sem `API_URL`) usam o mesmo formato nas rotas novas; algumas mais antigas respondem só `{ "erro": "..." }`, com os mesmos status. O front lê só o status e o campo `erro`.

### Headers de cache

`GET /api/filtros`, `GET /api/produtos` e `GET /api/recomendacoes` passam pelo cache em memória ([`cache.md`](cache.md)) e respondem com:

| Header | Valor | Significado |
|---|---|---|
| `X-Cache` | `HIT` ou `MISS` | `HIT` saiu da memória; `MISS` consultou o PostgreSQL e passou a ficar guardado até o TTL ou a próxima escrita |
| `Cache-Control` | `private, no-cache` | O navegador sempre revalida com a API e proxies compartilhados não guardam |

## 2. Saúde

| Rota | Acesso | Resposta 200 |
|---|---|---|
| `GET /api/saude` | público | `{ "ok": true }` (não depende do banco) |
| `GET /api/saude-bd` | público | `{ "ok": true, "produtos": 7 }`. Em falha, 500 com a mensagem real do banco (rota de diagnóstico) |

## 3. Autenticação

### POST `/api/auth/login`

```json
{ "email": "ana.beatriz@raizespe.dev", "senha": "demo123", "perfil": "comprador" }
```

- `perfil` é a aba escolhida na tela de login e precisa bater com o perfil da conta (o admin entra por qualquer aba).

**200:** grava o cookie (`Set-Cookie: raizes_sessao=<jwt>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax`, com `Secure` em produção) e devolve:

```json
{
  "usuario": {
    "id": "10000000-0000-4000-8000-000000000007",
    "nome": "Ana Beatriz",
    "tipo": "comprador"
  }
}
```

**Erros:** `400` corpo inválido; `401` `"E-mail ou senha incorretos."`; `403` conta de outro perfil (`"Esta conta não é de comprador. Use a aba correta."`); `429` depois de 5 falhas para o mesmo e-mail e IP em 15 minutos; `413`; `500`.

### POST `/api/auth/cadastro`

Cria sempre uma conta de **comprador** e já inicia a sessão. Contas de artesão e admin são criadas por quem administra a plataforma; artesãos da carga sem senha ganham uma pelo `npm run contas:artesao` ([`estrategia-autenticacao.md`](estrategia-autenticacao.md), seção 13).

```json
{ "nome": "Maria da Silva", "email": "maria@exemplo.com", "senha": "senha-segura" }
```

- `nome`: 1 a 150 caracteres, sem espaços nas pontas. `email`: válido, até 150 caracteres, gravado em minúsculas. `senha`: 8 a 200 caracteres, guardada só como hash scrypt. Um `tipo` enviado é ignorado.

**201:** mesmo `Set-Cookie` e mesmo corpo do login (`{ "usuario": { "id", "nome", "tipo": "comprador" } }`).

**Erros:** `400` (`"Informe seu nome (até 150 caracteres)."`, `"Informe um e-mail válido."`, `"A senha precisa ter de 8 a 200 caracteres."`); `409` `"Este e-mail já está cadastrado."`; `413`; `500`.

### POST `/api/auth/logout` e GET `/api/auth/me`

- `POST /api/auth/logout`: apaga o cookie (`Max-Age=0`) e responde `{ "ok": true }`, com ou sem sessão.
- `GET /api/auth/me`: revalida no banco se o usuário ainda existe com o mesmo perfil. Nunca responde erro: devolve `{ "usuario": { "id", "nome", "tipo" } }` ou `{ "usuario": null }` para visitante.

## 4. Catálogo e produtos

### GET `/api/produtos`

Vitrine, do mais novo para o mais antigo. Pública. Filtros opcionais e combináveis:

| Parâmetro | Comparação |
|---|---|
| `tecnica` | exata (`Cerâmica`, `Têxtil`, `Madeira`, `Renda e Bordado`, `Palha`) |
| `regiao` | exata, na região de origem do artesão |
| `categoria` | exata |
| `busca` | texto livre em nome, técnica, categoria, artesão e região, sem acento e sem diferença de maiúsculas |

Valor sem correspondência devolve lista vazia, não 400.

```text
GET /api/produtos?tecnica=Cerâmica&regiao=Alto%20do%20Moura,%20Caruaru&busca=vaso
```

**200** com `X-Cache: MISS` (ou `HIT`) e `Cache-Control: private, no-cache`. O corpo é o array direto:

```json
[
  {
    "id": "30000000-0000-4000-8000-000000000001",
    "artesaoId": "20000000-0000-4000-8000-000000000001",
    "nome": "Vaso de Cerâmica Maragogi",
    "descricao": "Vaso torneado à mão em argila local, com acabamento em duas cores e queima em forno a lenha. Cada peça é única, com pequenas variações de tom.",
    "tecnica": "Cerâmica",
    "categoria": "Decoração",
    "preco": 185,
    "estoqueQtd": 8,
    "dataCadastro": "2025-06-01",
    "imagemUrl": "/produtos/p1.svg",
    "artesaoNome": "Vitalino Neto",
    "artesaoRegiao": "Alto do Moura, Caruaru",
    "artesaoUsuarioId": "10000000-0000-4000-8000-000000000001"
  }
]
```

Esse objeto é o `ProdutoComArtesao`, usado também nas outras rotas de produto. `imagemUrl` vem ausente quando o produto não tem foto. **Erro:** `500`.

### Outras leituras de produto (públicas, sem cache)

| Rota | Resposta 200 | Observação |
|---|---|---|
| `GET /api/produtos/{id}` | `ProdutoComArtesao` | `404` `"Produto não encontrado"` (inclui id inválido) |
| `GET /api/produtos/{id}/relacionados?limite=3` | array de `ProdutoComArtesao` da mesma técnica, sem o próprio produto | `limite` de 1 a 20, ajustado sem 400; id inexistente devolve `[]` |
| `GET /api/produtos/{id}/avaliacoes` | `{ "media": 4.5, "quantidade": 2 }` | sem avaliação ou id inexistente devolve zeros |

### GET `/api/filtros`

Opções dos filtros da vitrine e da tela `/admin/categorias`. Pública, sem parâmetros, com `X-Cache` (uma entrada só).

- `tecnicas`: a lista fixa da plataforma, na ordem do `CHECK` de `produto.tecnica`.
- `regioes` e `categorias`: valores distintos do banco (não há tabela de categorias), sem vazios, sem repetição por maiúsculas e em ordem alfabética pt-BR.

**200** (carga de demonstração, `db/05_dados_raizes_pe.sql`):

```json
{
  "tecnicas": ["Cerâmica", "Têxtil", "Madeira", "Renda e Bordado", "Palha"],
  "regioes": ["Alto do Moura, Caruaru", "Comunidade do Pilar", "Garanhuns", "Tacaratu", "Tracunhaém"],
  "categorias": ["Casa", "Decoração", "Vestuário"]
}
```

### POST `/api/produtos` e PATCH `/api/produtos/{id}`

| Rota | Perfis | Corpo | Sucesso |
|---|---|---|---|
| `POST /api/produtos` | `artesao` | `nome`, `descricao`, `preco`, `estoqueQtd`, `tecnica`, `categoria` e `imagemUrl` opcional | `201` com o `ProdutoComArtesao` criado na loja do artesão da sessão |
| `PATCH /api/produtos/{id}` | `artesao` (dono) ou `admin` | `nome`, `descricao`, `preco`, `estoqueQtd` e `imagemUrl` (todos enviados; ausente remove a foto). Técnica e categoria não mudam | `200` com o produto atualizado |

- `preco` maior que 0 e até 99.999.999,99, arredondado para centavos. `estoqueQtd` inteiro de 0 a 1.000.000. `imagemUrl` aceita data URL de imagem de até ~2 MB, `http(s)://` ou caminho `/...`.
- **Erros:** `400` validação; `401`; `403` perfil sem permissão ou produto de outro artesão (`"Este produto pertence a outro artesão."`); `404`; `413`; `500`.
- As duas escritas **invalidam o cache** inteiro na hora.

## 5. Artesãos

### GET `/api/artesaos/{id}`

Perfil público do artesão com os produtos dele. Aceita o UUID da tabela `artesao` ou o id antigo (`a2`).

**200:**

```json
{
  "id": "20000000-0000-4000-8000-000000000002",
  "nome": "Cooperativa de Tacaratu",
  "regiaoOrigem": "Tacaratu",
  "biografia": "Cooperativa têxtil com 12 artesãs associadas, especializada em tear manual e tingimento natural.",
  "produtos": [
    {
      "id": "30000000-0000-4000-8000-000000000002",
      "artesaoId": "20000000-0000-4000-8000-000000000002",
      "nome": "Tapete Tear Manual",
      "descricao": "Tapete tecido em tear manual de madeira, com algodão cru e tingimento natural à base de plantas da região.",
      "tecnica": "Têxtil",
      "categoria": "Casa",
      "preco": 320,
      "estoqueQtd": 8,
      "dataCadastro": "2025-05-20",
      "imagemUrl": "/produtos/p2.svg",
      "artesaoNome": "Cooperativa de Tacaratu",
      "artesaoRegiao": "Tacaratu",
      "artesaoUsuarioId": "10000000-0000-4000-8000-000000000002"
    }
  ]
}
```

`produtos` é um array de `ProdutoComArtesao` (no exemplo, um dos dois produtos da cooperativa). **Erros:** `404` `"Artesão não encontrado"` (inclui id inválido); `500`.

### GET `/api/artesaos`

Lista para a gestão pelo admin. **Só `admin`.** Ordem alfabética pt-BR do nome. `temLogin` diz só se a conta tem senha cadastrada; hash e e-mail nunca saem na resposta.

**200:**

```json
[
  {
    "id": "20000000-0000-4000-8000-000000000002",
    "usuarioId": "10000000-0000-4000-8000-000000000002",
    "nome": "Cooperativa de Tacaratu",
    "regiaoOrigem": "Tacaratu",
    "tecnicas": ["Têxtil"],
    "totalProdutos": 2,
    "temLogin": true,
    "dataCadastro": "2025-01-22"
  }
]
```

**Erros:** `401` `"Faça login para continuar."`; `403` `"Seu perfil não tem permissão para esta ação."`; `500`.

## 6. Recomendações

### GET `/api/recomendacoes`

Motor de recomendação integrado ao backend e ao PostgreSQL/Neon ([`MODULO_IA.md`](MODULO_IA.md)). O comprador vem **da sessão**, nunca da URL: comprador logado recebe recomendações pelo próprio histórico; visitante (ou outro perfil) recebe o cold start. Produtos sem estoque nunca aparecem.

| Parâmetro | Regra |
|---|---|
| `limite` | opcional, padrão 4. Fora de 1 a 20 é ajustado ao limite mais próximo; texto não numérico usa o padrão |

**200** com `X-Cache` e `Cache-Control` (uma entrada por comprador e `limite`; visitantes dividem a do cold start):

```json
{
  "sucesso": true,
  "origem": "baseline_ia_v1",
  "compradorId": "10000000-0000-4000-8000-000000000007",
  "total": 4,
  "dados": [
    {
      "id": "30000000-0000-4000-8000-000000000006",
      "nome": "Jarro de Cerâmica Fosco",
      "tecnica": "Cerâmica",
      "preco": 210,
      "estoqueQtd": 6,
      "artesaoNome": "Ateliê Barro Vivo",
      "motivo": "Inspirado no seu apreço por Cerâmica",
      "score": 105,
      "criterio": "historico_tecnica"
    }
  ]
}
```

- Valores ilustrativos. Cada item de `dados` é um `ProdutoComArtesao` completo (encurtado no exemplo) mais `motivo`, `score` e `criterio` (`historico_tecnica`, `historico_regiao`, `popularidade` ou `novidade`).
- `compradorId` é `null` para visitante.
- Um pedido novo ou mudança de status invalida o cache, e o worker da fila já recalcula a lista do comprador depois do checkout.

**Erro:** `500`.

## 7. Pedidos

### GET `/api/pedidos`

Pedidos visíveis para a sessão, mais recentes primeiro, cada um com os itens. **Qualquer perfil logado:** comprador vê os próprios, artesão vê os que contêm produto dele e admin vê todos.

**200:**

```json
[
  {
    "id": "40000000-0000-4000-8000-000000000001",
    "compradorId": "10000000-0000-4000-8000-000000000007",
    "compradorNome": "Ana Beatriz",
    "dataPedido": "2025-07-02",
    "status": "entregue",
    "valorTotal": 185,
    "itens": [
      {
        "id": "50000000-0000-4000-8000-000000000001",
        "pedidoId": "40000000-0000-4000-8000-000000000001",
        "produtoId": "30000000-0000-4000-8000-000000000001",
        "quantidade": 1,
        "precoUnitario": 185,
        "produtoNome": "Vaso de Cerâmica Maragogi",
        "produtoTecnica": "Cerâmica",
        "artesaoUsuarioId": "10000000-0000-4000-8000-000000000001",
        "artesaoNome": "Vitalino Neto"
      }
    ]
  }
]
```

**Erros:** `401`; `500`.

### POST `/api/pedidos`

Checkout. **Só `comprador`**; o comprador é sempre o da sessão.

```json
{ "itens": [ { "produtoId": "p4", "quantidade": 2 } ] }
```

- `quantidade` inteira de 1 a 99 por linha; itens repetidos do mesmo produto são somados.
- Preço e total vêm do banco (`compradorId`, `valorTotal` e `precoUnitario` enviados são ignorados). Pedido, itens e baixa de estoque ficam na mesma transação, com o estoque travado (`SELECT ... FOR UPDATE`). O pedido nasce `pendente`.
- Depois do COMMIT, invalida o cache e enfileira o job `pedido.criado` **sem esperar por ele** (seção 9).

**201:** o pedido criado, no mesmo formato de um item de `GET /api/pedidos`.

**Erros:** `400`; `401`; `403`; `404` `"Produto não encontrado."`; `409` estoque insuficiente (`"Só restam 3 unidade(s) de \"Escultura em Madeira - Leão\"."`); `413`; `500`.

### PATCH `/api/pedidos/{id}`

Atualiza o status. **`artesao` ou `admin`.** O admin muda para qualquer status; o artesão só marca `enviado`, e só em pedido que contém produto dele.

```json
{ "status": "enviado" }
```

- Valores: `pendente`, `pago`, `enviado`, `entregue`. A sequência não é conferida.
- Depois de gravar, invalida o cache e enfileira o job `pedido.status_atualizado` sem esperar por ele.

**200:** o pedido atualizado, com os itens.

**Erros:** `400`; `401`; `403` perfil sem permissão, status não permitido ao artesão ou pedido sem produto dele (`"Este pedido não contém produtos seus."`); `404` `"Pedido não encontrado."` (inclui id que não é UUID); `413`; `500`.

## 8. Painel do artesão

### GET `/api/painel/estatisticas`

**`artesao` ou `admin`** (o admin não tem loja e recebe tudo zerado). Histórico dos 6 meses até a venda mais recente.

```json
{
  "vendasDoMes": 595,
  "vendasDeltaPct": 12,
  "pedidosPendentes": 1,
  "historicoMensal": [ { "mes": "Out", "faturamento": 595, "pedidos": 3 } ],
  "vendasPorTecnica": [ { "tecnica": "Cerâmica", "totalVendido": 395, "porcentagem": 66 } ]
}
```

Valores ilustrativos; `historicoMensal` tem sempre 6 itens (encurtado no exemplo). **Erros:** `401`; `403`; `500`.

## 9. Notificações (processamento assíncrono)

Avisos gerados pelo worker da fila em memória a partir dos jobs de `POST /api/pedidos` e `PATCH /api/pedidos/{id}` ([`processamento-assincrono.md`](processamento-assincrono.md)). Não há tabela no banco: as notificações somem quando a API reinicia.

### GET `/api/notificacoes`

**Qualquer perfil logado.** Devolve só as notificações do usuário da sessão, mais recentes primeiro, sempre com `Cache-Control: no-store`.

- Comprador: `pedido.recebido`, `pedido.pago`, `pedido.enviado`, `pedido.entregue`.
- Artesão: `pedido.nova_venda`, com `resumoWhatsapp` pronto para mandar ao comprador.
- Admin: também o campo `fila`, com a contagem de jobs por status e até 20 jobs recentes (sem o payload).

**200:**

```json
{
  "naoLidas": 1,
  "total": 2,
  "dados": [
    {
      "id": "b3a0f6c2-5d1e-4b8a-9f17-2c4e6a8d0b13",
      "usuarioId": "10000000-0000-4000-8000-000000000007",
      "pedidoId": "4a1b2c3d-0000-4000-8000-000000000010",
      "tipo": "pedido.enviado",
      "mensagem": "Seu pedido #4A1B2C3D foi enviado pelo artesão e está a caminho.",
      "data": "2026-11-19T15:04:12.381Z",
      "lida": false
    }
  ],
  "fila": {
    "contagem": { "pendente": 0, "processando": 0, "concluido": 2, "erro": 0 },
    "jobsRecentes": [
      {
        "id": "e7c1d9a4-2b6f-4c3e-8a50-91f2d4b6c8e0",
        "tipo": "pedido.status_atualizado",
        "referencia": "4a1b2c3d-0000-4000-8000-000000000010",
        "status": "concluido",
        "tentativas": 1,
        "maxTentativas": 3,
        "criadoEm": "2026-11-19T15:04:12.350Z",
        "iniciadoEm": "2026-11-19T15:04:12.352Z",
        "concluidoEm": "2026-11-19T15:04:12.381Z",
        "ultimoErro": null
      }
    ]
  }
}
```

Ids e datas ilustrativos; `fila` só aparece para o admin. **Erros:** `401`; `500`.

### POST `/api/notificacoes/ler`

**Qualquer perfil logado.** Sem corpo (ou sem `ids`), marca todas as notificações do usuário da sessão; com `ids` (até 100), só essas. Ids de outro usuário ou inexistentes são ignorados.

```json
{ "ids": ["b3a0f6c2-5d1e-4b8a-9f17-2c4e6a8d0b13"] }
```

**200:** `{ "marcadas": 1, "naoLidas": 0 }`. **Erros:** `400`; `401`; `413`; `500`.

## 10. Resumo das rotas

| Método e rota | Acesso | Cache | Dispara job |
|---|---|---|---|
| `GET /api/saude`, `GET /api/saude-bd` | público | — | — |
| `POST /api/auth/login`, `/cadastro`, `/logout`; `GET /api/auth/me` | público | — | — |
| `GET /api/produtos` | público | `X-Cache` | — |
| `GET /api/produtos/{id}`, `/relacionados`, `/avaliacoes` | público | — | — |
| `POST /api/produtos` | artesão | invalida | — |
| `PATCH /api/produtos/{id}` | artesão (dono) ou admin | invalida | — |
| `GET /api/filtros` | público | `X-Cache` | — |
| `GET /api/artesaos` | admin | — | — |
| `GET /api/artesaos/{id}` | público | — | — |
| `GET /api/pedidos` | logado | — | — |
| `POST /api/pedidos` | comprador | invalida | `pedido.criado` |
| `PATCH /api/pedidos/{id}` | artesão ou admin | invalida | `pedido.status_atualizado` |
| `GET /api/recomendacoes` | público (personaliza com sessão de comprador) | `X-Cache` | — |
| `GET /api/painel/estatisticas` | artesão ou admin | — | — |
| `GET /api/notificacoes` | logado | `no-store` | — |
| `POST /api/notificacoes/ler` | logado | — | — |

## 11. Códigos HTTP

| Código | Significado |
|---|---|
| 200 | Sucesso |
| 201 | Recurso criado (cadastro, produto, pedido) |
| 400 | Corpo inválido ou campo com valor inválido |
| 401 | Sem sessão válida |
| 403 | Perfil sem permissão, ou recurso de outro usuário |
| 404 | Recurso ou caminho não encontrado |
| 409 | Conflito: e-mail já cadastrado ou estoque insuficiente |
| 413 | Corpo acima de 4 MB |
| 429 | Muitas tentativas de login (5 falhas por e-mail e IP a cada 15 minutos) |
| 500 | Erro interno |

## 12. Histórico

- **0.1 a 0.3:** proposta inicial com envelope `{ "sucesso", "dados" }` e rotas que não chegaram a existir (`POST /api/usuarios`, `GET /api/compradores/{id}/pedidos`, `PATCH /api/pedidos/{id}/status`), atualizada aos poucos na PI4-143 e na PI4-146.
- **1.0 (Entrega Final U2):** contrato reescrito a partir do `backend/openapi.yaml`, com cache (`X-Cache`) e notificações da fila assíncrona.
