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

A [verificação da rota](../backend/test/catalogoAuthPainel.test.ts) cobre visitante e comprador autenticado, origem do baseline, limite, estoque e justificativa; a [saída registrada](evidencias/recomendacao-local.txt) é da execução com banco descartável. Na revisão de 12/11/2026 passaram 160 testes do backend e 32 do frontend, com checagem de tipos e build do backend aprovados.

O motor é um módulo interno do processo Express; no caminho alternativo há implementação equivalente no Next. **Não existe uma chamada de rede para um serviço de IA independente nesta entrega.** O módulo não mantém conexão com o banco: recebe os dados já consultados. Essa separação é lógica, não implantação distribuída independente. O projeto de IA de outra disciplina permanece fora deste escopo; não é necessário configurá-lo ou publicá-lo para utilizar o baseline atual.

## Concorrência no checkout

1. A API identifica o comprador pela sessão, valida e agrupa itens e abre uma transação em uma única conexão.
2. Os produtos são consultados em ordem de ID com `SELECT ... FOR UPDATE`, mantendo o bloqueio até o fim da transação.
3. O backend valida o saldo e calcula o total com os preços do banco. Se algum item não tiver saldo suficiente, responde 409 e desfaz a operação.
4. Pedido, itens, baixa de estoque e resposta para idempotência são gravados na mesma transação. O `COMMIT` confirma todas essas alterações; falhas causam `ROLLBACK`.
5. O SQL do modelo inclui `CHECK (estoque_qtd >= 0)` e gatilhos deferidos para a consistência do total. Eles foram carregados no banco descartável utilizado pelos testes.

Os bloqueios são por linha de produto: compras que disputam uma peça aguardam a transação anterior, enquanto produtos distintos podem avançar em paralelo. O teste local usou o padrão PostgreSQL `READ COMMITTED`; a aplicação depende do nível configurado no banco. Ordenar os bloqueios reduz a chance de impasses, sem provar que sejam impossíveis em qualquer cenário.

### Proteções complementares

O checkout exige `Idempotency-Key` com UUID. A combinação de comprador e chave é reservada na mesma transação. Uma repetição do mesmo carrinho retorna a resposta original; reutilizar a chave com outro carrinho retorna 409. O navegador guarda a chave em `sessionStorage` durante falhas e recargas da mesma aba. A garantia depende de manter a mesma chave, comprador e carrinho; não deduplica tentativas com chaves distintas.

O catálogo retorna `estoqueVersao`, e a edição exige a versão observada. Um gatilho incrementa a versão sempre que a quantidade muda; se houver venda ou edição posterior à leitura, o `PATCH` retorna 409, evitando sobrescrever o estoque com valor antigo. A interface atualiza a cópia do produto após o conflito.

O [script 08](../db/08_concorrencia_checkout.sql) adiciona a tabela de idempotência, a coluna de versão e o gatilho. Deve ser aplicado ao banco de destino pelo fluxo da equipe antes do código novo. Os contratos passam a exigir chave de idempotência e versão do estoque: frontend, API e banco precisam de publicação coordenada. O Neon publicado não foi modificado nesta entrega.

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
docker exec raizes-teste-concorrencia sh -c 'for f in 01_ddl_origem.sql 04_migracao_front.sql 05_dados_raizes_pe.sql 06_imagem_produto.sql 07_autenticacao.sql 08_concorrencia_checkout.sql; do psql -v ON_ERROR_STOP=1 -U postgres -d raizes_teste -f /tmp/raizes-db/$f > /dev/null || exit 1; done'
Set-Location backend
$env:TEST_DATABASE_URL = 'postgresql://postgres:teste_local@127.0.0.1:55432/raizes_teste'
npm run test:concorrencia
```

Aguarde `pg_isready` confirmar a disponibilidade antes de carregar os scripts. O teste usa produtos e comprador próprios, que permanecem no banco descartável para auditoria. Ao terminar, `docker stop raizes-teste-concorrencia` encerra o contêiner criado; por `--rm`, seus dados serão removidos. Sem `TEST_DATABASE_URL`, o teste é ignorado, não aprovado. O projeto possui uma trava adicional que impede usar o banco do time como banco de testes.

Os dez cenários cobrem disputa pela última unidade, excesso de demanda, rollback, ordens inversas, repetição de chave, isolamento por comprador e edição de estoque desatualizada. A [saída em PostgreSQL descartável](evidencias/concorrencia-main-atualizada.txt) registra dez testes aprovados. Foram observados um pedido e saldo zero para dez requisições disputando uma unidade. Os testes demonstram os cenários executados localmente; não são teste de carga nem comprovam disponibilidade do ambiente publicado.

## Situação para o aceite

- Checkout protegido por transação e bloqueio: implementado e validado localmente.
- Arquitetura, comunicação, concorrência e estratégias de falha: documentadas neste arquivo.
- Teste de concorrência e dados consultados no banco: [teste](../backend/test/concorrencia.test.ts) e [evidência](evidencias/concorrencia-main-atualizada.txt).
- Serviço de IA independente: não implementado nesta entrega; o baseline interno é a escolha adotada. Se a avaliação exigir expressamente um serviço de IA distribuído, esse ponto dependerá de outra entrega.
- Publicação: alterações em branch local, sem deploy; o schema no Neon e o rollout coordenado continuam pendentes.
