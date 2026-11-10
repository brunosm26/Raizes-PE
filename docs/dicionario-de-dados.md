# Dicionário de dados do schema `origem`

Banco de dados do marketplace Origem (front Raízes PE). PostgreSQL, schema `origem`, 8 tabelas, 1 view, 2 perfis de acesso.

Este documento descreve o estado final do schema, resultado da execução dos scripts `db/01_ddl_origem.sql`, `db/04_migracao_front.sql`, `db/06_imagem_produto.sql` e `db/07_autenticacao.sql`. Foi conferido contra um banco criado a partir desses scripts (seção 9). Se o schema mudar, atualize este arquivo junto com o script.

## 1. Convenções

| Item | Regra |
|---|---|
| Nomes | minúsculas, sem acento, `snake_case`, tabelas no singular |
| Chave primária | `pk_<tabela>` (sempre `id`, UUID gerado por `gen_random_uuid()`) |
| Chave estrangeira | `fk_<tabela>_<referenciada>` |
| Unicidade | `uq_<tabela>_<colunas>` |
| Check | `ck_<tabela>_<regra>` |
| Índice | `idx_<tabela>_<colunas>` |
| Trigger | `trg_<tabela>_<regra>` |
| Função | `fn_<finalidade>` |
| Datas | tipo `DATE` (sem hora), padrão `CURRENT_DATE` |
| Dinheiro | `NUMERIC(10,2)`, em reais, nunca `FLOAT` |

Legenda das tabelas de colunas: **PK** chave primária, **FK** chave estrangeira, **UQ** único, **Obrig.** indica se a coluna aceita nulo (Sim = `NOT NULL`).

## 2. Visão geral dos relacionamentos

```
usuario 1 ── 0..1 artesao 1 ── 0..N produto
usuario 1 ── 0..N pedido 1 ── 1..N item_pedido N ── 1 produto
usuario 1 ── 0..N avaliacao N ── 1 produto
usuario 1 ── 0..1 carrinho 1 ── 0..N item_carrinho N ── 1 produto
```

| Tabela filha | Coluna | Tabela pai | Ao apagar o pai | Ao alterar o id do pai |
|---|---|---|---|---|
| `artesao` | `usuario_id` | `usuario` | RESTRICT | CASCADE |
| `produto` | `artesao_id` | `artesao` | RESTRICT | CASCADE |
| `pedido` | `comprador_id` | `usuario` | RESTRICT | CASCADE |
| `item_pedido` | `pedido_id` | `pedido` | CASCADE | CASCADE |
| `item_pedido` | `produto_id` | `produto` | RESTRICT | CASCADE |
| `avaliacao` | `produto_id` | `produto` | CASCADE | CASCADE |
| `avaliacao` | `comprador_id` | `usuario` | RESTRICT | CASCADE |
| `carrinho` | `comprador_id` | `usuario` | CASCADE | CASCADE |
| `item_carrinho` | `carrinho_id` | `carrinho` | CASCADE | CASCADE |
| `item_carrinho` | `produto_id` | `produto` | CASCADE | CASCADE |

RESTRICT impede apagar um registro que ainda é referenciado (por exemplo, um produto que já foi vendido). CASCADE apaga junto os registros dependentes.

## 3. Domínios de valores (enums)

O schema **não usa tipos `ENUM` do PostgreSQL**. Os conjuntos fechados de valores são `VARCHAR` com restrição `CHECK`, o que facilita mudar a lista sem recriar tipos. O Prisma as lê como `String`.

| Coluna | Valores permitidos | Restrição | Significado |
|---|---|---|---|
| `usuario.tipo` | `comprador`, `artesao`, `admin` | `ck_usuario_tipo` | Papel do usuário na plataforma |
| `pedido.status` | `pendente`, `pago`, `enviado`, `entregue` | `ck_pedido_status` | Etapa do pedido (padrão `pendente`) |
| `avaliacao.nota` | inteiros de 1 a 5 | `ck_avaliacao_nota` | Nota do produto |

Valores de `usuario.tipo`:

| Valor | Quem é | Pode |
|---|---|---|
| `comprador` | quem compra | fazer pedidos e avaliações, ter carrinho |
| `artesao` | quem vende | ter registro em `artesao` e cadastrar produtos |
| `admin` | administração | gerir a plataforma; não tem registro em `artesao` nem faz pedidos |

Valores de `pedido.status`:

| Valor | Significado | Conta como venda na view de popularidade |
|---|---|---|
| `pendente` | pedido criado, ainda sem pagamento | não |
| `pago` | pagamento confirmado | sim |
| `enviado` | despachado ao comprador | sim |
| `entregue` | recebido pelo comprador | sim |

Colunas de texto livre que o front trata como lista fixa, mas que **não** têm restrição no banco: `produto.tecnica` (Cerâmica, Têxtil, Madeira, Renda e Bordado, Palha), `produto.categoria` e `artesao.regiao_origem`. Quem garante os valores é a aplicação.

## 4. Tabelas

### 4.1 `usuario`

Pessoa cadastrada na plataforma, como comprador, artesão ou admin.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador do usuário |
| `nome` | `varchar(150)` | Sim | | | Nome completo; não pode ser vazio ou só espaços |
| `email` | `varchar(150)` | Sim | | UQ | E-mail de login; precisa ter `@` depois do primeiro caractere |
| `tipo` | `varchar(20)` | Sim | | | Papel: `comprador`, `artesao` ou `admin` (seção 3) |
| `data_cadastro` | `date` | Sim | `CURRENT_DATE` | | Dia em que o usuário foi criado |
| `senha_hash` | `varchar(200)` | Não | | | Hash scrypt da senha, no formato `scrypt$N$r$p$sal$hash`. Nulo significa sem acesso ao login. A senha nunca é guardada em texto (script 07) |

Restrições: `pk_usuario`, `uq_usuario_email`, `ck_usuario_tipo`, `ck_usuario_nome_preenchido`, `ck_usuario_email_formato`.

### 4.2 `artesao`

Especialização de `usuario`: dados próprios de quem vende. Um usuário do tipo `artesao` tem exatamente um registro aqui.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador do artesão (diferente do id do usuário) |
| `usuario_id` | `uuid` | Sim | | FK, UQ | Usuário dono do perfil, em `usuario.id`. Único: um usuário só tem um perfil de artesão |
| `regiao_origem` | `varchar(100)` | Não | | | Polo de origem, por exemplo Alto do Moura, Tracunhaem ou Pilar |
| `biografia` | `text` | Não | | | Texto de apresentação mostrado no perfil público |

Restrições: `pk_artesao`, `uq_artesao_usuario`, `fk_artesao_usuario`. O trigger `trg_artesao_tipo_usuario` exige que o usuário seja do tipo `artesao`.

### 4.3 `produto`

Peça artesanal do catálogo, pertencente a um artesão.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador do produto |
| `artesao_id` | `uuid` | Sim | | FK | Artesão que vende o produto, em `artesao.id` |
| `nome` | `varchar(150)` | Sim | | | Nome exibido na vitrine; não pode ser vazio |
| `tecnica` | `varchar(100)` | Não | | | Técnica artesanal empregada (insumo do RF-01, recomendação) |
| `categoria` | `varchar(100)` | Não | | | Categoria usada no filtro da vitrine |
| `preco` | `numeric(10,2)` | Sim | | | Preço unitário atual em reais; zero ou maior |
| `estoque_qtd` | `integer` | Sim | `0` | | Quantidade disponível em estoque; zero ou maior |
| `data_cadastro` | `date` | Sim | `CURRENT_DATE` | | Dia em que o produto foi cadastrado (RF-05, produtos recentes) |
| `descricao` | `text` | Não | | | Texto de apresentação exibido na vitrine (script 04) |
| `imagem_url` | `text` | Não | | | Caminho, URL ou data URL (base64, até cerca de 2 MB) da foto enviada pelo artesão. Vazio usa o padrão visual da técnica (scripts 04 e 06) |

Restrições: `pk_produto`, `fk_produto_artesao`, `ck_produto_nome_preenchido`, `ck_produto_preco` (preço maior ou igual a 0), `ck_produto_estoque` (estoque maior ou igual a 0), `ck_produto_imagem_tamanho` (se houver imagem, no máximo 2.800.000 caracteres).

### 4.4 `pedido`

Compra realizada por um comprador. Os itens ficam em `item_pedido`.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador do pedido |
| `comprador_id` | `uuid` | Sim | | FK | Comprador que fez o pedido, em `usuario.id` |
| `data_pedido` | `date` | Sim | `CURRENT_DATE` | | Dia em que o pedido foi feito |
| `status` | `varchar(20)` | Sim | `'pendente'` | | Situação: `pendente`, `pago`, `enviado` ou `entregue` (seção 3) |
| `valor_total` | `numeric(10,2)` | Sim | | | Dado derivado: soma de `quantidade x preco_unitario` dos itens, conferida no COMMIT (RN-05); zero ou maior |

Restrições: `pk_pedido`, `fk_pedido_usuario`, `ck_pedido_status`, `ck_pedido_valor_total`. Triggers: `trg_pedido_tipo_usuario` (só comprador faz pedido) e `trg_pedido_confere` (integridade do total, seção 6).

### 4.5 `item_pedido`

Linha de um pedido, ligando o pedido a um produto.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador do item |
| `pedido_id` | `uuid` | Sim | | FK | Pedido a que o item pertence, em `pedido.id` |
| `produto_id` | `uuid` | Sim | | FK | Produto comprado, em `produto.id` |
| `quantidade` | `integer` | Sim | | | Unidades compradas; maior que 0 |
| `preco_unitario` | `numeric(10,2)` | Sim | | | Preço do produto no momento da compra (RN-05); não muda se o preço do produto mudar depois; zero ou maior |

Restrições: `pk_item_pedido`, `fk_item_pedido_pedido`, `fk_item_pedido_produto`, `ck_item_pedido_quantidade`, `ck_item_pedido_preco_unitario`. Trigger: `trg_item_pedido_confere`.

### 4.6 `avaliacao`

Nota de 1 a 5 que um comprador atribui a um produto.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador da avaliação |
| `produto_id` | `uuid` | Sim | | FK, UQ | Produto avaliado, em `produto.id` |
| `comprador_id` | `uuid` | Sim | | FK, UQ | Comprador que avaliou, em `usuario.id` |
| `nota` | `integer` | Sim | | | Nota de 1 a 5 |
| `data_avaliacao` | `date` | Sim | `CURRENT_DATE` | | Dia da avaliação |

Restrições: `pk_avaliacao`, `fk_avaliacao_produto`, `fk_avaliacao_usuario`, `ck_avaliacao_nota`, `uq_avaliacao_produto_comprador` (RN-06: um comprador avalia o mesmo produto uma única vez; o par `produto_id` + `comprador_id` é único). Trigger: `trg_avaliacao_tipo_usuario`.

### 4.7 `carrinho`

Carrinho de compras de um comprador, antes de fechar o pedido. Cada comprador tem no máximo um.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador do carrinho |
| `comprador_id` | `uuid` | Sim | | FK, UQ | Dono do carrinho, em `usuario.id`. Único: um carrinho por comprador |
| `data_criacao` | `date` | Sim | `CURRENT_DATE` | | Dia em que o carrinho foi criado |

Restrições: `pk_carrinho`, `uq_carrinho_comprador`, `fk_carrinho_usuario`. Trigger: `trg_carrinho_tipo_usuario`.

### 4.8 `item_carrinho`

Produto colocado em um carrinho.

| Coluna | Tipo | Obrig. | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id` | `uuid` | Sim | `gen_random_uuid()` | PK | Identificador do item |
| `carrinho_id` | `uuid` | Sim | | FK, UQ | Carrinho que contém o item, em `carrinho.id` |
| `produto_id` | `uuid` | Sim | | FK, UQ | Produto adicionado, em `produto.id` |
| `quantidade` | `integer` | Sim | | | Unidades no carrinho; maior que 0 |

Restrições: `pk_item_carrinho`, `fk_item_carrinho_carrinho`, `fk_item_carrinho_produto`, `ck_item_carrinho_quantidade`, `uq_item_carrinho_carrinho_produto` (o mesmo produto aparece uma vez por carrinho).

## 5. View `vw_popularidade_produto`

Consumida pelo módulo de recomendação (RF-03). Tem uma linha para cada produto, mesmo sem vendas nem avaliações.

| Coluna | Tipo | Aceita nulo | Descrição |
|---|---|---|---|
| `produto_id` | `uuid` | Não | Produto, vindo de `produto.id` |
| `qtd_vendida` | `integer` | Não | Soma das `quantidade` de `item_pedido` em pedidos cujo status é diferente de `pendente`; 0 se nunca vendeu |
| `total_avaliacoes` | `integer` | Não | Quantidade de avaliações do produto; 0 se não tem |
| `nota_media` | `numeric` | Sim | Média das notas, com 2 casas decimais; **nulo** quando o produto ainda não foi avaliado |

A view roda com os direitos do dono do banco. Assim, o perfil `origem_recomendacao` lê só o agregado e nunca enxerga dados de compradores ou de pedidos.

## 6. Regras no banco (triggers e funções)

| Regra | Objeto | O que faz |
|---|---|---|
| RN-02 | `trg_artesao_tipo_usuario` | Só usuário do tipo `artesao` pode ter registro em `artesao` |
| RN-03 | `trg_pedido_tipo_usuario`, `trg_avaliacao_tipo_usuario`, `trg_carrinho_tipo_usuario` | Só usuário do tipo `comprador` faz pedido, avalia produto e tem carrinho |
| tipo estável | `trg_usuario_protege_tipo` | Impede trocar o `tipo` de um usuário que já tem artesão, pedido, avaliação ou carrinho vinculado |
| RN-05 | `trg_pedido_confere`, `trg_item_pedido_confere` | No COMMIT, confere que o pedido tem ao menos um item e que `valor_total` é igual à soma de `quantidade x preco_unitario` |

Funções: `fn_exige_tipo_usuario()`, `fn_protege_mudanca_tipo()`, `fn_confere_pedido(uuid)`, `fn_trg_pedido()` e `fn_trg_item_pedido()`.

Atenção: a conferência do pedido é **adiada para o fim da transação** (`DEFERRABLE INITIALLY DEFERRED`). Pedido e itens precisam ser gravados na mesma transação (`BEGIN; INSERT pedido; INSERT item_pedido; COMMIT;`), senão o COMMIT falha.

## 7. Índices

As chaves primárias e as restrições `UNIQUE` já criam índice automaticamente. Índices adicionais:

| Índice | Tabela | Colunas | Para que serve |
|---|---|---|---|
| `idx_artesao_regiao_origem` | `artesao` | `regiao_origem` | Filtro por polo (RF-02) |
| `idx_produto_artesao_id` | `produto` | `artesao_id` | Chave estrangeira e produtos do artesão (RF-02) |
| `idx_produto_tecnica` | `produto` | `tecnica` | Produtos relacionados (RF-01) |
| `idx_produto_categoria` | `produto` | `categoria` | Filtro da vitrine |
| `idx_produto_data_cadastro` | `produto` | `data_cadastro` decrescente | Produtos recentes (RF-05) |
| `idx_pedido_comprador_id` | `pedido` | `comprador_id` | Histórico do comprador |
| `idx_item_pedido_pedido_id` | `item_pedido` | `pedido_id` | Chave estrangeira e soma do pedido |
| `idx_item_pedido_produto_id` | `item_pedido` | `produto_id` | Vendas por produto (RF-03) |
| `idx_avaliacao_comprador_id` | `avaliacao` | `comprador_id` | Chave estrangeira |
| `idx_item_carrinho_produto_id` | `item_carrinho` | `produto_id` | Chave estrangeira |

## 8. Perfis de acesso

Criados sem login (`NOLOGIN`). Em produção, o administrador do banco cria os usuários reais e os associa a esses perfis, com a senha definida fora do repositório.

| Perfil | Quem usa | Permissões |
|---|---|---|
| `origem_app` | Backend do marketplace | `SELECT`, `INSERT`, `UPDATE`, `DELETE` em todas as tabelas do schema |
| `origem_recomendacao` | Módulo de IA | Somente `SELECT` em `produto`, `artesao` e `vw_popularidade_produto`; sem acesso a `usuario`, `pedido`, `avaliacao` e `carrinho` |

## 9. Como este dicionário foi conferido

1. Um PostgreSQL 16 vazio recebeu os scripts `01`, `04`, `06` e `07`, nessa ordem.
2. Tabelas, colunas, tipos, obrigatoriedade, padrões, chaves, restrições, índices, triggers e comentários foram lidos do catálogo do banco (`information_schema`, `pg_constraint`, `pg_indexes`) e comparados com as seções 4 a 7.
3. Resultado: 8 tabelas, 42 colunas, 8 chaves primárias, 10 chaves estrangeiras, 13 restrições `CHECK`, 5 `UNIQUE`, 10 índices próprios, 7 triggers e 1 view, todos cobertos aqui.

Para conferir o banco real do projeto (Neon), rode no SQL Editor e compare com as tabelas acima. A coluna `descricao`, `imagem_url` e `senha_hash` só existem se os scripts 04, 06 e 07 foram aplicados:

```sql
SELECT table_name, ordinal_position, column_name, data_type, character_maximum_length, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'origem'
   AND table_name IN (SELECT table_name FROM information_schema.tables
                       WHERE table_schema = 'origem' AND table_type = 'BASE TABLE')
 ORDER BY table_name, ordinal_position;
```

O resultado deve ter 42 linhas. As conferências de integridade ficam em `db/validacao_resumo.sql`.
