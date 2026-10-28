-- =====================================================================
-- ORIGEM | 05 - DADOS DO FRONT-END (Raízes PE)
-- Pré-requisito: 01_ddl_origem.sql e 04_migracao_front.sql.
--
-- ATENÇÃO: este script APAGA os dados de exemplo anteriores (02) e carrega
-- o catálogo que o front-end usa hoje (lib/dadosFalsos.ts): 9 usuários,
-- 6 artesãos, 7 produtos, 3 pedidos, 6 avaliações.
-- Os ids do front ("u1", "p1"...) viram UUIDs. Tudo roda em uma transação.
-- =====================================================================
SET client_encoding TO 'UTF8';
SET search_path TO origem;

BEGIN;

DELETE FROM item_carrinho;
DELETE FROM carrinho;
DELETE FROM avaliacao;
DELETE FROM pedido;      -- os itens saem junto (ON DELETE CASCADE)
DELETE FROM produto;
DELETE FROM artesao;
DELETE FROM usuario;

INSERT INTO usuario (id, nome, email, tipo, data_cadastro) VALUES
 ('10000000-0000-4000-8000-000000000001', 'Vitalino Neto', 'vitalino@raizespe.dev', 'artesao', '2025-02-10'),
 ('10000000-0000-4000-8000-000000000002', 'Cooperativa de Tacaratu', 'tacaratu@raizespe.dev', 'artesao', '2025-01-22'),
 ('10000000-0000-4000-8000-000000000003', 'José Bezerra', 'jbezerra@raizespe.dev', 'artesao', '2025-03-05'),
 ('10000000-0000-4000-8000-000000000004', 'Marlene Costa', 'marlene@raizespe.dev', 'artesao', '2025-02-28'),
 ('10000000-0000-4000-8000-000000000005', 'Raimundo Silva', 'raimundo@raizespe.dev', 'artesao', '2025-04-01'),
 ('10000000-0000-4000-8000-000000000006', 'Ateliê Barro Vivo', 'barrovivo@raizespe.dev', 'artesao', '2025-03-18'),
 ('10000000-0000-4000-8000-000000000007', 'Ana Beatriz', 'ana.beatriz@raizespe.dev', 'comprador', '2025-05-02'),
 ('10000000-0000-4000-8000-000000000008', 'Carlos Andrade', 'carlos.andrade@raizespe.dev', 'comprador', '2025-05-14'),
 ('10000000-0000-4000-8000-000000000009', 'Administração Raízes PE', 'admin@raizespe.dev', 'admin', '2025-01-01');

INSERT INTO artesao (id, usuario_id, regiao_origem, biografia) VALUES
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Alto do Moura, Caruaru', 'Ceramista da família Vitalino, quinta geração. Trabalha com peças figurativas e utilitárias, herdando técnicas passadas pelo avô.'),
 ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Tacaratu', 'Cooperativa têxtil com 12 artesãs associadas, especializada em tear manual e tingimento natural.'),
 ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Garanhuns', 'Escultor em madeira, trabalha com reaproveitamento de troncos e reconhecido pelas peças de fauna nordestina.'),
 ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'Tracunhaém', 'Rendeira de bilro, aprendeu o ofício com a avó e hoje ensina o ponto a jovens da comunidade.'),
 ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'Comunidade do Pilar', 'Trabalha com trançados de palha há mais de 20 anos, com peças utilitárias e de decoração.'),
 ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'Alto do Moura, Caruaru', 'Ateliê coletivo de cerâmica fosca contemporânea, unindo técnica tradicional a acabamentos modernos.');

INSERT INTO produto (id, artesao_id, nome, descricao, tecnica, categoria, preco, estoque_qtd, data_cadastro, imagem_url) VALUES
 ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Vaso de Cerâmica Maragogi', 'Vaso torneado à mão em argila local, com acabamento em duas cores e queima em forno a lenha. Cada peça é única, com pequenas variações de tom.', 'Cerâmica', 'Decoração', 185.00, 8, '2025-06-01', '/produtos/p1.svg'),
 ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Tapete Tear Manual', 'Tapete tecido em tear manual de madeira, com algodão cru e tingimento natural à base de plantas da região.', 'Têxtil', 'Casa', 320.00, 8, '2025-05-20', '/produtos/p2.svg'),
 ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Escultura em Madeira - Leão', 'Escultura entalhada em tronco de umburana reaproveitado, inspirada na fauna do sertão pernambucano.', 'Madeira', 'Decoração', 410.00, 3, '2025-05-11', '/produtos/p3.svg'),
 ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'Renda de Bilro Flor do Agreste', 'Renda de bilro trabalhada fio a fio, com padrão floral tradicional de Tracunhaém.', 'Renda e Bordado', 'Vestuário', 95.00, 15, '2025-06-10', '/produtos/p4.svg'),
 ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'Cesto de Palha Trançada', 'Cesto trançado à mão em palha de carnaúba, ideal para organização ou decoração.', 'Palha', 'Casa', 68.00, 20, '2025-06-15', '/produtos/p5.svg'),
 ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'Jarro de Cerâmica Fosco', 'Jarro de cerâmica com acabamento fosco contemporâneo, mantendo a técnica de modelagem manual tradicional.', 'Cerâmica', 'Decoração', 210.00, 6, '2025-06-18', '/produtos/p6.svg'),
 ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', 'Manta de Algodão Cru', 'Manta tecida em algodão cru não tingido, macia e respirável, feita sob encomenda pela cooperativa.', 'Têxtil', 'Casa', 275.00, 5, '2025-06-20', '/produtos/p7.svg');

-- pedido e itens na mesma transação (o banco confere itens e valor_total no COMMIT)
INSERT INTO pedido (id, comprador_id, data_pedido, status, valor_total) VALUES
 ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', '2025-07-02', 'entregue', 185.00),
 ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000008', '2025-07-05', 'pago', 363.00),
 ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000007', '2025-07-09', 'pendente', 320.00);

INSERT INTO item_pedido (id, pedido_id, produto_id, quantidade, preco_unitario) VALUES
 ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1, 185.00),
 ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', 1, 95.00),
 ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005', 1, 68.00),
 ('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006', 1, 200.00),
 ('50000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 1, 320.00);

INSERT INTO avaliacao (id, produto_id, comprador_id, nota, data_avaliacao) VALUES
 ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 5, '2025-07-06'),
 ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 4, '2025-07-20'),
 ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000008', 4, '2025-06-01'),
 ('60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000008', 5, '2025-07-10'),
 ('60000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000007', 5, '2025-07-22'),
 ('60000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000007', 4, '2025-07-25');

INSERT INTO carrinho (id, comprador_id, data_criacao) VALUES
 ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', '2025-07-15');

INSERT INTO item_carrinho (id, carrinho_id, produto_id, quantidade) VALUES
 ('80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 1),
 ('80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000006', 2);

COMMIT;
