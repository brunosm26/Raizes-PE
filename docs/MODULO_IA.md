# Módulo de IA: documento final (recomendação)

Documento final do módulo de IA do Raízes PE (PI4-155). Descreve o que existe hoje no repositório: objetivo, dados, regras dos dois motores de recomendação, métricas do baseline e como o módulo se integra à aplicação. O ponto de partida foram [`BASELINE_IA.md`](BASELINE_IA.md) (entrega da Unidade 1) e [`ia/README.md`](../ia/README.md) (mockup executável da AV2). Onde os dois divergem do código atual, vale este documento.

## 1. Objetivo

Ajudar o comprador a descobrir peças de artesanato de Pernambuco alinhadas ao que ele já aprecia ou ao que a comunidade mais valoriza, de forma **explicável** (cada item traz o motivo) e **reproduzível** (regras determinísticas, sem modelo treinado). O módulo é uma linha de base (*baseline*): serve de referência para evoluções futuras, como filtragem colaborativa.

## 2. Visão geral: dois componentes

| | Motor do app | Serviço BentoML (mockup da AV2) |
|---|---|---|
| **Onde está** | `backend/src/services/rankingRecomendacao.ts` e `recomendacaoService.ts` (Express). Há uma cópia da regra em `lib/rankingRecomendacao.ts`, usada pelas rotas antigas do Next | `ia/` (`servico.py`, `motor_recomendacao.py`, `avaliar_baseline.py`) |
| **Linguagem** | TypeScript | Python (BentoML) |
| **Dados** | PostgreSQL no Neon, pelos repositories | catálogo sintético em `ia/dados/catalogo_sintetico.json` |
| **Entrada** | o comprador logado (pela sessão) e `limite` | um produto de referência (`produto_id`) ou um filtro de `tecnica` e/ou `regiao`, e `limite` |
| **Estratégia** | histórico de compras do comprador, com *cold start* | técnica e região do produto, popularidade, *cold start* e diversificação |
| **Quem chama** | o front, na vitrine | ninguém no app hoje: roda à parte, na porta 3001 |
| **Publicado** | sim, junto da API no Render | não |

Os dois motores seguem as mesmas ideias (só produtos com estoque, ordenação por popularidade e qualidade, *cold start*, motivo ou critério em cada item), mas **as regras não são idênticas**. As seções 4 e 5 descrevem cada uma.

## 3. Dados

### Motor do app (banco real)

Lê do esquema `origem` do Neon, pelos repositories do backend:

- **Produtos** com os dados do artesão (nome, região de origem), com o estoque atual.
- **Avaliações**: média e quantidade por produto (`avaliacaoRepository.resumirPorProduto`).
- **Compras do comprador**: quantidade por produto, somando os itens dos pedidos dele (`pedidoRepository.somarCompradosPorProduto`). Visitante e perfis que não são comprador não têm histórico.

O modelo de dados está em [`dicionario-de-dados.md`](dicionario-de-dados.md).

### Serviço BentoML (catálogo sintético)

`ia/dados/catalogo_sintetico.json`: 7 artesãos, 12 produtos, 20 itens de pedido e 18 avaliações, em 6 técnicas (Cerâmica, Madeira, Palha, Renda e Bordado, Têxtil, Xilogravura) e 5 regiões. O produto `p10` está **sem estoque de propósito**, para testar o filtro, então 11 produtos são elegíveis. A popularidade de um produto é `unidades vendidas + nota média`.

## 4. Regras do motor do app

Entrada: produtos, resumo de avaliações e compras do comprador. Saída: até `limite` itens (padrão 4), do maior para o menor *score*, cada um com `motivo`, `score` e `criterio`.

1. **Estoque.** Só entram produtos com `estoqueQtd > 0`.
2. **Pontuação base.** `nota média × 10 + quantidade de avaliações × 2`. Produto sem avaliação usa nota 4,0 e quantidade 0.
3. **Novidade.** +5 se o produto foi cadastrado menos de 30 dias antes da data de referência fixa `2025-06-30` (dados de exemplo).
4. **Comprador com histórico.** Aplica no máximo um destes bônus por produto, nesta ordem de prioridade:
   - **técnica** já comprada: `+40 + 10 × unidades compradas dessa técnica`, critério `historico_tecnica`, motivo "Inspirado no seu apreço por {técnica}";
   - senão, **região** já comprada: `+25`, critério `historico_regiao`, motivo "Tradição de {região}, de onde você já comprou";
   - senão, **nota alta** (média ≥ 4,5 e ao menos uma avaliação): `+15`, critério `popularidade`, motivo "Alta recomendação da comunidade ({nota} ★)".

   Se o comprador **já comprou aquele produto**, o *score* cai 50, para favorecer novas descobertas.
5. ***Cold start*** (visitante, ou comprador sem compras): média ≥ 4,5 com ao menos uma avaliação ganha `+20` (critério `popularidade`, motivo "Mais bem avaliados ({nota} ★)"); os demais ficam com critério `novidade` e motivo "Peça artesanal autêntica de {região}".
6. **Ordenação** por *score* decrescente e corte em `limite`.

Critérios possíveis: `historico_tecnica`, `historico_regiao`, `popularidade` e `novidade`. Compras de produtos que não estão no catálogo não contam como histórico.

## 5. Regras do serviço BentoML

Entrada: `produto_id`, ou `tecnica` e/ou `regiao`, mais `limite` (1 a 20, padrão 5). Com `produto_id`, ele manda e os filtros são ignorados.

1. **Pool de candidatos:** produtos com estoque da mesma técnica ou da mesma região do alvo (o produto de referência não é recomendado a si mesmo).
2. **Ordenação** do pool por popularidade (vendas + nota média). Empate: cadastro mais recente, depois o id.
3. ***Cold start*:** se o pool não preenche as vagas, completa com os mais populares da base geral (`estrategia_aplicada: cold_start`).
4. **Diversificação:** 30% da lista (arredondado para cima) fica reservada para os produtos menos populares que ainda não entraram, com critério `diversificacao`.
5. **Saída:** `produto_referencia_id`, `filtro_aplicado`, `estrategia_aplicada` (`tecnica_regiao_popularidade` ou `cold_start`) e a lista `recomendacoes`, cada item com `produto_id`, `nome`, `tecnica`, `preco` e `criterio` (`mesma_tecnica`, `mesma_regiao`, `popularidade` ou `diversificacao`).
6. **Erros:** 400 (`parametros_insuficientes` ou `limite_invalido`), 404 (`produto_nao_encontrado`) e 500 (`erro_interno`), sempre como `{"erro": "...", "mensagem": "..."}`.

A tabela RF-01 a RF-08 da AV1 e os casos de teste para copiar e colar estão em [`ia/README.md`](../ia/README.md).

## 6. Métricas do baseline

`python ia/avaliar_baseline.py` (a partir da raiz, com o ambiente do `ia/requirements.txt`) simula **uma recomendação para cada produto do catálogo sintético**, com o limite padrão, e grava o resultado em `ia/resultados/metricas_baseline.json`. Não há tráfego real no mockup, então o lote é simulado.

| Métrica | Valor | Como é calculada |
|---|---|---|
| Chamadas simuladas | 12 | uma por produto do catálogo |
| Itens recomendados | 60 | 12 chamadas × 5 itens |
| Taxa de *cold start* | 66,7% | 8 das 12 chamadas completaram a lista com os mais populares da base |
| Cobertura do catálogo | 90,9% | produtos elegíveis que aparecem em alguma recomendação (10 de 11) |
| Diversificação efetiva | 40,0% | itens de critério `diversificacao` sobre o total (2 por chamada, 24 de 60) |

São métricas de **cobertura e comportamento do baseline**, não de acerto: não existe uma base de verdade (cliques ou compras posteriores) para medir *precision* ou *recall*.

## 7. Como se integra à aplicação

```text
Vitrine (components/SecaoRecomendados.tsx)
   → GET /api/recomendacoes?limite=4        (pelo domínio da Vercel)
   → rewrite do Next para a API Express     (Render)
   → recomendacaoController → recomendacaoService → repositories → Neon
   → rankingRecomendacao (regra pura, sem banco)
```

- O **comprador vem da sessão** (cookie `raizes_sessao`), nunca da URL. Comprador logado recebe recomendações pelo histórico; visitante e outros perfis recebem o *cold start*.
- Resposta 200: `{ "sucesso": true, "origem": "baseline_ia_v1", "compradorId": <id ou null>, "total": n, "dados": [...] }`. Cada item de `dados` traz os campos do produto com o artesão (`id`, `nome`, `descricao`, `tecnica`, `categoria`, `preco`, `estoqueQtd`, `dataCadastro`, `artesaoNome`, `artesaoRegiao`, `imagemUrl`, entre outros) mais `motivo`, `score` e `criterio`.
- O front mostra o `motivo` em cada card (💡) e permite adicionar ao carrinho.
- A regra de pontuação (`rankingRecomendacao`) não depende do banco: quem monta a entrada é o service, e é por isso que ela é testada sem Neon.
- O **serviço BentoML é independente**: sobe na porta 3001 para não colidir com o Next (3000) e não é chamado pelo app. Ele demonstra o módulo especificado na AV1 com dados sintéticos.

## 8. Testes

- **Regra do app, no backend:** `backend/test/rankingRecomendacao.test.ts` (estoque, limite, *cold start*, histórico por técnica, região e comunidade, penalidade de repetição, compra fora do catálogo, explicabilidade, entrada não alterada). Roda com `npm test` em `backend/`.
- **Regra do app, no front:** `tests/recomendacao.test.mjs`, com os cenários da baseline (estoque, limite, personalização por técnica, repetição, *cold start*, explicabilidade). Roda com `npm test` na raiz.
- **Serviço BentoML:** os 6 casos de [`ia/README.md`](../ia/README.md), com o comando exato e o resultado esperado.

## 9. Limitações conhecidas

- **Dois motores com regras diferentes.** O serviço Python não usa o banco e não é chamado pelo app. Unificar (ou ligar o app ao serviço) é uma evolução, não algo que existe hoje.
- **Data de referência fixa.** O bônus de novidade compara com `2025-06-30`, não com a data atual. Com dados novos, o bônus quase nunca dispara.
- **Sem avaliação de acerto.** As métricas medem cobertura e comportamento sobre um lote simulado.
- **Histórico simples.** Só conta compras (técnica e região). Não usa visualizações, carrinho nem preço.
- **Região como texto.** A afinidade de região compara o texto da região do artesão (por exemplo "Alto do Moura, Caruaru"), não uma mesorregião.
- **Popularidade no banco.** Existe a view `origem.vw_popularidade_produto` e o `popularidadeRepository`, mas o ranking do app calcula a nota pelo resumo de avaliações e ainda não usa a view.

## 10. Rastreabilidade

- [`BASELINE_IA.md`](BASELINE_IA.md): documento da Unidade 1 (PI4-26), com a formulação original da baseline.
- [`ia/README.md`](../ia/README.md): mockup BentoML da AV2, tabela RF e casos de teste.
- [`CONTRATO_API.md`](CONTRATO_API.md): contrato das rotas.
- Jira: PI4-155 (este documento), PI4-156 (resultados dos casos de teste) e PI4-157 (integração com os dados do Neon e limitações).
