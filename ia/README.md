# Módulo de IA: mockup executável do serviço de recomendação (AV2)

> **Nota de Integração Full Stack (Web U2):** na aplicação Web publicada, a recomendação opera integrada em tempo real ao PostgreSQL/Neon, pelo motor do backend Express em `GET /api/recomendacoes` (com cache e pré-cálculo pela fila assíncrona). É esse motor que alimenta a vitrine. Este diretório é o artefato complementar da disciplina de IA, para experimentação offline com dados sintéticos. Detalhes da integração em [`docs/MODULO_IA.md`](../docs/MODULO_IA.md).

Este é o módulo de recomendação especificado na AV1, em forma de mockup executável (Trilha A, serviço em BentoML). Ele mostra o caminho feliz: alguém instala, sobe o serviço e vê a entrada virar saída conforme o contrato da AV1. Como artefato de experimentação offline, trabalha só com dados sintéticos (RNF-02) e sobe como serviço próprio (RNF-05), fora do caminho das telas: o que a vitrine mostra vem do motor do backend, descrito na nota acima.

A aplicação usa o motor do backend em TypeScript ([`backend/src/services/recomendacaoService.ts`](../backend/src/services/recomendacaoService.ts), com cópia em [`lib/motorRecomendacao.ts`](../lib/motorRecomendacao.ts) no fallback do Next; regras em [`docs/BASELINE_IA.md`](../docs/BASELINE_IA.md)), que recomenda por histórico do comprador e responde em `GET /api/recomendacoes` pela API (porta 4000, ou 3000 pelo proxy do Next). Este serviço é o módulo da AV1, que recomenda a partir de um produto de referência ou de um filtro de técnica e região, e responde no mesmo caminho, mas na porta 3001.

## Instalação

Use Python 3.10 ou superior (recomendado 3.13), `pip` e `curl`. Execute na raiz do repositório.

```bash
python -m venv .venv
./.venv/bin/python -m pip install -r ia/requirements.txt
```

No PowerShell, por exemplo com o Python 3.13 instalado:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ia/requirements.txt
```

## Como subir

```bash
cd ia
../.venv/bin/bentoml serve servico:Recomendador --port 3001
```

No PowerShell, execute a partir da raiz:

```powershell
cd ia
..\.venv\Scripts\bentoml.exe serve servico:Recomendador --port 3001
```

Espere a linha `Service Recomendador initialized`. Deixe esse terminal aberto e rode os testes em outro. A porta é a 3001 para não colidir com o `npm run dev`, que usa a 3000.

Documentação interativa (Swagger) do contrato `GET`: http://127.0.0.1:3001/api/docs

## Mini dicionário de dados

O arquivo [catálogo sintético](dados/catalogo_sintetico.json) contém 12 produtos, 7 artesãos, 20 linhas de vendas e 18 avaliações fictícias. O produto `p10` tem estoque zero de propósito. O ID `p999` é reservado para demonstrar a busca sem resultado.

| Conjunto | Campo | Significado |
|---|---|---|
| Produto | `id` | Identifica a peça no catálogo e nas recomendações. |
| Produto | `artesao_id` | Liga a peça ao artesão para obter a região de origem. |
| Produto | `nome` | Nome comercial da peça, exibido na recomendação. |
| Produto | `tecnica` | Técnica artesanal usada para encontrar peças semelhantes. |
| Produto | `categoria` | Grupo comercial da peça, carregado como atributo do catálogo. |
| Produto | `preco` | Preço de venda em reais, exibido na recomendação. |
| Produto | `estoque_qtd` | Unidades disponíveis. A peça pode ser recomendada quando o estoque é maior que zero. |
| Produto | `data_cadastro` | Data de entrada no catálogo. A peça mais recente tem prioridade em caso de empate na popularidade. |
| Artesão | `id` | Identificador do artesão associado à peça. |
| Artesão | `regiao_origem` | Local de origem do artesão, usado para aproximar peças da mesma região. |
| Item de pedido | `produto_id` | Peça vendida. |
| Item de pedido | `quantidade` | Unidades vendidas nessa linha. A soma por peça entra na popularidade. |
| Avaliação | `produto_id` | Peça avaliada. |
| Avaliação | `nota` | Nota de 1 a 5 dada à peça. A média por peça entra na popularidade. |

## Funções de acesso

- `buscar_produto_por_id(catalogo, produto_id)` retorna o produto de referência para obter sua técnica e região. Um ID ausente gera `produto_nao_encontrado`, convertido em HTTP 404.
- `listar_produtos_disponiveis(catalogo, excluir_id=None)` retorna as peças com estoque que o motor pode ranquear, excluindo a referência quando informada. Se nenhuma peça estiver disponível, retorna uma lista vazia.

`carregar_catalogo()` lê o JSON na inicialização. Durante as requisições, o motor usa as duas funções de consulta acima. O log registra uma linha por consulta nas rotas `GET /api/recomendacoes` e `POST /recomendar`.

**Experimento com o estoque.** Execute a primeira chamada abaixo e veja `p8` entre as recomendações. Em `ia/dados/catalogo_sintetico.json`, mude o `estoque_qtd` de `p8` de `10` para `0`, reinicie o BentoML e repita a chamada. A peça sai da resposta e dos IDs retornados pela função que lista candidatos. Volte o estoque a `10` e reinicie para reproduzir o resumo do catálogo original.

## Gerar o log com três chamadas

Execute em outro terminal, a partir da raiz, com o serviço no ar. No PowerShell, use `curl.exe` no lugar de `curl`.

```bash
curl -i "http://127.0.0.1:3001/api/recomendacoes?produto_id=p1&limite=3"
curl -i "http://127.0.0.1:3001/api/recomendacoes?tecnica=Palha&regiao=Pilar&limite=3"
curl -i "http://127.0.0.1:3001/api/recomendacoes?produto_id=p999&limite=3"
```

As chamadas retornam HTTP 200, 200 e 404. Elas acrescentam quatro linhas a `ia/logs/acessos.jsonl`: duas para a primeira chamada (busca e listagem), uma para a segunda (listagem) e uma para a terceira (busca com erro). Cada linha tem data e hora em UTC, função, rota de origem, parâmetros resumidos, quantidade, IDs retornados e status. O log usa o marcador `desconhecido` para IDs ausentes no catálogo.

Abra o arquivo em um editor ou use `tail -n 4 ia/logs/acessos.jsonl` no Bash e `Get-Content .\ia\logs\acessos.jsonl -Tail 4` no PowerShell. Para um resumo que conte apenas essas três chamadas quando já houver histórico, escolha um caminho absoluto para um arquivo novo na variável `RAIZES_IA_LOG` nos dois terminais antes de iniciar o serviço. Use esse mesmo caminho ao abrir o log.

## Ver o resumo

Na raiz, execute `./.venv/bin/python ia/resumir_acessos.py` no Bash ou `.\.venv\Scripts\python.exe ia\resumir_acessos.py` no PowerShell. O script conta chamadas por função, erros por código e frequência por produto retornado na consulta. Um candidato conta como consultado mesmo quando fica fora da resposta final.

## O que o log da demonstração mostra

**(a)** Com o catálogo original e só essas três chamadas, houve duas buscas por ID e duas listagens de candidatos. Os 11 produtos disponíveis empataram com duas consultas cada, e `p1` foi o único usado como referência.
**(b)** O produto `p10` nunca foi retornado nessas consultas, o que é compatível com o estoque zero e com a ausência de uma busca por ele.
**(c)** Houve um erro `produto_nao_encontrado` porque `p999` não existe no catálogo.

## Declaração de uso de IA generativa

O OpenAI Codex auxiliou na implementação das funções de acesso, do log e do resumo, na atualização deste README e na verificação da demonstração. O serviço gera recomendações por regras de estoque, similaridade e popularidade.

## Contrato do serviço (entrada e saída)

`GET /api/recomendacoes`, com os parâmetros na query string:

| Campo | Obrigatório | Descrição |
|---|---|---|
| `produto_id` | Sim, se não houver `tecnica` nem `regiao` | Produto que o comprador está vendo (ex.: `p1`). Se vier junto com os filtros, ele tem prioridade |
| `tecnica` | Não | Filtro explícito de técnica, sem diferenciar maiúsculas e acentos (ex.: `Palha`) |
| `regiao` | Não | Filtro explícito de região, basta um trecho do nome (ex.: `Pilar`) |
| `limite` | Não | Quantidade de itens, de 1 a 20. Padrão: 5 |

Resposta 200: `produto_referencia_id`, `filtro_aplicado`, `estrategia_aplicada` (`tecnica_regiao_popularidade` ou `cold_start`) e a lista `recomendacoes`, em que cada item tem `produto_id`, `nome`, `tecnica`, `preco` e `criterio` (`mesma_tecnica`, `mesma_regiao`, `popularidade` ou `diversificacao`).

Erros: 400 (`parametros_insuficientes` ou `limite_invalido`), 404 (`produto_nao_encontrado`) e 500 (`erro_interno`), sempre com o corpo `{"erro": "...", "mensagem": "..."}`.

O BentoML também expõe a mesma recomendação como `POST /recomendar`, com os campos acima em um corpo JSON. Ela aparece no Swagger da raiz (http://127.0.0.1:3001/), mas os testes abaixo usam o `GET`.

## Tabela RF da AV1 para endpoint ou ferramenta

| RF (AV1) | O que o mockup faz | Onde | Teste |
|---|---|---|---|
| RF-01 | Recomenda produtos da mesma técnica, a partir de um produto ou do filtro `tecnica` | `GET /api/recomendacoes` | 1 e 2 |
| RF-02 | Recomenda produtos da mesma região, a partir de um produto ou do filtro `regiao` | `GET /api/recomendacoes` | 1 e 2 |
| RF-03 | Ordena os candidatos por popularidade (unidades vendidas + nota média) | `GET /api/recomendacoes` | 1, 2 e 3 |
| RF-04 | Expõe o endpoint em JSON; produto inexistente responde 404 | `GET /api/recomendacoes` | 1, 4 e 5 |
| RF-05 | Cold start: quando técnica e região não preenchem a lista, completa com os mais populares da base | `GET /api/recomendacoes` (`estrategia_aplicada: cold_start`) | 3 |
| RF-06 | Diversificação: 30% da lista (arredondado para cima) vai para os produtos menos populares | `GET /api/recomendacoes` (`criterio: diversificacao`) | 1, 2 e 3 |
| RF-07 | Calcula e registra as métricas do baseline | `python ia/avaliar_baseline.py` | 6 |
| RF-08 | Peças relacionadas no perfil do artesão: o mesmo endpoint, com o `produto_id` de uma peça do artesão (não há rota dedicada) | `GET /api/recomendacoes` | 1 |

Outros requisitos da AV1 que o mockup atende: RNF-01 (a resposta sai em poucos milissegundos, e o tempo de cada chamada vai para o log), RNF-02 (catálogo sintético), RNF-03 (código versionado neste repositório, com estas instruções), RNF-04 (campo `criterio` em cada item) e RNF-06 (uma técnica ou região nova entra como linha nova em `ia/dados/catalogo_sintetico.json`, sem mexer no código). Regra adicional, que a AV1 não numera: só produtos com estoque são recomendados (o `p10` está sem estoque de propósito).

## Testes para copiar e colar

Com o serviço no ar, abra outro terminal. No PowerShell, use `curl.exe` no lugar de `curl` (ou cole a URL no navegador, já que é um `GET`). Os resultados abaixo são a saída exata do serviço. O catálogo tem 12 produtos (ver a seção seguinte); `p1` é o Vaso de Cerâmica Maragogi e `p3` é a Escultura em Madeira, a única peça dessa técnica.

### Teste 1: recomendação a partir de um produto (RF-01, 02, 03, 04, 06, 08)

```bash
curl "http://127.0.0.1:3001/api/recomendacoes?produto_id=p1&limite=3"
```

Resultado esperado (HTTP 200): duas peças de cerâmica, mais populares primeiro (`p8` é do mesmo artesão de `p1`), e uma vaga de diversificação com o produto menos popular da base.

```json
{
  "produto_referencia_id": "p1",
  "filtro_aplicado": null,
  "estrategia_aplicada": "tecnica_regiao_popularidade",
  "recomendacoes": [
    {
      "produto_id": "p8",
      "nome": "Boneca de Barro Figurativa",
      "tecnica": "Cerâmica",
      "preco": 140.0,
      "criterio": "mesma_tecnica"
    },
    {
      "produto_id": "p6",
      "nome": "Jarro de Cerâmica Fosco",
      "tecnica": "Cerâmica",
      "preco": 210.0,
      "criterio": "mesma_tecnica"
    },
    {
      "produto_id": "p4",
      "nome": "Renda de Bilro Flor do Agreste",
      "tecnica": "Renda e Bordado",
      "preco": 95.0,
      "criterio": "diversificacao"
    }
  ]
}
```

### Teste 2: filtro explícito de técnica e região, sem produto de referência (RF-01, 02, 03)

```bash
curl "http://127.0.0.1:3001/api/recomendacoes?tecnica=Palha&regiao=Comunidade%20do%20Pilar&limite=3"
```

Resultado esperado (HTTP 200): `produto_referencia_id` vem nulo e `filtro_aplicado` ecoa o filtro. O `p5` entra pela técnica e o `p9` pela região. O `p10` (também de palha e do Pilar) não aparece porque está sem estoque.

```json
{
  "produto_referencia_id": null,
  "filtro_aplicado": {
    "tecnica": "Palha",
    "regiao": "Comunidade do Pilar"
  },
  "estrategia_aplicada": "tecnica_regiao_popularidade",
  "recomendacoes": [
    {
      "produto_id": "p5",
      "nome": "Cesto de Palha Trançada",
      "tecnica": "Palha",
      "preco": 68.0,
      "criterio": "mesma_tecnica"
    },
    {
      "produto_id": "p9",
      "nome": "Xilogravura Cordel Pernambucano",
      "tecnica": "Xilogravura",
      "preco": 120.0,
      "criterio": "mesma_regiao"
    },
    {
      "produto_id": "p4",
      "nome": "Renda de Bilro Flor do Agreste",
      "tecnica": "Renda e Bordado",
      "preco": 95.0,
      "criterio": "diversificacao"
    }
  ]
}
```

### Teste 3: cold start (RF-05)

```bash
curl "http://127.0.0.1:3001/api/recomendacoes?produto_id=p3&limite=3"
```

Resultado esperado (HTTP 200): não existe outra peça de madeira nem outro artesão de Garanhuns, então a lista é completada com os mais populares da base e `estrategia_aplicada` vira `cold_start`.

```json
{
  "produto_referencia_id": "p3",
  "filtro_aplicado": null,
  "estrategia_aplicada": "cold_start",
  "recomendacoes": [
    {
      "produto_id": "p1",
      "nome": "Vaso de Cerâmica Maragogi",
      "tecnica": "Cerâmica",
      "preco": 185.0,
      "criterio": "popularidade"
    },
    {
      "produto_id": "p5",
      "nome": "Cesto de Palha Trançada",
      "tecnica": "Palha",
      "preco": 68.0,
      "criterio": "popularidade"
    },
    {
      "produto_id": "p4",
      "nome": "Renda de Bilro Flor do Agreste",
      "tecnica": "Renda e Bordado",
      "preco": 95.0,
      "criterio": "diversificacao"
    }
  ]
}
```

### Teste 4: produto que não existe (RF-04, erro 404)

```bash
curl -i "http://127.0.0.1:3001/api/recomendacoes?produto_id=p999"
```

Resultado esperado: a primeira linha da resposta é `HTTP/1.1 404 Not Found` e o corpo é:

```json
{
  "erro": "produto_nao_encontrado",
  "mensagem": "Nenhum produto com o id informado foi encontrado no catálogo."
}
```

### Teste 5: requisição sem parâmetros (erro 400)

```bash
curl -i "http://127.0.0.1:3001/api/recomendacoes"
```

Resultado esperado: a primeira linha da resposta é `HTTP/1.1 400 Bad Request` e o corpo é:

```json
{
  "erro": "parametros_insuficientes",
  "mensagem": "Informe produto_id, ou ao menos um dos campos tecnica/regiao."
}
```

### Teste 6: métricas do baseline (RF-07)

Este não precisa do serviço no ar. Rode na raiz do repositório, com o ambiente virtual ativo:

```bash
python ia/avaliar_baseline.py
```

Resultado esperado: o script simula uma recomendação para cada um dos 12 produtos, imprime as três métricas do `design.md` da AV1 e grava o mesmo conteúdo em `ia/resultados/metricas_baseline.json`.

```text
Métricas do baseline (lote simulado sobre o catálogo sintético)
  chamadas simuladas           12
  itens recomendados           60
  taxa de cold start           66.7%
  cobertura do catálogo        90.9%
  diversificação efetiva       40.0%
Registrado em resultados/metricas_baseline.json
```

## Catálogo sintético e regras do baseline

O catálogo está em `ia/dados/catalogo_sintetico.json`, com a estrutura das tabelas do Modelo Lógico usadas pelo módulo: 12 produtos, 7 artesãos, 20 linhas de `item_pedido` e 18 avaliações. Os produtos `p1` a `p7` e os artesãos `a1` a `a6` espelham a carga de demonstração do app (`db/05_dados_raizes_pe.sql`); `p8` a `p12` foram criados para o mockup, porque o app tem só 7 produtos. Vendas e avaliações são inventadas.

Regras do motor (`ia/motor_recomendacao.py`):

1. O pool de candidatos reúne os produtos com estoque que têm a mesma técnica ou a mesma região do alvo (o produto de referência ou o filtro).
2. A popularidade de um produto é a soma das unidades vendidas com a nota média. O pool é ordenado por ela, e o empate vai para o cadastro mais recente.
3. Se o pool não preenche as vagas de popularidade, o restante vem dos produtos mais populares da base inteira (cold start).
4. A diversificação reserva 30% da lista, arredondado para cima (limite 3 usa 1 vaga, limite 5 usa 2), para os produtos menos populares que ainda não entraram na lista.

Limites do mockup: o serviço é somente leitura, lê o JSON na subida e não usa banco de dados nem autenticação. Filtragem colaborativa, classificação de produtos e análise de sentimento ficam para a Unidade 2.

## Estrutura da pasta `ia/`

```text
ia/
├── README.md                     # Este arquivo
├── servico.py                    # Serviço BentoML (GET /api/recomendacoes e POST /recomendar)
├── motor_recomendacao.py         # Lógica do baseline, sem HTTP
├── avaliar_baseline.py           # Métricas do baseline (RF-07)
├── dados/
│   └── catalogo_sintetico.json   # Catálogo sintético (12 produtos)
├── resultados/
│   └── metricas_baseline.json    # Saída do avaliar_baseline.py
└── requirements.txt              # Dependências Python
```
