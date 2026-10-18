-- =====================================================================
-- ORIGEM | MODELO FÍSICO | 03 - CONSULTAS DE VALIDAÇÃO
-- Pré-requisito: 01_ddl_origem.sql, 04_migracao_front.sql, 05_dados_raizes_pe.sql,
--               06_imagem_produto.sql e 07_autenticacao.sql (ordem de execução).
-- Dados de referência: a carga 05 (os 7 produtos da vitrine Raízes PE). Para validar
-- com a carga 02 (amostra maior), troque os ids de referência de A1, A2 e A4.
--
-- Bloco A: consultas que o módulo de recomendação executa (RF-01, RF-02,
--          RF-03 e RF-05). O produto de referência é o "Vaso de Cerâmica
--          Maragogi" (id ...0001). Troque o id para testar outros.
-- Bloco B: conferências de integridade (cada uma deve retornar 0 linhas).
-- =====================================================================

SET client_encoding TO 'UTF8';
SET search_path TO origem;

-- ---------------------------------------------------------------------
-- A1. RF-01: mesma técnica do produto de referência
-- ---------------------------------------------------------------------
SELECT p.nome, p.tecnica, pop.qtd_vendida, pop.total_avaliacoes, pop.nota_media
  FROM produto ref
  JOIN produto p ON p.tecnica = ref.tecnica AND p.id <> ref.id
  JOIN vw_popularidade_produto pop ON pop.produto_id = p.id
 WHERE ref.id = '30000000-0000-4000-8000-000000000001'
 ORDER BY pop.qtd_vendida DESC, pop.total_avaliacoes DESC, p.nome
 LIMIT 5;

-- ---------------------------------------------------------------------
-- A2. RF-02: mesma região de origem do produto de referência
-- ---------------------------------------------------------------------
SELECT p.nome, a.regiao_origem, pop.qtd_vendida, pop.total_avaliacoes
  FROM produto ref
  JOIN artesao a_ref ON a_ref.id = ref.artesao_id
  JOIN artesao a ON a.regiao_origem = a_ref.regiao_origem
  JOIN produto p ON p.artesao_id = a.id AND p.id <> ref.id
  JOIN vw_popularidade_produto pop ON pop.produto_id = p.id
 WHERE ref.id = '30000000-0000-4000-8000-000000000001'
 ORDER BY pop.qtd_vendida DESC, pop.total_avaliacoes DESC, p.nome
 LIMIT 5;

-- ---------------------------------------------------------------------
-- A3. RF-03: popularidade geral (vendas e avaliações)
-- ---------------------------------------------------------------------
SELECT p.nome, pop.qtd_vendida, pop.total_avaliacoes, pop.nota_media
  FROM vw_popularidade_produto pop
  JOIN produto p ON p.id = pop.produto_id
 ORDER BY pop.qtd_vendida DESC, pop.total_avaliacoes DESC, p.nome
 LIMIT 5;

-- ---------------------------------------------------------------------
-- A4. RF-05: cold start, produtos mais recentes da mesma técnica
-- Produto de referência: "Jarro de Cerâmica Fosco" (id ...0006), nunca comprado
-- ---------------------------------------------------------------------
SELECT p.nome, p.tecnica, p.data_cadastro
  FROM produto ref
  JOIN produto p ON p.tecnica = ref.tecnica AND p.id <> ref.id
 WHERE ref.id = '30000000-0000-4000-8000-000000000006'
 ORDER BY p.data_cadastro DESC, p.nome
 LIMIT 5;

-- ---------------------------------------------------------------------
-- B1. Pedidos cujo valor_total difere da soma dos itens (esperado: 0)
-- ---------------------------------------------------------------------
SELECT pe.id, pe.valor_total, SUM(ip.quantidade * ip.preco_unitario) AS soma_itens
  FROM pedido pe
  JOIN item_pedido ip ON ip.pedido_id = pe.id
 GROUP BY pe.id, pe.valor_total
HAVING pe.valor_total <> SUM(ip.quantidade * ip.preco_unitario);

-- ---------------------------------------------------------------------
-- B2. Pedidos sem nenhum item (esperado: 0)
-- ---------------------------------------------------------------------
SELECT pe.id
  FROM pedido pe
  LEFT JOIN item_pedido ip ON ip.pedido_id = pe.id
 WHERE ip.id IS NULL;

-- ---------------------------------------------------------------------
-- B3. Artesãos vinculados a usuário que não é do tipo 'artesao' (esperado: 0)
-- ---------------------------------------------------------------------
SELECT a.id
  FROM artesao a
  JOIN usuario u ON u.id = a.usuario_id
 WHERE u.tipo <> 'artesao';

-- ---------------------------------------------------------------------
-- B4. Usuários 'artesao' sem registro em artesao (esperado: 0)
-- ---------------------------------------------------------------------
SELECT u.id
  FROM usuario u
  LEFT JOIN artesao a ON a.usuario_id = u.id
 WHERE u.tipo = 'artesao' AND a.id IS NULL;

-- ---------------------------------------------------------------------
-- B5. Pedidos, avaliações ou carrinhos de quem não é 'comprador' (esperado: 0)
-- ---------------------------------------------------------------------
SELECT 'pedido' AS origem, pe.id FROM pedido pe JOIN usuario u ON u.id = pe.comprador_id WHERE u.tipo <> 'comprador'
UNION ALL
SELECT 'avaliacao', av.id FROM avaliacao av JOIN usuario u ON u.id = av.comprador_id WHERE u.tipo <> 'comprador'
UNION ALL
SELECT 'carrinho', c.id FROM carrinho c JOIN usuario u ON u.id = c.comprador_id WHERE u.tipo <> 'comprador';

-- ---------------------------------------------------------------------
-- Bloco C: conferências da estrutura publicada (esperado indicado em cada uma)
-- ---------------------------------------------------------------------
-- C1. Tabelas do esquema origem (esperado: 8)
SELECT count(*) AS tabelas
  FROM information_schema.tables
 WHERE table_schema = 'origem' AND table_type = 'BASE TABLE';

-- C2. Colunas acrescentadas pelas migrações 04, 06 e 07 (esperado: 3 linhas)
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'origem'
   AND ((table_name = 'produto' AND column_name IN ('descricao', 'imagem_url'))
     OR (table_name = 'usuario' AND column_name = 'senha_hash'))
 ORDER BY table_name, column_name;

-- C3. View de popularidade existe (esperado: 1)
SELECT count(*) AS views
  FROM information_schema.views
 WHERE table_schema = 'origem' AND table_name = 'vw_popularidade_produto';

-- C4. Volume de dados por tabela (carga 05: 9 usuários, 6 artesãos, 7 produtos,
--     3 pedidos, 5 itens de pedido, 6 avaliações; pedidos novos aumentam os dois últimos)
SELECT 'usuario' AS tabela, count(*) AS linhas FROM usuario
UNION ALL SELECT 'artesao', count(*) FROM artesao
UNION ALL SELECT 'produto', count(*) FROM produto
UNION ALL SELECT 'pedido', count(*) FROM pedido
UNION ALL SELECT 'item_pedido', count(*) FROM item_pedido
UNION ALL SELECT 'avaliacao', count(*) FROM avaliacao;
