# Análise Crítica de Code Smell e Refatoração — Projeto Origem

**Disciplina:** Requisitos, Projeto de Software e Validação  
**Projeto Integrador:** Origem — Marketplace de Artesanato Pernambucano  
**Responsável:** Pedrohcs13  
**Code Smell identificado:** Magic Numbers  
**Técnica aplicada:** Replace Magic Number with Symbolic Constant  
**Decisão:** Realizar refatoração

## 1. Identificação do Code Smell

Durante a revisão crítica do código do Projeto Integrador Origem, foi analisado o arquivo `lib/rankingRecomendacao.ts`, responsável pelo cálculo da pontuação e pela ordenação dos produtos recomendados aos compradores.

Foi identificado o Code Smell conhecido como **Magic Numbers**, caracterizado pela utilização direta de valores numéricos no código, sem constantes nomeadas que expliquem seu significado.

Na implementação original, o algoritmo utilizava valores como `10`, `2`, `40`, `25` e `50` em diferentes regras de pontuação.

Esses números representam pesos de avaliação, afinidade com técnicas artesanais, preferência regional e penalidades relacionadas ao histórico de compras.

Embora a implementação estivesse funcional, a ausência de nomes descritivos para esses valores poderia dificultar sua compreensão e futuras manutenções.

## 2. Localização e impactos potenciais

**Arquivo analisado:** `lib/rankingRecomendacao.ts`  
**Função:** `rankearRecomendacoes()`  
**Área afetada:** Cálculo da pontuação dos produtos recomendados.

Os principais impactos identificados foram:

- **Legibilidade:** os valores numéricos não explicavam diretamente sua finalidade.
- **Manutenibilidade:** alterações futuras nos pesos exigiriam localizar e interpretar os números utilizados nas operações.
- **Extensibilidade:** novas regras de recomendação poderiam se tornar mais difíceis de implementar e compreender.
- **Risco de inconsistências:** valores com significados semelhantes poderiam ser alterados em alguns pontos e esquecidos em outros.

A principal preocupação não era uma falha funcional, mas a possibilidade de dificuldades durante a evolução do algoritmo.

## 3. Análise crítica e decisão

Após avaliar a implementação existente, foi tomada a decisão de realizar uma refatoração pontual.

A alternativa de manter o código original foi considerada, pois o algoritmo já apresentava funcionamento adequado e possuía testes automatizados.

Entretanto, como os valores numéricos representam critérios importantes das regras de negócio, concluiu-se que a utilização de constantes nomeadas tornaria o código mais compreensível e facilitaria futuras alterações.

A refatoração foi considerada adequada por apresentar baixo grau de complexidade, alcance limitado e possibilidade de preservar o comportamento existente.

Não foi necessário desenvolver novas funcionalidades nem alterar a estrutura geral do algoritmo.

## 4. Técnica de refatoração aplicada

A técnica utilizada foi **Replace Magic Number with Symbolic Constant**, que consiste em substituir valores numéricos diretamente inseridos na lógica por constantes com nomes descritivos.

### Exemplo antes da refatoração

`let score = mediaAvaliacao * 10 + qtdAvaliacoes * 2;`

`score += 40 + afinidadeTecnica * 10;`

`score -= 50;`

### Exemplo depois da refatoração

`let score = mediaAvaliacao * PESO_MEDIA_AVALIACAO + qtdAvaliacoes * PESO_QUANTIDADE_AVALIACOES;`

`score += BONUS_TECNICA + afinidadeTecnica * PESO_AFINIDADE_TECNICA;`

`score -= PENALIDADE_COMPRA;`

Foram criadas 12 constantes para representar pesos, bônus, penalidades e limites relacionados à pontuação das recomendações.

Os valores originais foram mantidos. A refatoração concentrou-se na forma de representar esses critérios, sem alterar intencionalmente o comportamento das recomendações.

## 5. Validação e testes

Após a refatoração, foram executados os testes automatizados existentes para o sistema de recomendações.

**Comando utilizado:**

`npm test -- tests/recomendacao.test.mjs`

**Resultados obtidos:**

| Indicador | Resultado |
|---|---|
| Testes executados | 6 |
| Testes aprovados | 6 |
| Testes com falha | 0 |
| Testes ignorados | 0 |

Os testes verificaram comportamentos relacionados à disponibilidade de estoque, limite de recomendações, personalização por técnica, penalidade por compras anteriores, Cold Start e explicabilidade.

Todos os seis testes foram aprovados após a alteração.

Esses resultados fornecem evidências de que os comportamentos cobertos pelos testes foram preservados. Entretanto, não representam uma garantia absoluta de equivalência para todos os cenários possíveis.

## 6. Benefícios, riscos e limitações

### Benefícios esperados

A refatoração proporciona maior clareza na identificação dos critérios de pontuação e facilita a manutenção do algoritmo.

Outro benefício é a possibilidade de modificar um peso de maneira mais controlada, sem precisar procurar números diretamente nas operações matemáticas.

### Riscos e limitações

O principal risco seria associar uma constante ao valor incorreto ou modificar acidentalmente uma operação durante a substituição.

Para reduzir esse risco, os valores originais foram preservados e os testes automatizados existentes foram executados.

A refatoração não altera a estratégia de recomendação, não modifica os pesos utilizados e não pretende melhorar diretamente a precisão ou o desempenho do algoritmo.

Outros aspectos da implementação, como o tratamento de datas e a organização de responsabilidades, permaneceram fora do escopo da intervenção.

## 7. Registro da intervenção

**Repositório:** https://github.com/brunosm26/Raizes-PE

**Branch individual:** `refactor/pedro-magic-numbers`

**Arquivo refatorado:** `lib/rankingRecomendacao.ts`

**Commit da refatoração:** `c4dff734b97a268f8e5c3ebdf6c4f7c857a2e5a4`

**Mensagem do commit:**

`refactor: substitui magic numbers por constantes no ranking`

**Link do commit:**

https://github.com/brunosm26/Raizes-PE/commit/c4dff734b97a268f8e5c3ebdf6c4f7c857a2e5a4

A refatoração foi registrada em uma branch individual, preservando a implementação da branch principal até eventual revisão e integração pela equipe.

## 8. Conclusão

A revisão crítica permitiu identificar uma oportunidade de melhoria na qualidade do código do sistema de recomendações do Projeto Origem.

A substituição de Magic Numbers por constantes nomeadas foi considerada tecnicamente adequada, principalmente pelos benefícios relacionados à legibilidade e à manutenibilidade.

A alteração foi limitada ao código de pontuação, mantendo as regras originais. A aprovação dos seis testes automatizados existentes fornece evidências favoráveis à preservação do comportamento esperado nos cenários cobertos.

Dessa forma, a intervenção atende ao objetivo de identificar um problema potencial de projeto, avaliar alternativas e aplicar uma refatoração fundamentada, evitando mudanças desnecessárias no funcionamento do sistema.