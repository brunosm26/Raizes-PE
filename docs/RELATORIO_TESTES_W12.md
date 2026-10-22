# Relatório de Execução de Testes e Matriz de Rastreabilidade — Semana 12 (W12)

- **Projeto:** Origem / Raízes de Pernambuco (`Raizes-PE`)
- **Disciplina:** Requisitos, Projeto de Software e Validação (`REQ`) — Unidade 02
- **História Jira:** [`PI4-31` — W12-Testes executados (REQ)](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-31)
- **Subtarefas Vinculadas:**
  - [`PI4-136`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-136) — Expandir testes unitários de máscaras, formatação e validação de inputs (REQ)
  - [`PI4-137`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-137) — Implementar testes automatizados de catálogo, busca, avaliações e painel do artesão (REQ)
  - [`PI4-138`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-138) — Executar bateria de testes de recomendação (IA), linter e checagem de tipos TypeScript (REQ)
  - [`PI4-139`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-139) — Elaborar Relatório de Execução de Testes e Matriz de Rastreabilidade da W12 (REQ)
- **Responsável pela Execução:** Caio Gilles (`cgcms@cesar.school`)
- **Data da Execução:** 22/10/2026
- **Branch de Execução:** `feat/PI4-31-testes-executados-req`

---

## 1. Sumário Executivo da Execução

Na Semana 12 (Unidade 02), foi executada a bateria de validação automatizada e análise estática da plataforma **Raízes de Pernambuco (Origem)**, exercitando os requisitos funcionais e critérios de aceite definidos nas Histórias de Usuário da Unidade 01 ([`PI4-12`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-12), [`PI4-76`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-76), [`PI4-77`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-77) e [`PI4-24`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-24)) e do motor de recomendação ([`PI4-15`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-15)).

| Categoria de Verificação | Comando Executado | Escopo Avaliado | Total | Passaram | Falharam | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Testes de Catálogo, Busca e Painel** | `npm test` (`node --test`) | `tests/catalogo.test.mjs` (`lib/catalogo.ts`, `lib/arteProduto.ts`) | 9 | 9 | 0 | **APROVADO** |
| **Testes Unitários de Máscaras e Inputs** | `npm test` (`node --test`) | `tests/mascaras.test.mjs` (`lib/mascaras.ts`) | 9 | 9 | 0 | **APROVADO** |
| **Testes do Motor de Recomendação (IA)** | `npm test` (`node --test`) | `tests/recomendacao.test.mjs` (`lib/recomendacao.ts`) | 6 | 6 | 0 | **APROVADO** |
| **Análise Estática (ESLint)** | `npm run lint` | Código-fonte Next.js / React / TypeScript | — | 0 erros | 0 | **APROVADO** |
| **Checagem de Tipos (TypeScript)** | `npx tsc --noEmit` | Tipagem estática de `app/`, `components/`, `lib/` | — | `exit 0` | 0 | **APROVADO** |
| **TOTAL DE CASOS AUTOMATIZADOS** | `npm test` | **3 suítes (`catalogo`, `mascaras`, `recomendacao`)** | **24** | **24 (100%)** | **0** | **APROVADO** |

---

## 2. Matriz de Rastreabilidade (Requisitos × Critérios de Aceite × Casos de Teste)

A tabela abaixo relaciona as Histórias de Usuário e Critérios de Aceite (`Dado / Quando / Então`) especificados em [`PI4-12`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-12) / [`PI4-77`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-77) / [`PI4-24`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-24) com os 24 casos de teste automatizados executados na W12:

| ID Caso | Suíte / Arquivo | Nome do Teste Executado (`TAP`) | Critério de Aceite Exercitado (`Dado / Quando / Então`) | Módulo Testado | Resultado |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **CT-01** | `tests/catalogo.test.mjs` | `Lista todos os produtos da vitrine enriquecidos com nome e região do artesão` | **Dado** que o comprador acessa o catálogo sem filtros, **Quando** a listagem é carregada, **Então** todas as 16 peças são retornadas enriquecidas com nome, cidade e região do artesão. | `lib/catalogo.ts` (`getProdutos`) | **PASS** |
| **CT-02** | `tests/catalogo.test.mjs` | `Filtra produtos corretamente por técnica artesanal, região e categoria` | **Dado** que o comprador seleciona filtros de técnica (`Cerâmica`), região (`Agreste`) e/ou categoria (`Escultura`), **Quando** a consulta é executada, **Então** apenas peças que atendem simultaneamente aos critérios selecionados são listadas. | `lib/catalogo.ts` (`getProdutos`) | **PASS** |
| **CT-03** | `tests/catalogo.test.mjs` | `Realiza busca textual insensível a acentos e maiúsculas/minúsculas` | **Dado** que o comprador pesquisa por nome da peça, artesão ou cidade sem acentos ou em caixa variável (`"leao"`, `"caruaru"`, `"xilogravura"`, `"J. Borges"`), **Quando** a busca é processada, **Então** a normalização NFD retorna os itens correspondentes e retorna lista vazia para termos inexistentes. | `lib/catalogo.ts` (`getProdutos`) | **PASS** |
| **CT-04** | `tests/catalogo.test.mjs` | `Consulta produto por ID existente e retorna undefined para ID inexistente` | **Dado** que o comprador seleciona uma peça existente (`p1`), **Quando** a página de detalhes é consultada, **Então** os dados completos da peça e do mestre artesão (`Mestre Severino Vitalino`) são retornados; para ID inexistente, retorna `undefined`. | `lib/catalogo.ts` (`getProdutoPorId`) | **PASS** |
| **CT-05** | `tests/catalogo.test.mjs` | `Retorna produtos relacionados da mesma técnica excluindo o próprio produto` | **Dado** que o comprador visualiza uma peça (`p1`), **Quando** as peças relacionadas são consultadas, **Então** o sistema retorna peças da mesma técnica (`Cerâmica`) excluindo a própria peça (`id !== p1`). | `lib/catalogo.ts` (`getProdutosRelacionados`) | **PASS** |
| **CT-06** | `tests/catalogo.test.mjs` | `Calcula média e quantidade de avaliações por produto com exatidão` | **Dado** um produto com avaliações cadastradas (`p1`), **Quando** o resumo de avaliações é calculado, **Então** retorna a quantidade exata (`2`), a média (`5`) e `quantidade === 0, media === 0` para produtos sem avaliações. | `lib/catalogo.ts` (`getResumoAvaliacoes`) | **PASS** |
| **CT-07** | `tests/catalogo.test.mjs` | `Recupera perfil público do artesão com seus produtos vinculados` | **Dado** que o comprador acessa o perfil de um artesão (`u1`), **Quando** os dados e portfólio são carregados, **Então** o sistema retorna a biografia, cidade/região, WhatsApp e todas as peças pertencentes àquele artesão (`artesaoId === u1`). | `lib/catalogo.ts` (`getPerfilArtesao`) | **PASS** |
| **CT-08** | `tests/catalogo.test.mjs` | `Calcula produtos e estatísticas financeiras do painel do artesão` | **Dado** que o artesão acessa seu painel administrativo (`u1`), **Quando** as estatísticas são consolidadas, **Então** o sistema agrega corretamente total de produtos, estoque total, valor em estoque e peças com baixo estoque. | `lib/catalogo.ts` (`getProdutosDoArtesao`, `getEstatisticasPainel`) | **PASS** |
| **CT-09** | `tests/catalogo.test.mjs` | `Expõe domínios válidos de filtros e aplica fallback visual por técnica` | **Dado** os domínios de filtros e um card de peça artesanal com ou sem foto, **Quando** `estiloFundoProduto` é resolvido, **Então** o sistema aplica a paleta cultural da técnica correspondente ou imagem de fundo quando `fotoUrl` está presente. | `lib/catalogo.ts`, `lib/arteProduto.ts` | **PASS** |
| **CT-10** | `tests/mascaras.test.mjs` | `cola preço em reais com milhar e sem centavos sem reduzir o valor` | **Dado** que o artesão cola ou digita um valor inteiro ou com separador de milhar (`"120"`, `"1.200"`, `"R$ 1.250"`), **Quando** `formatarPreco` e `completarPreco` são aplicados, **Então** os valores reais são preservados e completados com `,00`. | `lib/mascaras.ts` (`formatarPreco`, `completarPreco`) | **PASS** |
| **CT-11** | `tests/mascaras.test.mjs` | `mantém a colagem com milhar e centavos` | **Dado** que o artesão cola um valor monetário completo (`"R$ 1.250,50"` ou `"1250.5"`), **Quando** `formatarPreco` e `completarPreco` são executados, **Então** a parte inteira e os centavos são preservados (`"1.250,50"`). | `lib/mascaras.ts` (`formatarPreco`, `completarPreco`) | **PASS** |
| **CT-12** | `tests/mascaras.test.mjs` | `mantém o ponto digitado como separador decimal` | **Dado** que o artesão digita ponto como separador decimal (`"120."`, `"120.5"`), **Quando** `formatarPreco` é executado, **Então** converte o separador decimal para vírgula (`"120,"`, `"120,5"`). | `lib/mascaras.ts` (`formatarPreco`) | **PASS** |
| **CT-13** | `tests/mascaras.test.mjs` | `remove zeros à esquerda na parte inteira do preço preservando zero único` | **Dado** que o usuário digita zeros à esquerda (`"00045,90"`, `"0,50"`), **Quando** `formatarPreco` e `completarPreco` são aplicados, **Então** remove zeros excedentes mantendo zero único quando inferior a `1,00`. | `lib/mascaras.ts` (`formatarPreco`, `completarPreco`) | **PASS** |
| **CT-14** | `tests/mascaras.test.mjs` | `identifica corretamente caracteres significativos de preço` | **Dado** que o usuário pressiona teclas no input de preço, **Quando** `ehCaractereDePreco` valida o caractere, **Então** aceita apenas dígitos `0-9`, vírgula e ponto, rejeitando letras, espaços e símbolos (`R$`, `-`). | `lib/mascaras.ts` (`ehCaractereDePreco`) | **PASS** |
| **CT-15** | `tests/mascaras.test.mjs` | `extrai somente dígitos de entradas alfanuméricas e com símbolos` | **Dado** um texto contendo letras, pontuação e símbolos, **Quando** `somenteDigitos` é executado, **Então** apenas os algarismos `0-9` são preservados. | `lib/mascaras.ts` (`somenteDigitos`) | **PASS** |
| **CT-16** | `tests/mascaras.test.mjs` | `formata telefone fixo (10 dígitos) e celular (11 dígitos) com DDD` | **Dado** que o usuário digita um telefone de 10 ou 11 dígitos, **Quando** `formatarTelefone` é aplicado, **Então** formata progressivamente como `(81) 3222-3344` (fixo) ou `(81) 99876-5432` (celular). | `lib/mascaras.ts` (`formatarTelefone`) | **PASS** |
| **CT-17** | `tests/mascaras.test.mjs` | `remove prefixo internacional +55 ao colar telefone do WhatsApp e limita a 11 dígitos` | **Dado** que o usuário cola um número com código do Brasil (`+55 (81) 99876-5432`), **Quando** `formatarTelefone` processa a entrada, **Então** o prefixo internacional `+55` é removido e dígitos excedentes são truncados em 11 dígitos. | `lib/mascaras.ts` (`formatarTelefone`) | **PASS** |
| **CT-18** | `tests/mascaras.test.mjs` | `formata CEP com 8 dígitos, preserva digitação parcial e trunca excesso` | **Dado** que o comprador informa o CEP, **Quando** `formatarCep` é executado, **Então** aplica o hífen após o 5º dígito (`50030-230`), preserva digitação parcial e trunca em 8 dígitos. | `lib/mascaras.ts` (`formatarCep`) | **PASS** |
| **CT-19** | `tests/recomendacao.test.mjs` | `Garante que nenhum produto com estoque zerado é recomendado (PI4-82)` | **Dado** o catálogo contendo peças esgotadas (`estoque === 0`), **Quando** `obterRecomendacoes` é executado para compradores com ou sem histórico, **Então** nenhuma peça sem estoque é recomendada. | `lib/recomendacao.ts` (`obterRecomendacoes`) | **PASS** |
| **CT-20** | `tests/recomendacao.test.mjs` | `Respeita o limite máximo de recomendações solicitado` | **Dado** um parâmetro `limite` (`3` ou `6`), **Quando** `obterRecomendacoes` é chamado, **Então** a quantidade de peças retornadas é exatamente igual ao limite solicitado. | `lib/recomendacao.ts` (`obterRecomendacoes`) | **PASS** |
| **CT-21** | `tests/recomendacao.test.mjs` | `Personaliza recomendações por técnica para comprador com histórico (u7 - Ana Beatriz) (PI4-83)` | **Dado** um comprador com histórico em `Cerâmica` e `Xilogravura` (`u7`), **Quando** o motor calcula o ranking personalizado, **Então** o top 3 prioriza peças dessas técnicas e identifica o perfil correspondente. | `lib/recomendacao.ts` (`obterRecomendacoes`) | **PASS** |
| **CT-22** | `tests/recomendacao.test.mjs` | `Desprioriza produtos que o comprador já adquiriu para evitar repetição (PI4-83)` | **Dado** que a compradora `u7` já adquiriu os produtos `p1` e `p4`, **Quando** o top 4 de recomendações é gerado, **Então** `p1` e `p4` são penalizados e não ocupam o topo da vitrine. | `lib/recomendacao.ts` (`obterRecomendacoes`) | **PASS** |
| **CT-23** | `tests/recomendacao.test.mjs` | `Aplica estratégia de Cold Start para novos visitantes sem histórico (PI4-84)` | **Dado** um visitante anônimo ou usuário sem interações prévias, **Quando** `obterRecomendacoes` é chamado, **Então** aplica a estratégia de Cold Start baseada em popularidade e avaliação média. | `lib/recomendacao.ts` (`obterRecomendacoes`) | **PASS** |
| **CT-24** | `tests/recomendacao.test.mjs` | `Explicabilidade (XAI): Todos os itens possuem justificativa textual legível e dados do artesão` | **Dado** qualquer lista de recomendações gerada pelo motor, **Quando** os itens são inspecionados, **Então** todos possuem `motivoRecomendacao` textual legível, `score > 0`, `nomeArtesao` e `regiao`. | `lib/recomendacao.ts` (`obterRecomendacoes`) | **PASS** |

---

## 3. Evidência Real de Execução (`npm test`, `npm run lint`, `npx tsc --noEmit`)

### 3.1 Execução da Suíte de Testes Automatizados (`npm test`)

```text
> raizes-pe@0.1.0 test
> node --test tests/*.test.mjs

TAP version 13
# Subtest: Lista todos os produtos da vitrine enriquecidos com nome e região do artesão
ok 1 - Lista todos os produtos da vitrine enriquecidos com nome e região do artesão
  ---
  duration_ms: 264.997
  type: 'test'
  ...
# Subtest: Filtra produtos corretamente por técnica artesanal, região e categoria
ok 2 - Filtra produtos corretamente por técnica artesanal, região e categoria
  ---
  duration_ms: 526.0079
  type: 'test'
  ...
# Subtest: Realiza busca textual insensível a acentos e maiúsculas/minúsculas
ok 3 - Realiza busca textual insensível a acentos e maiúsculas/minúsculas
  ---
  duration_ms: 780.1178
  type: 'test'
  ...
# Subtest: Consulta produto por ID existente e retorna undefined para ID inexistente
ok 4 - Consulta produto por ID existente e retorna undefined para ID inexistente
  ---
  duration_ms: 514.9991
  type: 'test'
  ...
# Subtest: Retorna produtos relacionados da mesma técnica excluindo o próprio produto
ok 5 - Retorna produtos relacionados da mesma técnica excluindo o próprio produto
  ---
  duration_ms: 527.812
  type: 'test'
  ...
# Subtest: Calcula média e quantidade de avaliações por produto com exatidão
ok 6 - Calcula média e quantidade de avaliações por produto com exatidão
  ---
  duration_ms: 766.1849
  type: 'test'
  ...
# Subtest: Recupera perfil público do artesão com seus produtos vinculados
ok 7 - Recupera perfil público do artesão com seus produtos vinculados
  ---
  duration_ms: 526.9035
  type: 'test'
  ...
# Subtest: Calcula produtos e estatísticas financeiras do painel do artesão
ok 8 - Calcula produtos e estatísticas financeiras do painel do artesão
  ---
  duration_ms: 514.3767
  type: 'test'
  ...
# Subtest: Expõe domínios válidos de filtros e aplica fallback visual por técnica
ok 9 - Expõe domínios válidos de filtros e aplica fallback visual por técnica
  ---
  duration_ms: 0.4531
  type: 'test'
  ...
# Subtest: cola preço em reais com milhar e sem centavos sem reduzir o valor
ok 10 - cola preço em reais com milhar e sem centavos sem reduzir o valor
  ---
  duration_ms: 2.8506
  type: 'test'
  ...
# Subtest: mantém a colagem com milhar e centavos
ok 11 - mantém a colagem com milhar e centavos
  ---
  duration_ms: 0.3501
  type: 'test'
  ...
# Subtest: mantém o ponto digitado como separador decimal
ok 12 - mantém o ponto digitado como separador decimal
  ---
  duration_ms: 0.3386
  type: 'test'
  ...
# Subtest: remove zeros à esquerda na parte inteira do preço preservando zero único
ok 13 - remove zeros à esquerda na parte inteira do preço preservando zero único
  ---
  duration_ms: 0.4823
  type: 'test'
  ...
# Subtest: identifica corretamente caracteres significativos de preço
ok 14 - identifica corretamente caracteres significativos de preço
  ---
  duration_ms: 0.4772
  type: 'test'
  ...
# Subtest: extrai somente dígitos de entradas alfanuméricas e com símbolos
ok 15 - extrai somente dígitos de entradas alfanuméricas e com símbolos
  ---
  duration_ms: 0.401
  type: 'test'
  ...
# Subtest: formata telefone fixo (10 dígitos) e celular (11 dígitos) com DDD
ok 16 - formata telefone fixo (10 dígitos) e celular (11 dígitos) com DDD
  ---
  duration_ms: 0.5733
  type: 'test'
  ...
# Subtest: remove prefixo internacional +55 ao colar telefone do WhatsApp e limita a 11 dígitos
ok 17 - remove prefixo internacional +55 ao colar telefone do WhatsApp e limita a 11 dígitos
  ---
  duration_ms: 0.2886
  type: 'test'
  ...
# Subtest: formata CEP com 8 dígitos, preserva digitação parcial e trunca excesso
ok 18 - formata CEP com 8 dígitos, preserva digitação parcial e trunca excesso
  ---
  duration_ms: 0.8481
  type: 'test'
  ...
# Subtest: Garante que nenhum produto com estoque zerado é recomendado (PI4-82)
ok 19 - Garante que nenhum produto com estoque zerado é recomendado (PI4-82)
  ---
  duration_ms: 265.2091
  type: 'test'
  ...
# Subtest: Respeita o limite máximo de recomendações solicitado
ok 20 - Respeita o limite máximo de recomendações solicitado
  ---
  duration_ms: 262.2713
  type: 'test'
  ...
# Subtest: Personaliza recomendações por técnica para comprador com histórico (u7 - Ana Beatriz) (PI4-83)
ok 21 - Personaliza recomendações por técnica para comprador com histórico (u7 - Ana Beatriz) (PI4-83)
  ---
  duration_ms: 263.6729
  type: 'test'
  ...
# Subtest: Desprioriza produtos que o comprador já adquiriu para evitar repetição (PI4-83)
ok 22 - Desprioriza produtos que o comprador já adquiriu para evitar repetição (PI4-83)
  ---
  duration_ms: 264.3523
  type: 'test'
  ...
# Subtest: Aplica estratégia de Cold Start para novos visitantes sem histórico (PI4-84)
ok 23 - Aplica estratégia de Cold Start para novos visitantes sem histórico (PI4-84)
  ---
  duration_ms: 265.1296
  type: 'test'
  ...
# Subtest: Explicabilidade (XAI): Todos os itens possuem justificativa textual legível e dados do artesão
ok 24 - Explicabilidade (XAI): Todos os itens possuem justificativa textual legível e dados do artesão
  ---
  duration_ms: 252.7055
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5681.9026
```

### 3.2 Verificação de Linter (`npm run lint`) e Tipagem Estática (`npx tsc --noEmit`)

- **`npm run lint`:** Executado com `0` erros (`0 errors, 1 warning` informativo do Next.js sobre fonte customizada em `app/layout.tsx`).
- **`npx tsc --noEmit`:** Executado com código de saída `0` (`TSC_EXIT_CODE=0`), confirmando ausência de erros de compilação ou tipagem em todo o repositório.

---

## 4. Conclusão e Próximos Passos (W13)

Todos os **24 casos de teste automatizados** distribuídos nas 3 suítes (`catalogo.test.mjs`, `mascaras.test.mjs` e `recomendacao.test.mjs`) passaram sem falhas (`100% PASS`), comprovando a conformidade funcional dos fluxos de catálogo, filtros combinados, busca insensível a acentos, página de detalhes, avaliações, perfil do artesão, painel administrativo, máscaras de entrada e motor de recomendação por IA.

Para a **Semana 13 (`PI4-36` — W13-Testes concluídos (REQ))**, o escopo compreenderá a consolidação final dos testes após a conclusão da migração das rotas de API para PostgreSQL (`PI4-29`).
