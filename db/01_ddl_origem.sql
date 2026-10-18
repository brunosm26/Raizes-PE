-- =====================================================================
-- ORIGEM | MODELO FÍSICO | 01 - DDL
-- SGBD: PostgreSQL 13 ou superior (testado na versão 18.6)
-- Origem: Modelo Lógico do projeto Origem (8 tabelas, 1 para 1 com o ER)
--
-- Ordem de execução dos scripts:
--   01_ddl_origem.sql              estrutura (este arquivo)
--   02_dados_exemplo_origem.sql    carga de dados de exemplo
--   03_consultas_validacao_origem.sql   consultas de recomendação e conferências
--
-- Convenções de nomenclatura:
--   tabelas e colunas : minúsculas, sem acento, snake_case, singular
--   chave primária    : pk_<tabela>
--   chave estrangeira : fk_<tabela>_<referenciada>
--   unicidade         : uq_<tabela>_<colunas>
--   check             : ck_<tabela>_<regra>
--   índice            : idx_<tabela>_<colunas>
--   trigger           : trg_<tabela>_<regra>
--   função            : fn_<finalidade>
-- =====================================================================

SET client_encoding TO 'UTF8';

-- Para recriar tudo do zero, descomente a linha abaixo:
-- DROP SCHEMA IF EXISTS origem CASCADE;

CREATE SCHEMA IF NOT EXISTS origem;
SET search_path TO origem;

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- 1.1 usuario ----------------------------------------------------------
CREATE TABLE usuario (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    nome          VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    tipo          VARCHAR(20)  NOT NULL,
    data_cadastro DATE         NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT pk_usuario PRIMARY KEY (id),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT ck_usuario_tipo CHECK (tipo IN ('comprador', 'artesao', 'admin')),
    CONSTRAINT ck_usuario_nome_preenchido CHECK (length(btrim(nome)) > 0),
    CONSTRAINT ck_usuario_email_formato CHECK (position('@' IN email) > 1)
);

-- 1.2 artesao (especialização de usuario) -------------------------------
CREATE TABLE artesao (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    usuario_id    UUID         NOT NULL,
    regiao_origem VARCHAR(100),
    biografia     TEXT,
    CONSTRAINT pk_artesao PRIMARY KEY (id),
    CONSTRAINT uq_artesao_usuario UNIQUE (usuario_id),
    CONSTRAINT fk_artesao_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 1.3 produto -----------------------------------------------------------
CREATE TABLE produto (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    artesao_id    UUID          NOT NULL,
    nome          VARCHAR(150)  NOT NULL,
    tecnica       VARCHAR(100),
    categoria     VARCHAR(100),
    preco         NUMERIC(10,2) NOT NULL,
    estoque_qtd   INTEGER       NOT NULL DEFAULT 0,
    data_cadastro DATE          NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT pk_produto PRIMARY KEY (id),
    CONSTRAINT fk_produto_artesao FOREIGN KEY (artesao_id)
        REFERENCES artesao (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_produto_nome_preenchido CHECK (length(btrim(nome)) > 0),
    CONSTRAINT ck_produto_preco CHECK (preco >= 0),
    CONSTRAINT ck_produto_estoque CHECK (estoque_qtd >= 0)
);

-- 1.4 pedido ------------------------------------------------------------
CREATE TABLE pedido (
    id           UUID          NOT NULL DEFAULT gen_random_uuid(),
    comprador_id UUID          NOT NULL,
    data_pedido  DATE          NOT NULL DEFAULT CURRENT_DATE,
    status       VARCHAR(20)   NOT NULL DEFAULT 'pendente',
    valor_total  NUMERIC(10,2) NOT NULL,
    CONSTRAINT pk_pedido PRIMARY KEY (id),
    CONSTRAINT fk_pedido_usuario FOREIGN KEY (comprador_id)
        REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_pedido_status CHECK (status IN ('pendente', 'pago', 'enviado', 'entregue')),
    CONSTRAINT ck_pedido_valor_total CHECK (valor_total >= 0)
);

-- 1.5 item_pedido -------------------------------------------------------
CREATE TABLE item_pedido (
    id             UUID          NOT NULL DEFAULT gen_random_uuid(),
    pedido_id      UUID          NOT NULL,
    produto_id     UUID          NOT NULL,
    quantidade     INTEGER       NOT NULL,
    preco_unitario NUMERIC(10,2) NOT NULL,
    CONSTRAINT pk_item_pedido PRIMARY KEY (id),
    CONSTRAINT fk_item_pedido_pedido FOREIGN KEY (pedido_id)
        REFERENCES pedido (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_item_pedido_produto FOREIGN KEY (produto_id)
        REFERENCES produto (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_item_pedido_quantidade CHECK (quantidade > 0),
    CONSTRAINT ck_item_pedido_preco_unitario CHECK (preco_unitario >= 0)
);

-- 1.6 avaliacao ---------------------------------------------------------
CREATE TABLE avaliacao (
    id             UUID    NOT NULL DEFAULT gen_random_uuid(),
    produto_id     UUID    NOT NULL,
    comprador_id   UUID    NOT NULL,
    nota           INTEGER NOT NULL,
    data_avaliacao DATE    NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT pk_avaliacao PRIMARY KEY (id),
    CONSTRAINT fk_avaliacao_produto FOREIGN KEY (produto_id)
        REFERENCES produto (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_avaliacao_usuario FOREIGN KEY (comprador_id)
        REFERENCES usuario (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_avaliacao_nota CHECK (nota BETWEEN 1 AND 5),
    -- RN-06: um comprador avalia um mesmo produto uma única vez
    CONSTRAINT uq_avaliacao_produto_comprador UNIQUE (produto_id, comprador_id)
);

-- 1.7 carrinho ----------------------------------------------------------
CREATE TABLE carrinho (
    id           UUID NOT NULL DEFAULT gen_random_uuid(),
    comprador_id UUID NOT NULL,
    data_criacao DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT pk_carrinho PRIMARY KEY (id),
    CONSTRAINT uq_carrinho_comprador UNIQUE (comprador_id),
    CONSTRAINT fk_carrinho_usuario FOREIGN KEY (comprador_id)
        REFERENCES usuario (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 1.8 item_carrinho -----------------------------------------------------
CREATE TABLE item_carrinho (
    id          UUID    NOT NULL DEFAULT gen_random_uuid(),
    carrinho_id UUID    NOT NULL,
    produto_id  UUID    NOT NULL,
    quantidade  INTEGER NOT NULL,
    CONSTRAINT pk_item_carrinho PRIMARY KEY (id),
    CONSTRAINT fk_item_carrinho_carrinho FOREIGN KEY (carrinho_id)
        REFERENCES carrinho (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_item_carrinho_produto FOREIGN KEY (produto_id)
        REFERENCES produto (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT ck_item_carrinho_quantidade CHECK (quantidade > 0),
    CONSTRAINT uq_item_carrinho_carrinho_produto UNIQUE (carrinho_id, produto_id)
);

-- ---------------------------------------------------------------------
-- 2. ÍNDICES
-- Índices de PK e UNIQUE já são criados automaticamente pelo PostgreSQL.
-- Não foram criados índices redundantes:
--   avaliacao(produto_id)       coberto por uq_avaliacao_produto_comprador
--   item_carrinho(carrinho_id)  coberto por uq_item_carrinho_carrinho_produto
-- ---------------------------------------------------------------------
CREATE INDEX idx_artesao_regiao_origem   ON artesao (regiao_origem);        -- RF-02
CREATE INDEX idx_produto_artesao_id      ON produto (artesao_id);           -- FK e RF-02
CREATE INDEX idx_produto_tecnica         ON produto (tecnica);              -- RF-01
CREATE INDEX idx_produto_categoria       ON produto (categoria);            -- filtro da vitrine
CREATE INDEX idx_produto_data_cadastro   ON produto (data_cadastro DESC);   -- RF-05 (produtos recentes)
CREATE INDEX idx_pedido_comprador_id     ON pedido (comprador_id);          -- histórico do comprador
CREATE INDEX idx_item_pedido_pedido_id   ON item_pedido (pedido_id);        -- FK e soma do pedido
CREATE INDEX idx_item_pedido_produto_id  ON item_pedido (produto_id);       -- RF-03
CREATE INDEX idx_avaliacao_comprador_id  ON avaliacao (comprador_id);       -- FK
CREATE INDEX idx_item_carrinho_produto_id ON item_carrinho (produto_id);    -- FK

-- ---------------------------------------------------------------------
-- 3. REGRAS DE NEGÓCIO QUE EXIGEM TRIGGER
-- RN-02: somente usuários do tipo 'artesao' possuem registro em artesao
-- RN-03: somente usuários do tipo 'comprador' fazem pedidos, avaliações
--        e possuem carrinho
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_exige_tipo_usuario() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_tipo_exigido TEXT := TG_ARGV[0];
    v_coluna       TEXT := TG_ARGV[1];
    v_usuario      UUID;
    v_tipo         TEXT;
BEGIN
    v_usuario := (to_jsonb(NEW) ->> v_coluna)::uuid;
    SELECT tipo INTO v_tipo FROM origem.usuario WHERE id = v_usuario;
    IF v_tipo IS DISTINCT FROM v_tipo_exigido THEN
        RAISE EXCEPTION 'O usuario % precisa ser do tipo %, mas e do tipo %',
            v_usuario, v_tipo_exigido, COALESCE(v_tipo, 'inexistente')
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_artesao_tipo_usuario
    BEFORE INSERT OR UPDATE OF usuario_id ON artesao
    FOR EACH ROW EXECUTE FUNCTION fn_exige_tipo_usuario('artesao', 'usuario_id');

CREATE TRIGGER trg_pedido_tipo_usuario
    BEFORE INSERT OR UPDATE OF comprador_id ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_exige_tipo_usuario('comprador', 'comprador_id');

CREATE TRIGGER trg_avaliacao_tipo_usuario
    BEFORE INSERT OR UPDATE OF comprador_id ON avaliacao
    FOR EACH ROW EXECUTE FUNCTION fn_exige_tipo_usuario('comprador', 'comprador_id');

CREATE TRIGGER trg_carrinho_tipo_usuario
    BEFORE INSERT OR UPDATE OF comprador_id ON carrinho
    FOR EACH ROW EXECUTE FUNCTION fn_exige_tipo_usuario('comprador', 'comprador_id');

-- Impede trocar o tipo de um usuário que já possui registros vinculados
-- ao tipo antigo (senão RN-02 e RN-03 seriam violadas depois do cadastro).
CREATE FUNCTION fn_protege_mudanca_tipo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tipo IS DISTINCT FROM OLD.tipo AND (
        EXISTS (SELECT 1 FROM origem.artesao   WHERE usuario_id   = OLD.id) OR
        EXISTS (SELECT 1 FROM origem.pedido    WHERE comprador_id = OLD.id) OR
        EXISTS (SELECT 1 FROM origem.avaliacao WHERE comprador_id = OLD.id) OR
        EXISTS (SELECT 1 FROM origem.carrinho  WHERE comprador_id = OLD.id)
    ) THEN
        RAISE EXCEPTION 'O tipo do usuario % nao pode mudar: existem registros vinculados ao tipo atual', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuario_protege_tipo
    BEFORE UPDATE OF tipo ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_protege_mudanca_tipo();

-- ---------------------------------------------------------------------
-- 4. INTEGRIDADE DO PEDIDO (conferida no COMMIT)
-- Garante a cardinalidade Pedido 1..N ItemPedido e que o valor_total,
-- que é um dado derivado, sempre bate com a soma dos itens (RN-05).
-- A conferência é adiada para o fim da transação (DEFERRABLE INITIALLY
-- DEFERRED), então pedido e itens devem ser gravados na MESMA transação:
--     BEGIN;
--       INSERT INTO pedido ...;
--       INSERT INTO item_pedido ...;
--     COMMIT;
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_confere_pedido(p_pedido UUID) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_total NUMERIC;
    v_soma  NUMERIC;
    v_itens INTEGER;
BEGIN
    SELECT valor_total INTO v_total FROM origem.pedido WHERE id = p_pedido;
    IF NOT FOUND THEN
        RETURN;  -- pedido removido (os itens saem junto, por CASCADE)
    END IF;

    SELECT COUNT(*), COALESCE(SUM(quantidade * preco_unitario), 0)
      INTO v_itens, v_soma
      FROM origem.item_pedido
     WHERE pedido_id = p_pedido;

    IF v_itens = 0 THEN
        RAISE EXCEPTION 'O pedido % precisa ter ao menos um item', p_pedido
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_total <> v_soma THEN
        RAISE EXCEPTION 'O valor_total (%) do pedido % difere da soma dos itens (%)',
            v_total, p_pedido, v_soma
            USING ERRCODE = 'check_violation';
    END IF;
END;
$$;

CREATE FUNCTION fn_trg_pedido() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM origem.fn_confere_pedido(NEW.id);
    RETURN NULL;
END;
$$;

CREATE FUNCTION fn_trg_item_pedido() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM origem.fn_confere_pedido(OLD.pedido_id);
    ELSE
        PERFORM origem.fn_confere_pedido(NEW.pedido_id);
        IF TG_OP = 'UPDATE' AND OLD.pedido_id <> NEW.pedido_id THEN
            PERFORM origem.fn_confere_pedido(OLD.pedido_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_pedido_confere
    AFTER INSERT OR UPDATE ON pedido
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_pedido();

CREATE CONSTRAINT TRIGGER trg_item_pedido_confere
    AFTER INSERT OR UPDATE OR DELETE ON item_pedido
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_trg_item_pedido();

-- ---------------------------------------------------------------------
-- 5. VIEW DE POPULARIDADE (consumida pelo módulo de recomendação)
-- Vendas contam somente pedidos já pagos (status diferente de 'pendente').
-- A view roda com os direitos do dono, então o módulo de recomendação lê
-- só o agregado e nunca enxerga dados de compradores ou de pedidos.
-- ---------------------------------------------------------------------
CREATE VIEW vw_popularidade_produto AS
SELECT p.id                          AS produto_id,
       COALESCE(v.qtd_vendida, 0)     AS qtd_vendida,
       COALESCE(a.total_avaliacoes, 0) AS total_avaliacoes,
       a.nota_media                   AS nota_media
  FROM produto p
  LEFT JOIN (
        SELECT ip.produto_id, SUM(ip.quantidade)::integer AS qtd_vendida
          FROM item_pedido ip
          JOIN pedido pe ON pe.id = ip.pedido_id
         WHERE pe.status <> 'pendente'
         GROUP BY ip.produto_id
       ) v ON v.produto_id = p.id
  LEFT JOIN (
        SELECT produto_id,
               COUNT(*)::integer     AS total_avaliacoes,
               ROUND(AVG(nota), 2)   AS nota_media
          FROM avaliacao
         GROUP BY produto_id
       ) a ON a.produto_id = p.id;

-- ---------------------------------------------------------------------
-- 6. PERFIS DE ACESSO (princípio do menor privilégio)
-- Os perfis são criados sem login. Em produção, o administrador do banco
-- cria os usuários reais e os associa a eles, com senha definida fora do
-- repositório.
--   origem_app          backend do marketplace: leitura e escrita
--   origem_recomendacao módulo de IA: somente leitura, sem acesso a
--                       usuario, pedido, avaliacao ou carrinho
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'origem_app') THEN
        CREATE ROLE origem_app NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'origem_recomendacao') THEN
        CREATE ROLE origem_recomendacao NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA origem TO origem_app, origem_recomendacao;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA origem TO origem_app;
GRANT SELECT ON produto, artesao, vw_popularidade_produto TO origem_recomendacao;

-- ---------------------------------------------------------------------
-- 7. DOCUMENTAÇÃO NO PRÓPRIO BANCO
-- ---------------------------------------------------------------------
COMMENT ON SCHEMA origem IS 'Marketplace Origem: banco de dados do projeto integrador';

COMMENT ON TABLE usuario       IS 'Pessoa cadastrada na plataforma, como comprador, artesao ou admin';
COMMENT ON TABLE artesao       IS 'Especializacao de usuario: dados proprios de quem vende';
COMMENT ON TABLE produto       IS 'Peca artesanal do catalogo, pertencente a um artesao';
COMMENT ON TABLE pedido        IS 'Compra realizada por um comprador';
COMMENT ON TABLE item_pedido   IS 'Linha de um pedido, ligando pedido a produto';
COMMENT ON TABLE avaliacao     IS 'Nota de 1 a 5 que um comprador atribui a um produto';
COMMENT ON TABLE carrinho      IS 'Carrinho de compras de um comprador, antes de fechar o pedido';
COMMENT ON TABLE item_carrinho IS 'Produto colocado em um carrinho';

COMMENT ON COLUMN usuario.tipo           IS 'Papel do usuario: comprador, artesao ou admin';
COMMENT ON COLUMN artesao.regiao_origem  IS 'Polo de origem, por exemplo Alto do Moura, Tracunhaem ou Pilar';
COMMENT ON COLUMN produto.tecnica        IS 'Tecnica artesanal empregada (insumo do RF-01)';
COMMENT ON COLUMN produto.estoque_qtd    IS 'Quantidade disponivel em estoque';
COMMENT ON COLUMN pedido.status          IS 'Situacao do pedido: pendente, pago, enviado ou entregue';
COMMENT ON COLUMN pedido.valor_total     IS 'Dado derivado: soma de quantidade x preco_unitario dos itens, conferida no COMMIT';
COMMENT ON COLUMN item_pedido.preco_unitario IS 'Preco do produto no momento da compra (RN-05)';
COMMENT ON COLUMN avaliacao.nota         IS 'Nota de 1 a 5';

COMMENT ON VIEW vw_popularidade_produto IS 'Vendas (pedidos nao pendentes) e avaliacoes por produto, para o modulo de recomendacao (RF-03)';
