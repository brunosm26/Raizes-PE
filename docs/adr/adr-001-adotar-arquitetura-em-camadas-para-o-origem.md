# ADR-001: Adotar arquitetura em camadas para o Origem

- **Status:** Proposta
- **Data:** 2026-11-24
- **Autor:** RAMON TAFFAREL GUIMARÃES (rtg@cesar.school)
- **Turma:** Regular (terças)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O Origem é um marketplace em que compradores podem adquirir peças de artesãos. O projeto usa uma stack e um modelo de dados definidos nas disciplinas de Desenvolvimento Web e Banco de Dados. Na finalização da compra, uma queda de conexão pode levar o comprador a repetir a tentativa sem saber que o pedido já foi registrado.

## Preocupações

Confiabilidade, pedidos duplicados, consistência do estoque, organização do código, testabilidade.

## Decisão

Adotar uma arquitetura em camadas, separando interface, regras de negócio e acesso aos dados. No checkout, usar uma chave para identificar tentativas repetidas e uma transação para registrar o pedido e atualizar o estoque.

## Justificativa

A separação em camadas organiza as regras do checkout. A chave permite reconhecer a repetição da mesma compra, enquanto a transação mantém o registro do pedido e a atualização do estoque juntos.

## Consequências

A decisão facilita a organização e os testes das regras de compra. Por outro lado, aumenta a quantidade de arquivos e exige cuidado para manter as responsabilidades separadas e a chave da compra disponível em uma nova tentativa.

## Alternativas consideradas

Foi considerado o padrão CQRS, mas a separação entre leitura e escrita não resolve, por si só, a duplicação de pedidos. O cenário ainda precisaria de um controle para reconhecer a tentativa repetida.

## Rastreabilidade

**Atributo de qualidade:** Confiabilidade · Tolerância a falhas

**Cenário que originou a decisão:**

> Durante uma compra, a conexão do comprador cai após o pedido ser registrado, mas antes de ele receber a confirmação. Ao tentar finalizar novamente a mesma compra, sem alterar o carrinho, o sistema reconhece a repetição e retorna o pedido já registrado. No final, deve existir apenas um pedido, e o estoque deve ter sido reduzido uma única vez, na quantidade comprada.

**Padrão arquitetural adotado:** Camadas

**Táticas empacotadas:** Encapsular responsabilidades por faixa; restringir dependências a uma direção; usar intermediário entre camadas.

Checkout, serviço de pedidos e controle de estoque.

## Verificação

- **Teste do cenário:** Simular uma compra em que o pedido é registrado, mas a confirmação não chega ao comprador. Em seguida, repetir a requisição com a mesma chave e o mesmo carrinho. O teste passa se a resposta retornar o mesmo pedido, houver apenas um pedido registrado e o estoque tiver sido reduzido uma única vez, na quantidade comprada.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
