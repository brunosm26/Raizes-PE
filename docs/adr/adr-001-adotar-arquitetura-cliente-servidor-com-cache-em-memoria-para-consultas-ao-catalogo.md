# ADR-001: Adotar arquitetura cliente-servidor com cache em memória para consultas ao catálogo

- **Status:** Proposta
- **Data:** 2026-11-23
- **Autor:** PEDRO HENRIQUE CAVALCANTI E SILVA (phcs@cesar.school)
- **Turma:** Regular (terças)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O Projeto Origem é um marketplace que conecta artesãos de Pernambuco aos compradores. O sistema utiliza frontend em Next.js, backend em Express e banco PostgreSQL. Como os usuários precisam acessar o catálogo e buscar produtos frequentemente, é importante evitar consultas repetidas que possam prejudicar o desempenho. Além disso, o projeto é desenvolvido por uma equipe de estudantes, com prazo limitado e infraestrutura de hospedagem restrita.

## Preocupações

desempenho, tempo de resposta, manutenção, simplicidade, custo de infraestrutura, consistência dos dados

## Decisão

Manter a arquitetura cliente-servidor do Projeto Origem, com o frontend realizando requisições à API Express e utilizando cache em memória no backend para reaproveitar resultados recentes das consultas ao catálogo, evitando acessos repetidos ao banco de dados. O cache terá validade padrão de 60 segundos e será invalidado após alterações relevantes no catálogo ou em pedidos.

## Justificativa

Essa decisão foi escolhida porque aproveita a estrutura que já existe no Projeto Origem, sem exigir grandes mudanças ou serviços adicionais. A separação entre cliente e servidor permite centralizar o processamento das requisições, enquanto o cache reduz consultas repetidas ao PostgreSQL. Isso contribui para um melhor desempenho do catálogo e é adequado às limitações de tempo, equipe e infraestrutura do projeto.

## Consequências

Como benefício, o sistema pode responder às consultas repetidas utilizando informações armazenadas em memória, reduzindo acessos desnecessários ao banco de dados. A solução também aproveita a infraestrutura existente. Por outro lado, o cache consome memória do servidor e precisa ser invalidado corretamente para evitar dados desatualizados. Além disso, como o cache é local, seu conteúdo é perdido quando o servidor reinicia e não é compartilhado automaticamente entre diferentes instâncias.

## Alternativas consideradas

Foram consideradas duas alternativas: manter as consultas ao banco sem cache e utilizar CQRS para separar as operações de leitura e escrita. A primeira seria mais simples, mas manteria consultas repetidas ao banco. O CQRS poderia favorecer a otimização das leituras, porém aumentaria a complexidade de desenvolvimento e manutenção. Por isso, foi preferida a arquitetura cliente-servidor já existente, complementada pelo cache em memória.

## Rastreabilidade

**Atributo de qualidade:** Eficiência de desempenho · Comportamento temporal

**Cenário que originou a decisão:**

> Durante a operação normal do Projeto Origem, com o banco de dados disponível e o cache inicialmente vazio, um comprador acessa o catálogo de produtos e realiza uma segunda consulta à mesma URL em até 60 segundos. Na primeira requisição, a API Express consulta o banco de dados e armazena o resultado no cache em memória. Na segunda requisição, o sistema reutiliza os dados armazenados, evitando uma nova consulta ao banco. O comportamento esperado será verificado por duas respostas HTTP 200, sendo a primeira com o cabeçalho X-Cache: MISS e a segunda com X-Cache: HIT.

**Padrão arquitetural adotado:** Cliente-servidor

**Táticas empacotadas:** Centralizar regra e dado no servidor

A decisão está relacionada à arquitetura descrita em docs/arquitetura-backend.md e à implementação do cache nos arquivos backend/src/utils/cacheMemoria.ts, backend/src/services/cacheCatalogo.ts e backend/src/controllers/respostaCache.ts. O comportamento pode ser verificado pela rota GET /api/produtos, observando os cabeçalhos X-Cache: MISS e X-Cache: HIT.

## Verificação

- **Teste do cenário:** Em um ambiente de teste com o cache inicialmente vazio e o banco disponível, executar duas requisições GET para a mesma URL de produtos em um intervalo de até 60 segundos. Verificar se ambas retornam HTTP 200, sendo a primeira com X-Cache: MISS e a segunda com X-Cache: HIT. Isso comprova o reaproveitamento do resultado armazenado em memória. Também deve ser verificado se a atualização de um produto invalida o cache correspondente.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
