# Cache da API

Cache em memória, com TTL e invalidação explícita, nas três leituras públicas que a vitrine faz a cada visita. Não precisa de Redis nem de nenhum serviço externo, e não mexe no schema do banco.

## Onde foi aplicado e por quê

| Rota | Chave | Por que cachear |
|---|---|---|
| `GET /api/filtros` | `filtros` (uma só) | Toda abertura da vitrine chama a rota, e ela faz dois `SELECT DISTINCT` (regiões e categorias) que quase nunca mudam |
| `GET /api/produtos` | `produtos:[tecnica, regiao, categoria, busca]` | É a rota mais chamada (vitrine e cada troca de filtro). A consulta junta produto, artesão e usuário e filtra sem acento |
| `GET /api/recomendacoes` | `recomendacoes:<compradorId ou anonimo>:<limite>` | O motor lê todos os produtos, as avaliações e o histórico do comprador e calcula a pontuação de cada peça. É a leitura mais cara |

Ficaram **fora** do cache: rotas com sessão e dado pessoal (`/pedidos`, `/painel`, `/auth/me`), rotas de escrita e as leituras de um produto só (`/produtos/:id`, relacionados, avaliações), que são baratas e pouco repetidas.

Detalhes das chaves:

- **Produtos:** os quatro filtros entram sempre na mesma ordem, então `?regiao=X&tecnica=Y` e `?tecnica=Y&regiao=X` caem na mesma entrada.
- **Recomendações:** o comprador vem da **sessão**, nunca da URL. Cada comprador tem a própria entrada, e visitante ou outro perfil divide a entrada `anonimo` (o cold start, que é igual para todos). Um comprador nunca recebe a recomendação de outro.

## Como funciona

- **Código:** a classe `CacheMemoria` fica em [`backend/src/utils/cacheMemoria.ts`](../backend/src/utils/cacheMemoria.ts). A instância, as chaves e a invalidação ficam em [`backend/src/services/cacheCatalogo.ts`](../backend/src/services/cacheCatalogo.ts), e os headers em [`backend/src/controllers/respostaCache.ts`](../backend/src/controllers/respostaCache.ts). No fallback do Next (sem `API_URL`), o mesmo funcionamento está em [`lib/servidor/cacheCatalogo.ts`](../lib/servidor/cacheCatalogo.ts). O teste `tests/cacheNext.test.mjs` garante que as duas cópias da classe são idênticas.
- **TTL:** vem de `CACHE_TTL_SEGUNDOS`. O padrão é 60 s, e `0` desliga o cache. Valor inválido impede a API de subir. Depois do TTL, a entrada expira e a próxima leitura volta ao banco.
- **Invalidação:** qualquer escrita bem-sucedida que muda catálogo, estoque ou histórico apaga **o cache inteiro** na hora:
  - `POST /api/produtos` (produto novo: vitrine, categorias e recomendações)
  - `PATCH /api/produtos/:id` (preço, estoque e nome)
  - `POST /api/pedidos` (baixa de estoque e histórico do comprador)
  - `PATCH /api/pedidos/:id` (status entra no histórico)

  As três rotas dependem das mesmas tabelas, então apagar tudo é mais seguro do que tentar descobrir quais chaves a escrita afetou, e o custo é pequeno (só a próxima leitura volta ao banco). Uma escrita que falha (400, 401, 403, 404) não apaga nada.
- **Corrida:** se uma escrita acontece enquanto uma leitura ainda está consultando o banco, o resultado dessa leitura não é guardado. Sem isso, um dado de antes da escrita voltaria para o cache logo depois de apagado.
- **Memória:** no máximo 500 entradas. Como a busca livre gera chaves sem limite, quando passa disso a entrada mais antiga sai.
- **Headers:** `X-Cache: HIT` (veio da memória) ou `X-Cache: MISS` (consultou o PostgreSQL), mais `Cache-Control: private, no-cache`. Com esse `Cache-Control`, o navegador sempre pergunta à API e nenhum proxy compartilhado guarda a resposta. Quem decide se a leitura sai da memória é o servidor. No modo de chamada direta (CORS), o header é exposto com `Access-Control-Expose-Headers: X-Cache`.
- **Limite conhecido:** o cache é por processo. Com várias instâncias da API, cada uma teria o seu, e uma escrita só apagaria o cache da instância que a recebeu (as outras se atualizariam no TTL). O Render roda uma instância só. Para escalar, a troca seria por um cache compartilhado, como Redis.

## Demonstração na aba Network (F12)

1. Suba front e API (`README.md`, seção "Como rodar") e abra `http://localhost:3000`.
2. F12, aba **Network**, filtro **Fetch/XHR**.
3. Recarregue a página. Clique em `produtos` (ou `filtros`, `recomendacoes`) e veja em **Response Headers**: `x-cache: MISS`.
4. Recarregue de novo em até 60 s: a mesma requisição vem com `x-cache: HIT`, e o tempo da coluna **Time** costuma cair.
5. Entre como artesão e edite o estoque de um produto (ou, como comprador, faça um pedido). Volte à vitrine: a primeira leitura é `MISS` e já mostra o valor novo. A seguinte é `HIT` de novo.
6. Para mostrar o TTL, espere mais de 60 s sem escrever nada e recarregue: volta `MISS`.

Pelo terminal, sem navegador:

```powershell
curl.exe -s -D - -o NUL http://localhost:4000/api/filtros | findstr /i "x-cache cache-control"
```

Rode duas vezes: primeiro `MISS`, depois `HIT`.

## Testes

- `backend/test/cacheCatalogo.test.ts` (sem banco): classe (HIT/MISS, TTL com relógio falso, invalidação, corrida, erro não guardado, teto de entradas), headers nas três rotas, chave canônica, separação por comprador, invalidação nas quatro escritas, escrita que falha não invalida, expiração pelo TTL na rota e headers no `openapi.yaml`.
- `backend/test/cacheCatalogoBanco.test.ts` (com `TEST_DATABASE_URL`): com o PostgreSQL de verdade, `PATCH /produtos/:id` e `POST /pedidos` invalidam e a leitura seguinte já traz o estoque novo.
- `tests/cacheNext.test.mjs`: o mesmo contrato nas rotas `app/api` do Next.

As outras suítes rodam com o cache desligado (`CACHE_TTL_SEGUNDOS=0`, definido em `backend/test/ajudantes.ts` e em `tests/rotasAdminFiltros.test.mjs`), porque trocam os dados entre uma chamada e outra.
