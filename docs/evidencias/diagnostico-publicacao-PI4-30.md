# Diagnóstico de publicação — PI4-30

Em 12/11/2026, verificações somente de leitura identificaram o frontend `https://raizes-pe-gules.vercel.app` e a API Express `https://raizes-pe-api.onrender.com`. Ambos responderam a `GET /api/recomendacoes?limite=2` com `origem: baseline_ia_v1`, o motor TypeScript existente e adotado nesta entrega. Não é necessário configurar outro serviço de recomendação.

A branch de entrega foi preparada em uma cópia isolada com base na `origin/main` `51fe82d`. A integração com o frontend deve preservar o rewrite `API_URL` da main e os testes e controles de segurança já existentes.

Antes de publicar:

1. Revisar as alterações e integrar a branch à versão atual da main.
2. Verificar no banco de destino se a coluna, tabela e gatilho do [script 08](../../db/08_concorrencia_checkout.sql) já existem. Aplicá-lo pelo fluxo da equipe apenas se necessário. O schema publicado não foi inspecionado nesta sessão.
3. Coordenar o rollout do frontend e do Express: os novos contratos exigem chave de idempotência e versão de estoque. Confirmar que clientes antigos não ficarão incompatíveis durante a transição.
4. Validar a aplicação publicada e registrar os links de documento, teste e evidência na PI4-30. Testes que criam pedidos e alteram estoque devem usar banco descartável, nunca o Neon compartilhado.

Os [cenários de concorrência](concorrencia-main-atualizada.txt) foram executados em PostgreSQL descartável. A [arquitetura](../arquitetura-distribuida-concorrencia.md) explicita que o motor de recomendação roda dentro da aplicação e que o projeto de IA de outra disciplina não é dependência da entrega. As mudanças ainda não foram publicadas no ambiente de destino.
