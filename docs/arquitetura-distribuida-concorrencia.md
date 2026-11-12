# Arquitetura distribuída e concorrência — PI4-30

Esta entrega documenta o fluxo atual, as proteções do checkout e a evidência do teste de concorrência. O motor de recomendação usado aqui é o baseline TypeScript já existente na aplicação. O projeto de IA em `ia/` é uma entrega independente de outra disciplina e não é uma dependência para a PI4-30.

Rastreabilidade: PI4-153 exige diagrama e texto coerentes com o ambiente publicado; PI4-154 exige comando reproduzível e evidência anexada. Este documento parte de [arquitetura do backend](arquitetura-backend.md) e [publicação](publicacao.md). As proteções novas descritas adiante são alterações locais; não são apresentadas como já publicadas.

## Componentes e comunicação

```mermaid
flowchart LR
  Browser[Navegador] -->|HTTPS /api| Vercel[Next.js / Vercel]
  Vercel -->|HTTP JSON /api, com API_URL| Express[API Express / Render]
  Vercel -->|SQL via pg, sem API_URL| Banco[(PostgreSQL / Neon)]
  Express -->|SQL via pg e Prisma| Banco
  Express -->|chamada interna| Ranking[Motor TypeScript no Express]
  Vercel -->|chamada interna no caminho alternativo| RankingNext[Motor TypeScript no Next]
  subgraph ProjetoSeparado[Projeto de outra disciplina]
    Bento[BentoML em ia/ — sem integração publicada comprovada]
  end
```

O frontend normalmente usa requisições relativas a `/api`. Quando `API_URL` está configurada no build, o Next encaminha essas rotas ao Express por rewrite; sem ela, usa os handlers de `app/api`, que acessam o banco. A arquitetura publicada documentada é Vercel → Express no Render → Neon. A auditoria de 12/11/2026 observou respostas de saúde e recomendações nas URLs públicas; configuração interna e schema do Neon não foram verificados.

Estado persistente de pedidos, produtos, estoque e usuários: PostgreSQL. Sessão: JWT em cookie no navegador, validado pelos servidores. Carrinho e avisos locais: armazenamento do navegador. A chave da tentativa de checkout passa a ser guardada em `sessionStorage` nesta branch. Não foi identificado cache compartilhado de catálogo ou recomendações; o planejamento abaixo não representa um cache já implantado.

O Express separa rotas, controllers, services e repositories. O banco armazena pedidos, produtos e estoque; o Prisma está presente no projeto, e o checkout usa o driver `pg` com SQL explícito.

### Recomendação existente

`GET /api/recomendacoes` lê produtos, resumos de avaliações e, para comprador autenticado, quantidades compradas. Essas consultas independentes são executadas com `Promise.all`. Em seguida, `rankingRecomendacao.ts` filtra produtos esgotados, calcula pontuações, personaliza quando há histórico e devolve o resultado com justificativa. Visitantes usam a estratégia de início sem histórico. A resposta preserva `origem: baseline_ia_v1`.

A [verificação da rota](../backend/test/catalogoAuthPainel.test.ts) cobre visitante e comprador autenticado, origem do baseline, limite, estoque e justificativa; a [saída registrada](evidencias/recomendacao-local.txt) é da execução com banco descartável. Os resultados atualizados da revisão estão em [regressão de publicação e clientes](evidencias/revisao-regressoes.txt).

O motor é um módulo interno do processo Express; no caminho alternativo há implementação equivalente no Next. **Não existe uma chamada de rede para um serviço de IA independente nesta entrega.** O módulo não mantém conexão com o banco: recebe os dados já consultados. Essa separação é lógica, não implantação distribuída independente. O projeto de IA de outra disciplina permanece fora deste escopo; não é necessário configurá-lo ou publicá-lo para utilizar o baseline atual.

## Concorrência no checkout

1. A API identifica o comprador pela sessão, valida e agrupa itens e abre uma transação em uma única conexão.
2. Os produtos são consultados em ordem de ID com `SELECT ... FOR UPDATE`, mantendo o bloqueio até o fim da transação.
3. O backend valida o saldo e calcula o total com os preços do banco. Se algum item não tiver saldo suficiente, responde 409 e desfaz a operação.
4. Pedido, itens e baixa de estoque são gravados na mesma transação. A tentativa com chave tem um ID de pedido determinístico e um bloqueio transacional adicional por tentativa. O `COMMIT` confirma todas essas alterações; falhas causam `ROLLBACK`.
5. O SQL do modelo inclui `CHECK (estoque_qtd >= 0)` e gatilhos deferidos para a consistência do total. Eles foram carregados no banco descartável utilizado pelos testes.

Os bloqueios são por linha de produto: compras que disputam uma peça aguardam a transação anterior, enquanto produtos distintos podem avançar em paralelo. O teste local usou o padrão PostgreSQL `READ COMMITTED`; a aplicação depende do nível configurado no banco. Ordenar os bloqueios reduz a chance de impasses, sem provar que sejam impossíveis em qualquer cenário.

### Proteções complementares

O cliente atual envia `Idempotency-Key` com UUID. Um hash de comprador e chave define o ID do pedido. Um `pg_advisory_xact_lock` serializa a tentativa antes da leitura do pedido e do bloqueio dos produtos, entre todas as instâncias que usam esse fluxo. A PK existente persiste a identidade da tentativa: repetir a mesma chave e carrinho consulta o mesmo pedido, com seu status atual; outra combinação de itens retorna 409. Não há armazenamento separado da resposta original. Enquanto o pedido for preservado, retries sobrevivem a reinícios da API. Pedidos removidos fisicamente deixam de fornecer essa deduplicação.

O navegador tenta persistir a chave em `sessionStorage` e também a mantém em memória. Falhas ao acessar, ler, escrever ou remover storage não interrompem o envio; retries da sessão atual mantêm a chave. Se o storage estiver bloqueado, uma recarga ou fechamento da aba perde essa recuperação em memória. Ao concluir a compra, uma nova tentativa com carrinho idêntico ganha uma chave nova. Chaves distintas e alterações no carrinho representam operações diferentes.

Compatibilidade: clientes anteriores sem cabeçalho continuam criando pedidos transacionalmente, com IDs aleatórios e sem garantia de deduplicação de retries. Chave presente mas inválida recebe 400. A proteção de estoque por `FOR UPDATE` vale para ambos os clientes. Durante um rollout, instâncias antigas ainda não implementam idempotência; a garantia completa só passa a valer após atualizar todas as instâncias responsáveis pelo checkout.

O catálogo retorna `estoqueVersao` como token opaco da versão nativa da linha (`xmin`). A edição com versão usa atualização condicional atômica; venda ou outra edição em uma transação posterior invalida o token e retorna 409. O token não é contador de estoque nem identificador permanente; ele é usado para a duração de uma leitura/edição. IDs de transação podem se repetir no longo prazo, portanto não se deve manter um formulário indefinidamente. Veja [colunas de sistema do PostgreSQL](https://www.postgresql.org/docs/current/ddl-system-columns.html).

Clientes antigos sem versão podem salvar apenas quando a quantidade enviada ainda é igual à atual, sem alterar o saldo. Se tentarem alterar o estoque ou enviarem um saldo anterior a uma venda, recebem 409 com instrução explícita para recarregar a página e revisar o estoque; a cópia atual da interface também consulta o produto novamente após conflito. Permitir que um cliente sem versão altere saldo silenciosamente reintroduziria a perda de atualizações.

Essas proteções utilizam apenas a PK existente do pedido, os itens e as colunas nativas do PostgreSQL. O script 08 foi retirado do PR; não é necessária migração, tabela, coluna ou gatilho adicional para publicar esta versão. O Neon publicado não foi modificado.

## Latência, falhas e processamento assíncrono

O ranking e o painel já paralelizam consultas independentes. A simultaneidade pode consumir mais conexões e não implica snapshot comum; limites do pool e latência precisam ser medidos no ambiente real.

| Tema | Estratégia | Situação |
| --- | --- | --- |
| Catálogo e agregações | Avaliar cache com TTL e invalidação após mudanças; estoque e preço do checkout continuam validados no banco. | Planejada; cache compartilhado não implantado. |
| Serviço de aplicação ou banco indisponível | Informar falha sem confirmar uma compra não concluída; reutilizar a chave após resultado incerto. | Transação e idempotência implementadas; disponibilidade em produção não avaliada aqui. |
| Tarefas posteriores, como notificações | Se houver tarefa que precise de entrega confiável, registrar evento transacional em outbox e processar por worker idempotente com tentativas e monitoramento. | Proposta; outbox e worker não implantados. |
| Processamento de recomendações | Consultas assíncronas independentes; cálculo em memória no processo da aplicação. | Implementado; não é fila nem serviço de IA separado. |

## Reproduzir o teste de concorrência

Pré-requisitos: Docker, Node e dependências do backend instaladas; porta 55432 livre. Use exclusivamente um banco descartável. O script 05 apaga dados e não deve ser executado no Neon compartilhado.

```powershell
docker run -d --rm --name raizes-teste-concorrencia -e POSTGRES_PASSWORD=teste_local -e POSTGRES_DB=raizes_teste -p 127.0.0.1:55432:5432 postgres:16-alpine
docker exec raizes-teste-concorrencia pg_isready -U postgres -d raizes_teste
docker cp db/. raizes-teste-concorrencia:/tmp/raizes-db
docker exec raizes-teste-concorrencia sh -c 'for f in 01_ddl_origem.sql 04_migracao_front.sql 05_dados_raizes_pe.sql 06_imagem_produto.sql 07_autenticacao.sql; do psql -v ON_ERROR_STOP=1 -U postgres -d raizes_teste -f /tmp/raizes-db/$f > /dev/null || exit 1; done'
Set-Location backend
$env:TEST_DATABASE_URL = 'postgresql://postgres:teste_local@127.0.0.1:55432/raizes_teste'
npm run test:concorrencia
```

Aguarde `pg_isready` confirmar a disponibilidade antes de carregar os scripts. O teste usa produtos e comprador próprios, que permanecem no banco descartável para auditoria. Ao terminar, `docker stop raizes-teste-concorrencia` encerra o contêiner criado; por `--rm`, seus dados serão removidos. Sem `TEST_DATABASE_URL`, o teste é ignorado, não aprovado. O projeto possui uma trava adicional que impede usar o banco do time como banco de testes.

Os 14 cenários cobrem disputa pela última unidade, excesso de demanda, rollback, ordens inversas, repetição de chave, isolamento por comprador, edição de estoque desatualizada, funcionamento no schema original e clientes anteriores. A [saída em PostgreSQL descartável](evidencias/concorrencia-main-atualizada.txt) registra os resultados. Foram observados um pedido e saldo zero para dez requisições disputando uma unidade. Os testes demonstram os cenários executados localmente; não são teste de carga nem comprovam disponibilidade do ambiente publicado. Arquivos de evidência anteriores no histórico do PR representam versões anteriores do desenho.

## Situação para o aceite

Os testes de falha do armazenamento podem ser repetidos na raiz com `node --test tests/tentativaCheckout.test.mjs`; a [saída registrada](evidencias/armazenamento-checkout.txt) contém oito cenários. Se a limpeza persistida do carrinho falhar após compra confirmada, a chave é preservada para recuperar esse pedido após recarga.

- Checkout protegido por transação e bloqueio: implementado e validado localmente.
- Arquitetura, comunicação, concorrência e estratégias de falha: documentadas neste arquivo.
- Teste de concorrência e dados consultados no banco: [teste](../backend/test/concorrencia.test.ts) e [evidência](evidencias/concorrencia-main-atualizada.txt).
- Serviço de IA independente: não implementado nesta entrega; o baseline interno é a escolha adotada. Se a avaliação exigir expressamente um serviço de IA distribuído, esse ponto dependerá de outra entrega.
- Publicação: alterações no PR, sem deploy de produção realizado nesta sessão. Não há migração adicional; clientes antigos mantêm checkout transacional e recebem instrução de atualização ao tentar alterar saldo sem versão.
