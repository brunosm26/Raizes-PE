# Diagnóstico de publicação — PI4-30

Em 12/11/2026, verificações somente de leitura identificaram o frontend `https://raizes-pe-gules.vercel.app` e a API Express `https://raizes-pe-api.onrender.com`. Ambos responderam a `GET /api/recomendacoes?limite=2` com `origem: baseline_ia_v1`, o motor TypeScript existente e adotado nesta entrega. Não é necessário configurar outro serviço de recomendação.

A branch de entrega foi preparada em uma cópia isolada com base na `origin/main` `51fe82d`. A integração com o frontend deve preservar o rewrite `API_URL` da main e os testes e controles de segurança já existentes.

Antes de publicar:

1. Revisar as alterações e integrar a branch à versão atual da main.
2. Não aplicar o antigo script 08 desta proposta: ele foi retirado do PR. O catálogo usa a versão nativa da linha; idempotência usa o ID e a PK existentes do pedido. A regressão foi executada no banco original, sem coluna, tabela ou gatilho adicional.
3. Atualizar frontend e Express. Clientes sem chave preservam o checkout transacional; edições sem versão só podem preservar o saldo atual, e recebem 409 com instrução de recarregar quando tentam alterá-lo. A idempotência só é garantida nas instâncias já atualizadas e para solicitações que enviam a chave.
4. Validar a aplicação publicada e registrar os links de documento, teste e evidência na PI4-30. Testes que criam pedidos e alteram estoque devem usar banco descartável, nunca o Neon compartilhado.

Os [cenários de concorrência](concorrencia-main-atualizada.txt) foram executados em PostgreSQL descartável. A [arquitetura](../arquitetura-distribuida-concorrencia.md) explicita que o motor de recomendação roda dentro da aplicação e que o projeto de IA de outra disciplina não é dependência da entrega. As mudanças ainda não foram publicadas no ambiente de destino.
