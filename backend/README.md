# Backend Raízes PE (Express + TypeScript)

API REST independente do app Next. Requer Node.js 20.19+, 22.12+ ou 24+ (exigência do Prisma 7). Todos os comandos rodam dentro da pasta `backend/`.

## Instalar

```bash
cd backend
npm install
```

O `npm install` já gera o client do Prisma (não precisa de `.env` nem de banco).

Crie o `.env` a partir do modelo e preencha a `DATABASE_URL` (a do Neon ou a de um banco local, veja [`docs/desenvolvimento.md`](../docs/desenvolvimento.md#banco-local-em-docker)) e o `SESSION_SECRET`, com o **mesmo valor** do `.env.local` do front. Sem eles, só a rota `/api/saude` funciona. Os padrões são `PORT=4000` e `NODE_ENV=development`. A tabela de todas as variáveis está em [`docs/desenvolvimento.md`](../docs/desenvolvimento.md#variáveis-de-ambiente).

```bash
# Windows (cmd)
copy .env.example .env
# Mac/Linux
cp .env.example .env
```

## Rodar em desenvolvimento (recarrega ao salvar)

```bash
npm run dev
```

## Compilar e rodar a versão compilada

```bash
npm run typecheck   # o mesmo que npx tsc --noEmit: cobre src/, test/ e scripts/
npm run build       # compila só src/ (tsconfig.build.json)
npm start
```

O `build` gera o JavaScript em `backend/dist/`.

## Testar a rota de saúde

Com o servidor rodando, abra <http://localhost:4000/api/saude> no navegador ou rode:

```bash
curl.exe http://localhost:4000/api/saude
```

Resposta esperada (status 200): `{"ok":true}`. No PowerShell, use `curl.exe`, e não `curl`, que é um apelido do `Invoke-WebRequest`.

## Prisma

**Decisão da entrega: uso híbrido intencional de Prisma e `pg`.**

- **Prisma 7 é a fonte da verdade do schema:** `prisma/schema.prisma` e as migrations em `prisma/migrations` definem o DDL do schema `origem` (o `db/ddl_final.sql` é gerado delas). O client, com o adapter `@prisma/adapter-pg`, é usado em `src/repositories/popularidadeRepository.ts` (view de popularidade, exercitada pelo `npm run prisma:verificar`).
- **`pg` nos repositories das rotas:** produtos, pedidos, artesãos, avaliações, estatísticas, usuários e saúde falam com o banco pelo pool de `src/config/db.ts`, com SQL escrito à mão. Assim ficam explícitas as consultas otimizadas (junções, busca sem acento, agregações do painel e do ranking) e o controle de transação e trava (`BEGIN`/`COMMIT` em `repositories/transacao.ts` e `SELECT ... FOR UPDATE` no estoque do checkout).

As duas ferramentas ficam só em `repositories/` (e `config/`), então services, controllers e rotas não sabem qual delas responde.

### Preencher o `.env`

Peça as connection strings a quem administra o banco, por um canal privado. No painel do Neon, ambas ficam em **Connect** e terminam em `?sslmode=require`:

- `DATABASE_URL`: a connection string **pooled** (com *Connection pooling* ligado; o host tem `-pooler`). É a que a API usa em runtime (pelo pool do `pg` e pelo Prisma): o pooler do Neon aguenta muitas conexões curtas.
- `DIRECT_URL`: a connection string **direta** (com o pooling desligado; o host não tem `-pooler`). É a que a CLI do Prisma usa (`prisma:pull`), porque a introspecção precisa de uma conexão de sessão comum.

O aviso `SECURITY WARNING: The SSL modes 'prefer', 'require'...` vem do driver `pg` e é inofensivo: hoje `sslmode=require` já funciona como `verify-full`, o modo mais seguro.

### Comandos

```bash
npm run prisma:generate   # regera o client em src/generated/ (não versionado)
npm run prisma:verificar  # SÓ LEITURA: conta as linhas das 8 tabelas e da view
npm run prisma:pull       # SÓ LEITURA: reintrospecta o banco e reescreve prisma/schema.prisma
```

Depois de um `prisma:pull`, rode `git diff prisma/schema.prisma`: se não houver diferença, o schema bate com o banco. **No Neon do time, nunca rode `prisma migrate deploy/dev/reset/resolve`, `prisma db push` nem `prisma db execute`**: o banco é compartilhado. As migrations só rodam em banco local descartável (seção [Migrations](#migrations)).

### Decisões

- **As migrations são a fonte da verdade do DDL** (PI4-147, em `prisma/migrations`). O `schema.prisma` veio do `db pull` e continua batendo com o banco: um `migrate diff` entre um banco migrado e o `schema.prisma` dá migration vazia. Os modelos foram renomeados para PascalCase (`ItemPedido`) e os campos para camelCase (`precoUnitario`), e os nomes reais ficam em `@@map`/`@map`. Um novo `db pull` preserva esses nomes.
- **Relações com nomes claros:** `Pedido.comprador`, `Pedido.itens`, `Produto.itensPedido`, `Usuario.pedidos` etc.
- **Sem enums no Prisma:** `usuario.tipo` e `pedido.status` são `VARCHAR` com `CHECK` no banco, não enums do Postgres, por isso ficam `String`.
- **CHECKs, gatilhos, funções, a view, os perfis de acesso e os comentários ficam no SQL** da migration `1_regras_sql`, e não são replicados no `schema.prisma`. O `SELECT ... FOR UPDATE` fica nos repositories.
- **A view `vw_popularidade_produto` não é modelo Prisma.** Ela é lida com `$queryRaw` em `src/repositories/popularidadeRepository.ts`, com o resultado tipado. As consultas pesadas das rotas (agregações, ranking, recomendação) ficam em SQL direto com o `pg` nos repositories, pela decisão híbrida acima.
- **Há um único client**, em `src/config/prisma.ts`. Ele é criado no primeiro uso (o servidor sobe sem `DATABASE_URL`) e desconectado quando o servidor é encerrado.

### Problemas comuns

- **`EPERM: operation not permitted, rmdir ...src\generated...`:** acontece quando o projeto está no OneDrive, que trava a pasta. Rode `npm run prisma:generate`, que apaga `src/generated` antes de gerar.
- **`DATABASE_URL não configurada`:** falta o `.env` (veja acima).

## Migrations

> **Nada desta seção roda no Neon do time.** Os comandos abaixo usam um PostgreSQL local descartável (Docker). Os scripts `db:migrar-descartavel` e `db:comparar` **recusam** host que não seja `localhost`, `127.0.0.1` ou `::1`, e recusam URL igual à `DATABASE_URL` ou à `DIRECT_URL` do `process.env`, do `backend/.env` ou do `.env.local`/`.env` da raiz. A trava fica em `scripts/travaBanco.ts`, a mesma dos testes.

As migrations ficam em `prisma/migrations` (configurado em `prisma.config.ts`) e recriam o schema `origem` do zero:

| Migration | Origem | O que cria |
|---|---|---|
| `0_init` | gerada do `schema.prisma` (`prisma migrate diff --from-empty`) | schema `origem`, 8 tabelas, colunas, defaults, PK, FK e índices |
| `1_regras_sql` | escrita à mão a partir de `db/01`, `04`, `06` e `07` | o que o Prisma não expressa: UNIQUE como constraint, 13 CHECK, 5 funções, 7 gatilhos (2 adiados para o COMMIT), a view `vw_popularidade_produto`, os perfis `origem_app` e `origem_recomendacao` com os GRANTs, e os comentários |

**Perfis de acesso:** roles são globais do servidor PostgreSQL, não de um banco, e podem já existir porque outro banco do mesmo servidor os criou. Por isso a `1_regras_sql` só faz `CREATE ROLE` se o role não existir (`DO $$ ... IF NOT EXISTS (SELECT FROM pg_roles ...)`) e nunca altera um role existente. Os GRANTs são aplicados sempre.

O `db/ddl_final.sql` é a concatenação das migrations em SQL puro, gerada por `npm run db:ddl`. Não edite esse arquivo à mão. O teste `test/migrations.test.ts` falha se ele ficar desatualizado.

### Subir o Postgres descartável (Windows, PowerShell)

```powershell
# senha aleatória, só nesta janela do terminal (não vai para arquivo)
$env:PG_SENHA = [guid]::NewGuid().ToString("N")
docker run -d --rm --name raizes-pg -e POSTGRES_PASSWORD=$env:PG_SENHA -p 127.0.0.1:15433:5432 postgres:16
docker exec raizes-pg pg_isready -U postgres
docker exec raizes-pg createdb -U postgres raizes_mig
```

No cmd, troque a primeira linha por `set PG_SENHA=<uma senha aleatória>` e use `%PG_SENHA%` no lugar de `$env:PG_SENHA`. Se o Docker disser `ports are not available ... bind`, a porta está numa faixa reservada pelo Windows. Veja as faixas com `netsh int ipv4 show excludedportrange protocol=tcp` e troque a porta (`15433`) nos comandos. No fim, `docker rm -f raizes-pg` apaga o container e todos os bancos dele.

### Aplicar as migrations num banco vazio

```powershell
cd backend
$env:MIGRATE_DATABASE_URL = "postgresql://postgres:$($env:PG_SENHA)@127.0.0.1:15433/raizes_mig"
npm run db:migrar-descartavel   # imprime só host/porta/banco, roda migrate deploy e migrate status
```

O script passa `DIRECT_URL` e `DATABASE_URL` para o processo do Prisma apontando para esse banco. O `backend/.env` não muda o alvo. A tabela de controle `_prisma_migrations` fica no schema `public`, fora do `origem`.

Para carregar a carga de demonstração por cima (só dados: `05` e `07`). No PowerShell o redirecionamento `<` não funciona, por isso o arquivo vai com `docker cp`:

```powershell
foreach ($f in "05_dados_raizes_pe.sql", "07_autenticacao.sql") {
  docker cp "..\db\$f" "raizes-pg:/tmp/$f"
  docker exec raizes-pg psql -q -U postgres -d raizes_mig -v ON_ERROR_STOP=1 -f "/tmp/$f"
}
```

### Validar

1. **`db/validacao_resumo.sql`:** todas as 8 linhas com `esperado` = `obtido`.

   ```powershell
   docker cp ..\db\validacao_resumo.sql raizes-pg:/tmp/validacao.sql
   docker exec raizes-pg psql -U postgres -d raizes_mig -f /tmp/validacao.sql
   ```

2. **Comparador de esquemas:** compara o schema `origem` de dois bancos pelo catálogo (tabelas, colunas, constraints, índices, gatilhos, funções, views, sequences, extensões, permissões e comentários) e ignora `_prisma_migrations`. Ele não depende da ordem do `pg_dump`. Para conferir as migrations contra os scripts antigos, monte um banco de referência com `db/01`, `04`, `05`, `06` e `07` (com o mesmo `docker cp` + `psql`, num banco `raizes_ref`) e rode:

   ```powershell
   $env:COMPARAR_URL_A = "postgresql://postgres:$($env:PG_SENHA)@127.0.0.1:15433/raizes_ref"
   $env:COMPARAR_URL_B = "postgresql://postgres:$($env:PG_SENHA)@127.0.0.1:15433/raizes_mig"
   npm run db:comparar   # "Nenhuma diferença." = iguais (código 0); senão lista as diferenças (código 1)
   ```

   Também aceita `npm run db:comparar -- env:VAR_A env:VAR_B`. Não passe a URL direto no comando, porque o npm ecoa a linha de comando. O dono e as permissões da conexão aparecem como `<conexao>`, para dois bancos com donos diferentes não divergirem só por isso.

3. **`npm run prisma:verificar`** apontando para o banco descartável (só leitura). Depois, remova a variável: com a `DATABASE_URL` igual à `MIGRATE_DATABASE_URL`, a trava do `db:migrar-descartavel` trata o banco como o do time e recusa.

   ```powershell
   $env:DATABASE_URL = $env:MIGRATE_DATABASE_URL
   npm run prisma:verificar
   Remove-Item Env:DATABASE_URL
   ```

### Criar uma nova migration

Sempre num banco descartável, nunca no do time. O `prisma migrate dev` não serve aqui: ele pede shadow database e pode propor `reset`. Além disso, o Prisma não enxerga CHECK, gatilhos e a view, então um diff contra o schema do time não é confiável.

1. Suba um banco descartável e aplique as migrations atuais (`npm run db:migrar-descartavel`).
2. Mudança que o Prisma expressa (coluna, tabela, índice): edite o `schema.prisma` e gere o SQL contra o banco descartável migrado:

   ```powershell
   $env:DIRECT_URL = $env:MIGRATE_DATABASE_URL
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<AAAAMMDDHHMMSS>_<nome>/migration.sql
   Remove-Item Env:DIRECT_URL
   ```

   Mudança que o Prisma não expressa (CHECK, gatilho, função, view, GRANT): crie `prisma/migrations/<AAAAMMDDHHMMSS>_<nome>/migration.sql` à mão. As pastas são aplicadas em ordem **alfabética**, não numérica: `10_x` viria antes de `2_x`. Por isso, a partir da próxima migration, use prefixo com data e hora, que é o padrão do Prisma e sempre ordena depois de `0_init` e `1_regras_sql`. Exemplo: `20261120143000_nome`.
3. Rode `npm run db:migrar-descartavel` de novo, confira com o comparador e o `validacao_resumo.sql`, regenere o DDL (`npm run db:ddl`) e faça o commit da migration junto com o `db/ddl_final.sql`.
4. Depois de aplicada em qualquer banco, uma migration **não** deve ser editada: o Prisma guarda o checksum de cada arquivo. As migrations são gravadas sempre com LF (`.gitattributes`) para o checksum não mudar entre Windows e Linux.

Aplicar uma migration nova no Neon do time é decisão do responsável pelo banco.

### Baseline no Neon do time (só o responsável pelo banco, com autorização)

O Neon já tem o schema criado pelos scripts de `db/`, então as migrations **não** devem rodar lá. Elas só precisam ser marcadas como já aplicadas. Isto **cria a tabela `_prisma_migrations`** no banco do time, no schema padrão da conexão (`public` quando a URL não tem `?schema=`). Por isso exige autorização do responsável. Ninguém mais deve rodar estes comandos.

```powershell
cd backend
# no terminal do responsável, com a DIRECT_URL do Neon no backend/.env
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code   # só leitura: deve dar vazio
npx prisma migrate status                        # deve listar 0_init e 1_regras_sql como não aplicadas
npx prisma migrate resolve --applied 0_init
npx prisma migrate resolve --applied 1_regras_sql
npx prisma migrate status                        # esperado: "Database schema is up to date!"
```

O `migrate resolve` não executa o SQL das migrations: só grava na `_prisma_migrations` que elas já estão aplicadas. Depois disso, um `migrate deploy` no Neon aplicaria só as migrations novas.

## Documentação da API (Swagger)

Com o servidor rodando, abra <http://localhost:4000/api-docs>. Lá estão todas as rotas, com parâmetros, corpos, respostas e erros. Para chamar as rotas protegidas pelo "Try it out", execute antes `POST /auth/login` (por exemplo `ana.beatriz@raizespe.dev` / `demo123`): o navegador guarda o cookie de sessão.

A especificação fica em `openapi.yaml` (versionada) e também é servida crua em <http://localhost:4000/api-docs.json>. Ao criar ou mudar uma rota, atualize o `openapi.yaml`: o `npm test` falha se uma rota do Express não estiver documentada (ou o contrário), se a sessão e os perfis (`x-perfis`) diferirem do `exigirSessao` da rota, ou se os limites da spec diferirem da validação dos services. Ele também falha se uma rota protegida não abrir a descrição com a linha **Perfis exigidos** (é o que o Swagger UI mostra; o `x-perfis` não aparece na tela) ou se algum erro fugir do schema `Erro`.

Para conferir a spec contra a API de verdade, com o servidor rodando em outro terminal:

```bash
npm run openapi:lint             # lint da spec com o Redocly (baixa a CLI na hora; regras em redocly.yaml)
npm run openapi:conferir         # compara status e corpos reais com os schemas, sem login
npm run openapi:conferir:sessao  # o mesmo e, com login nas contas de demonstração, os GETs por perfil
```

O `openapi:conferir` é **somente leitura** e só aceita host local: chama os GETs públicos com ids reais, inexistentes e inválidos e, sem cookie e sem corpo, as rotas protegidas (401). Nunca faz cadastro ou escrita, e a saída é uma tabela (rota, perfil, status, resultado, detalhe) com status e nomes de campos, não valores. Linhas `CODIGO` são divergências conhecidas do código, que não reprovam a conferência; linhas `FALHA` reprovam. Para outra porta, use `OPENAPI_CONFERIR_URL` (padrão `http://localhost:4000/api`).

O `openapi:conferir:sessao` entra **uma vez** em cada conta de demonstração do [README principal](../README.md#logins-de-demonstração) (comprador, artesão e admin; o login só lê o banco) e, com o cookie guardado só na memória, repete os GETs que dependem de sessão (`/auth/me`, `/recomendacoes`, `/pedidos` e `/painel/estatisticas`), esperando 200 ou 403 conforme o `x-perfis`. Se um login falhar, ele não tenta de novo, para não gastar o freio de 5 falhas. O cookie nunca vai em POST, PATCH ou DELETE, e não há logout (o cookie só expira).

## Senha das contas de artesão (`contas:artesao`)

`npm run contas:artesao` grava uma senha nos artesãos que estão no banco sem login (na carga de demonstração, 5 dos 6). O padrão é o dry-run, que só lista os nomes. Com `-- --aplicar`, grava a senha da `SENHA_ARTESAOS`, que é lida só do terminal. Em banco fora de localhost, exige também `--sim-eu-tenho-autorizacao`. No Neon do time, só o responsável pelo banco roda. Passo a passo em [`docs/estrategia-autenticacao.md`](../docs/estrategia-autenticacao.md), seção 13.

## Camadas

`routes/` → `middlewares/` → `controllers/` → `services/` → `repositories/`. Services e repositories não importam `express`; só os repositories falam com o banco. Detalhes e o mapa da migração em [`docs/arquitetura-backend.md`](../docs/arquitetura-backend.md).

Duas peças transversais, em memória e sem serviço externo:

- **Cache:** classe genérica em `src/utils/cacheMemoria.ts`; instância, chaves e invalidação em `src/services/cacheCatalogo.ts`; headers `X-Cache` e `Cache-Control` em `src/controllers/respostaCache.ts`. TTL por `CACHE_TTL_SEGUNDOS` (padrão 60 s, `0` desliga). Ver [`docs/cache.md`](../docs/cache.md).
- **Fila assíncrona:** fila e worker genéricos em `src/utils/filaAssincrona.ts`; caixa de notificações em `src/utils/notificacoesPedido.ts`; jobs de pedido em `src/services/filaAssincronaService.ts`, disparados pelo `pedidoController` depois do COMMIT; leitura em `GET /api/notificacoes` e `POST /api/notificacoes/ler`. Ver [`docs/processamento-assincrono.md`](../docs/processamento-assincrono.md).

### Evoluções Futuras (Pós-PI)

- Cache e fila compartilhados (por exemplo, Redis) se a API passar a rodar em mais de uma instância.
- Notificações persistidas em tabela, para sobreviver ao reinício do Render (exige migration nova, fora do escopo desta entrega).
- Levar mais repositories para o client do Prisma onde não houver ganho do SQL à mão, sem mudar services nem rotas.

## Lint

```bash
npm run lint
```

ESLint 10 com as regras recomendadas do ESLint e do typescript-eslint (sem regras de formatação), em `src/`, `test/`, `scripts/` e `prisma.config.ts`. O `src/generated` (client do Prisma) fica de fora. A configuração está em `eslint.config.mjs`.

O backend usa TypeScript **6.0** porque o typescript-eslint precisa da API JavaScript do compilador, que o TypeScript 7 (nativo) não tem. Antes de subir para o 7, confira se o typescript-eslint já dá suporte a ele.

## Testes

```bash
npm test
```

O `npm test` roda `scripts/rodar-testes.ts`, que lista os `test/**/*.test.ts` e chama o `tsx --test` com eles. Assim não depende de o shell expandir `*` e funciona no Node 20.19+ e no 22, no Windows (cmd e PowerShell) e no Linux. Arquivos passados como argumento substituem a lista (`npm test -- test/tokenSessao.test.ts` roda só esse), e as outras opções vão para o `node --test` (`npm test -- --test-name-pattern=JWT`, `npm test -- --test-reporter=spec`). Arquivo novo em `test/` terminado em `.test.ts` entra sozinho.

O `test/tokenSessao.test.ts` confere a compatibilidade com o `lib/sessao.ts` do front, que usa a `jose` instalada na raiz. Por isso o `npm test` e o `npm run typecheck` do backend precisam também do `npm install` na raiz do repositório.

Alguns testes unitários sem banco: `rankingRecomendacao.test.ts` (regra de pontuação das recomendações), `utilitarios.test.ts` (cookies, ids, query, limite, senha e `ErroHttp`), `artesaosFiltrosSemBanco.test.ts` (as rotas `/artesaos` e `/filtros` com um dublê do banco), `migrations.test.ts` (o `db/ddl_final.sql` em dia com as migrations) e `travaBanco.test.ts` (a trava que impede usar o banco do time).

Os testes de integração sobem o app numa porta livre e chamam as rotas de verdade. Sem configuração, rodam os testes que não usam banco (401, 403, 400, 404, spec x rotas, JWT, trava do banco). Os que usam banco aparecem como pulados, com um aviso dizendo quantos foram e como habilitar.

Os testes que gravam pedidos, produtos e usuários só rodam com `TEST_DATABASE_URL` apontando para um banco **descartável** carregado com `db/01`, `04`, `05`, `06` e `07`, ou com as migrations (`npm run db:migrar-descartavel`) mais as cargas `05` e `07` (seção [Migrations](#migrations)). A suíte completa passa nos dois casos (PI4-147). **Nunca** aponte para o Neon do time. A variável vai **no terminal**, não no `backend/.env` (os testes não leem o `.env` para ela):

```bash
# cmd
set TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/raizes_teste
# PowerShell
$env:TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/raizes_teste"
npm test
```

Trava (`scripts/travaBanco.ts`, usada por `test/ajudantes.ts` e pelos scripts de banco descartável): os testes abortam se a `TEST_DATABASE_URL` for o mesmo banco (host sem `-pooler`, porta e nome; a query é ignorada) de alguma `DATABASE_URL` ou `DIRECT_URL` do ambiente, do `backend/.env` ou do `.env.local`/`.env` da raiz. Para host que não seja `localhost`, `127.0.0.1` ou `::1` (por exemplo, uma branch do Neon criada só para testes), defina também `TEST_DB_REMOTO_DESCARTAVEL=1`. A suíte de pedidos e produtos apaga, no fim, o que criou e restaura o estoque. A de auth ainda deixa as contas de cadastro criadas.
