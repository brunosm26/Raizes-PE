# Análise de code smell: criação de pedidos

- **Integrante:** Ramon Taffarel Guimarães
- **Módulo:** pedidos, backend Express
- **Localização:** `backend/src/services/pedidoService.ts`, função `criarPedido`

## Problema identificado

A função `criarPedido` reúne várias etapas: valida o identificador do comprador e os itens, verifica o comprador, busca os produtos, confere o estoque, calcula o total e solicita a gravação do pedido e de seus itens. Esse acúmulo pode ser visto como um possível code smell de função com muitas responsabilidades.

O impacto potencial está principalmente na legibilidade e na manutenção. Para entender uma regra específica, como a conferência de estoque ou o cálculo do total, é preciso acompanhar outras etapas da criação do pedido. Se essas regras crescerem, futuras alterações poderão ficar mais difíceis de localizar e revisar.

## Análise e decisão

Decidi **não refatorar** a função neste momento. Apesar de reunir várias etapas, elas fazem parte de um mesmo objetivo: criar um pedido. A função ainda permite acompanhar a sequência principal sem exigir uma navegação entre várias funções auxiliares.

Além disso, a validação dos itens já foi separada em `validarItens`, e o acesso ao banco está dividido entre repositórios. A função de serviço coordena essas partes e mantém próximas as operações que precisam ocorrer na mesma transação. Isso ajuda a entender a relação entre a criação do pedido, a gravação dos itens e a baixa do estoque.

Uma alternativa seria extrair a conferência de estoque e o cálculo do total para outra função. Ela poderia ser útil se essas regras crescessem ou passassem a ser reutilizadas. Porém, no estado atual, a extração acrescentaria uma chamada e uma nova divisão ao fluxo sem um ganho de clareza suficientemente evidente. Por isso, manter a implementação atual é uma escolha proporcional ao tamanho e à finalidade do código.

## Limitações e validação

Essa decisão deve ser reavaliada se a função receber mais regras de negócio ou se o cálculo e a conferência de estoque se tornarem mais complexos. Nesse caso, separar essas regras e ampliar os testes poderia facilitar a manutenção.

Foram identificados testes existentes em `backend/test/escritaSemBanco.test.ts` para validação de entradas e em `backend/test/pedidosProdutos.test.ts` para criação de pedidos, total, itens repetidos e estoque insuficiente. Os testes que gravam dados exigem um banco de teste descartável. Como esta intervenção apenas registra a análise e não altera o comportamento do software, os testes não foram executados.
