SET search_path TO origem;
SELECT 'B1 pedidos com total diferente da soma dos itens' AS conferencia, 0 AS esperado,
       (SELECT count(*) FROM (SELECT pe.id FROM pedido pe JOIN item_pedido ip ON ip.pedido_id = pe.id
         GROUP BY pe.id, pe.valor_total HAVING pe.valor_total <> SUM(ip.quantidade * ip.preco_unitario)) x) AS obtido
UNION ALL SELECT 'B2 pedidos sem item', 0,
       (SELECT count(*) FROM pedido pe WHERE NOT EXISTS (SELECT 1 FROM item_pedido ip WHERE ip.pedido_id = pe.id))
UNION ALL SELECT 'B3 artesao ligado a usuario de outro tipo', 0,
       (SELECT count(*) FROM artesao a JOIN usuario u ON u.id = a.usuario_id WHERE u.tipo <> 'artesao')
UNION ALL SELECT 'B4 usuario artesao sem registro em artesao', 0,
       (SELECT count(*) FROM usuario u WHERE u.tipo = 'artesao' AND NOT EXISTS (SELECT 1 FROM artesao a WHERE a.usuario_id = u.id))
UNION ALL SELECT 'B5 pedido/avaliacao/carrinho de quem nao e comprador', 0,
       (SELECT count(*) FROM pedido pe JOIN usuario u ON u.id = pe.comprador_id WHERE u.tipo <> 'comprador')
     + (SELECT count(*) FROM avaliacao av JOIN usuario u ON u.id = av.comprador_id WHERE u.tipo <> 'comprador')
     + (SELECT count(*) FROM carrinho c JOIN usuario u ON u.id = c.comprador_id WHERE u.tipo <> 'comprador')
UNION ALL SELECT 'C1 tabelas no esquema origem', 8,
       (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'origem' AND table_type = 'BASE TABLE')
UNION ALL SELECT 'C2 colunas das migracoes 04, 06 e 07', 3,
       (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'origem'
          AND ((table_name = 'produto' AND column_name IN ('descricao', 'imagem_url')) OR (table_name = 'usuario' AND column_name = 'senha_hash')))
UNION ALL SELECT 'C3 view vw_popularidade_produto', 1,
       (SELECT count(*) FROM information_schema.views WHERE table_schema = 'origem' AND table_name = 'vw_popularidade_produto');
