# Pasta `db/`

Scripts SQL do banco do marketplace (schema `origem`).

## Fonte da verdade do DDL: as migrations

Desde a PI4-147, a estrutura do banco é definida pelas **migrations do Prisma** em [`backend/prisma/migrations`](../backend/prisma/migrations):

- `0_init`: gerada do `schema.prisma`, com tabelas, colunas, PK, FK e índices.
- `1_regras_sql`: o que o Prisma não expressa (CHECK, gatilhos, funções, view, perfis de acesso e comentários).

Mudança de estrutura entra como uma **nova migration**, nunca como um script novo nesta pasta. Veja [`backend/README.md`, seção Migrations](../backend/README.md#migrations).

## `ddl_final.sql` (gerado)

`ddl_final.sql` recria o schema `origem` do zero, **sem dados**, em SQL puro e numa única transação. É gerado a partir das migrations, na ordem:

```bash
cd backend
npm run db:ddl                 # regenera
npm run db:ddl -- --conferir   # só confere se está atualizado
```

Não edite à mão. O teste `backend/test/migrations.test.ts` falha se o arquivo divergir das migrations. Para usar, rode num banco vazio e descartável: `psql -v ON_ERROR_STOP=1 -f db/ddl_final.sql`.

## Carga de demonstração (continua aqui)

Os scripts de dados continuam sendo a carga de demonstração e podem ser aplicados por cima das migrations ou do `ddl_final.sql`:

| Arquivo | O que faz |
|---|---|
| `05_dados_raizes_pe.sql` | **Apaga** os dados e carrega o catálogo do front: 9 usuários, 6 artesãos, 7 produtos, 3 pedidos (5 itens), 6 avaliações, 1 carrinho (2 itens) |
| `07_autenticacao.sql` | Define a senha dos 3 logins de demonstração. Como a coluna `senha_hash` já existe, a parte de estrutura não faz nada. Rode depois do `05`, que recria os usuários |
| `02_dados_exemplo_origem.sql` | Amostra maior do modelo físico, alternativa ao `05` (o `05` apaga o que o `02` carregou) |

## Histórico e conferência

- `01_ddl_origem.sql`, `04_migracao_front.sql`, `06_imagem_produto.sql` e a parte de estrutura do `07` montaram o banco do time (Neon) e ficam como **histórico**. Rodados em ordem num banco vazio (`01`, `04`, `05`, `06`, `07`), chegam ao mesmo schema das migrations. O comparador `npm run db:comparar` (no `backend/`) não mostra nenhuma diferença.
- `validacao_resumo.sql`: 8 conferências em que `esperado` deve ser igual a `obtido`.
- `03_consultas_validacao_origem.sql`: consultas de recomendação e conferências para rodar à mão.

> **O banco do time é compartilhado.** Não rode nenhum script desta pasta nem as migrations no Neon sem combinar com o responsável pelo banco. O `05` apaga dados.
