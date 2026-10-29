# Módulo de IA: mockup executável do serviço de recomendação (AV2)

Este é o módulo de recomendação especificado na AV1, em forma de mockup executável (Trilha A, serviço em BentoML). Ele mostra o caminho feliz: alguém instala, sobe o serviço e vê a entrada virar saída conforme o contrato da AV1. Trabalha só com dados sintéticos (RNF-02) e roda separado do app Next.js, como serviço próprio (RNF-05).

O app Next.js tem o seu próprio baseline em TypeScript ([`lib/motorRecomendacao.ts`](../lib/motorRecomendacao.ts), descrito em [`docs/BASELINE_IA.md`](../docs/BASELINE_IA.md)), que recomenda por histórico do comprador e responde em `GET /api/recomendacoes` na porta 3000. Este serviço é o módulo da AV1, que recomenda a partir de um produto de referência ou de um filtro de técnica e região, e responde no mesmo caminho, mas na porta 3001.

## Instalação

Pré-requisitos: Python 3.10 ou superior (testado com 3.11 e 3.13), `pip` e `curl`. Os comandos partem da raiz do repositório.

```bash
git clone https://github.com/brunosm26/Raizes-PE.git
cd Raizes-PE
python -m venv .venv
source .venv/bin/activate        # no Windows: .venv\Scripts\activate
pip install -r ia/requirements.txt
```

## Como subir

```bash
cd ia
bentoml serve servico:Recomendador --port 3001
```

Espere a linha `Service Recomendador initialized`. Deixe esse terminal aberto e rode os testes em outro. A porta é a 3001 para não colidir com o `npm run dev`, que usa a 3000.

Documentação interativa (Swagger) do contrato `GET`: http://127.0.0.1:3001/api/docs

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

O catálogo está em `ia/dados/catalogo_sintetico.json`, com a estrutura das tabelas do Modelo Lógico usadas pelo módulo: 12 produtos, 7 artesãos, 20 linhas de `item_pedido` e 18 avaliações. Os produtos `p1` a `p7` vêm do app (`lib/dadosFalsos.ts`); `p8` a `p12` foram criados para o mockup, porque o app tem só 7 produtos. Vendas e avaliações são inventadas.

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
