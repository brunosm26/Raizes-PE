-- =====================================================================
-- ORIGEM | DDL FINAL (schema origem, sem dados)
-- ARQUIVO GERADO: não edite. A fonte da verdade são as migrations do Prisma em
-- backend/prisma/migrations (0_init, 1_regras_sql).
-- Para regenerar: cd backend && npm run db:ddl
-- Para conferir se está atualizado: npm run db:ddl -- --conferir
--
-- Aplicar num banco PostgreSQL 13+ VAZIO e DESCARTÁVEL (nunca no Neon do time):
--   psql -v ON_ERROR_STOP=1 -f db/ddl_final.sql
-- Depois, a carga de demonstração: db/05_dados_raizes_pe.sql e db/07_autenticacao.sql.
-- Tudo roda em uma transação: se algo falhar, nada fica criado.
-- =====================================================================

SET client_encoding TO 'UTF8';

BEGIN;

-- >>> migration 0_init

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "origem";

-- CreateTable
CREATE TABLE "origem"."usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "data_cadastro" DATE NOT NULL DEFAULT CURRENT_DATE,
    "senha_hash" VARCHAR(200),

    CONSTRAINT "pk_usuario" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem"."artesao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "regiao_origem" VARCHAR(100),
    "biografia" TEXT,

    CONSTRAINT "pk_artesao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem"."avaliacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "produto_id" UUID NOT NULL,
    "comprador_id" UUID NOT NULL,
    "nota" INTEGER NOT NULL,
    "data_avaliacao" DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT "pk_avaliacao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem"."carrinho" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comprador_id" UUID NOT NULL,
    "data_criacao" DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT "pk_carrinho" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem"."item_carrinho" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carrinho_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "pk_item_carrinho" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem"."item_pedido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pk_item_pedido" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem"."pedido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comprador_id" UUID NOT NULL,
    "data_pedido" DATE NOT NULL DEFAULT CURRENT_DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "valor_total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pk_pedido" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem"."produto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artesao_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "tecnica" VARCHAR(100),
    "categoria" VARCHAR(100),
    "preco" DECIMAL(10,2) NOT NULL,
    "estoque_qtd" INTEGER NOT NULL DEFAULT 0,
    "data_cadastro" DATE NOT NULL DEFAULT CURRENT_DATE,
    "descricao" TEXT,
    "imagem_url" TEXT,

    CONSTRAINT "pk_produto" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuario_email" ON "origem"."usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_artesao_usuario" ON "origem"."artesao"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_artesao_regiao_origem" ON "origem"."artesao"("regiao_origem");

-- CreateIndex
CREATE INDEX "idx_avaliacao_comprador_id" ON "origem"."avaliacao"("comprador_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_avaliacao_produto_comprador" ON "origem"."avaliacao"("produto_id", "comprador_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_carrinho_comprador" ON "origem"."carrinho"("comprador_id");

-- CreateIndex
CREATE INDEX "idx_item_carrinho_produto_id" ON "origem"."item_carrinho"("produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_item_carrinho_carrinho_produto" ON "origem"."item_carrinho"("carrinho_id", "produto_id");

-- CreateIndex
CREATE INDEX "idx_item_pedido_pedido_id" ON "origem"."item_pedido"("pedido_id");

-- CreateIndex
CREATE INDEX "idx_item_pedido_produto_id" ON "origem"."item_pedido"("produto_id");

-- CreateIndex
CREATE INDEX "idx_pedido_comprador_id" ON "origem"."pedido"("comprador_id");

-- CreateIndex
CREATE INDEX "idx_produto_artesao_id" ON "origem"."produto"("artesao_id");

-- CreateIndex
CREATE INDEX "idx_produto_categoria" ON "origem"."produto"("categoria");

-- CreateIndex
CREATE INDEX "idx_produto_data_cadastro" ON "origem"."produto"("data_cadastro" DESC);

-- CreateIndex
CREATE INDEX "idx_produto_tecnica" ON "origem"."produto"("tecnica");

-- AddForeignKey
ALTER TABLE "origem"."artesao" ADD CONSTRAINT "fk_artesao_usuario" FOREIGN KEY ("usuario_id") REFERENCES "origem"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."avaliacao" ADD CONSTRAINT "fk_avaliacao_produto" FOREIGN KEY ("produto_id") REFERENCES "origem"."produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."avaliacao" ADD CONSTRAINT "fk_avaliacao_usuario" FOREIGN KEY ("comprador_id") REFERENCES "origem"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."carrinho" ADD CONSTRAINT "fk_carrinho_usuario" FOREIGN KEY ("comprador_id") REFERENCES "origem"."usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."item_carrinho" ADD CONSTRAINT "fk_item_carrinho_carrinho" FOREIGN KEY ("carrinho_id") REFERENCES "origem"."carrinho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."item_carrinho" ADD CONSTRAINT "fk_item_carrinho_produto" FOREIGN KEY ("produto_id") REFERENCES "origem"."produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."item_pedido" ADD CONSTRAINT "fk_item_pedido_pedido" FOREIGN KEY ("pedido_id") REFERENCES "origem"."pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."item_pedido" ADD CONSTRAINT "fk_item_pedido_produto" FOREIGN KEY ("produto_id") REFERENCES "origem"."produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."pedido" ADD CONSTRAINT "fk_pedido_usuario" FOREIGN KEY ("comprador_id") REFERENCES "origem"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "origem"."produto" ADD CONSTRAINT "fk_produto_artesao" FOREIGN KEY ("artesao_id") REFERENCES "origem"."artesao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- <<< fim da migration 0_init

-- >>> migration 1_regras_sql

-- =====================================================================
-- 1_regras_sql (PI4-147): o que o schema.prisma NÃO expressa.
-- A 0_init (gerada do schema.prisma) cria tabelas, colunas, PK, FK, índices e defaults.
-- Esta migration completa o schema `origem` até ficar igual ao criado pelos scripts
-- db/01, 04, 06 e 07. Fonte: esses scripts (não um dump). Todos os nomes vão
-- qualificados com `origem.` porque o migrate não usa search_path.
-- Escrita à mão: não gere de novo com migrate diff (o Prisma não enxerga estes objetos).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. UNIQUE como CONSTRAINT (db/01)
-- O Prisma cria só o índice único; o db/01 cria a constraint uq_*, que aparece em
-- pg_constraint (o dicionário de dados a lista). USING INDEX aproveita o índice da 0_init.
-- ---------------------------------------------------------------------
ALTER TABLE origem.usuario       ADD CONSTRAINT uq_usuario_email                  UNIQUE USING INDEX uq_usuario_email;
ALTER TABLE origem.artesao       ADD CONSTRAINT uq_artesao_usuario                UNIQUE USING INDEX uq_artesao_usuario;
ALTER TABLE origem.avaliacao     ADD CONSTRAINT uq_avaliacao_produto_comprador    UNIQUE USING INDEX uq_avaliacao_produto_comprador;
ALTER TABLE origem.carrinho      ADD CONSTRAINT uq_carrinho_comprador             UNIQUE USING INDEX uq_carrinho_comprador;
ALTER TABLE origem.item_carrinho ADD CONSTRAINT uq_item_carrinho_carrinho_produto UNIQUE USING INDEX uq_item_carrinho_carrinho_produto;

-- ---------------------------------------------------------------------
-- 2. CHECK (db/01 e db/06): domínios fechados (tipo, status, nota) e valores válidos.
-- O Prisma não tem sintaxe para CHECK.
-- ---------------------------------------------------------------------
ALTER TABLE origem.usuario ADD CONSTRAINT ck_usuario_tipo CHECK (tipo IN ('comprador', 'artesao', 'admin'));
ALTER TABLE origem.usuario ADD CONSTRAINT ck_usuario_nome_preenchido CHECK (length(btrim(nome)) > 0);
ALTER TABLE origem.usuario ADD CONSTRAINT ck_usuario_email_formato CHECK (position('@' IN email) > 1);

ALTER TABLE origem.produto ADD CONSTRAINT ck_produto_nome_preenchido CHECK (length(btrim(nome)) > 0);
ALTER TABLE origem.produto ADD CONSTRAINT ck_produto_preco CHECK (preco >= 0);
ALTER TABLE origem.produto ADD CONSTRAINT ck_produto_estoque CHECK (estoque_qtd >= 0);
-- db/06: foto enviada pelo artesão guardada como data URL, até cerca de 2 MB
ALTER TABLE origem.produto ADD CONSTRAINT ck_produto_imagem_tamanho
    CHECK (imagem_url IS NULL OR length(imagem_url) <= 2800000);

ALTER TABLE origem.pedido ADD CONSTRAINT ck_pedido_status CHECK (status IN ('pendente', 'pago', 'enviado', 'entregue'));
ALTER TABLE origem.pedido ADD CONSTRAINT ck_pedido_valor_total CHECK (valor_total >= 0);

ALTER TABLE origem.item_pedido ADD CONSTRAINT ck_item_pedido_quantidade CHECK (quantidade > 0);
ALTER TABLE origem.item_pedido ADD CONSTRAINT ck_item_pedido_preco_unitario CHECK (preco_unitario >= 0);

ALTER TABLE origem.avaliacao ADD CONSTRAINT ck_avaliacao_nota CHECK (nota BETWEEN 1 AND 5);

ALTER TABLE origem.item_carrinho ADD CONSTRAINT ck_item_carrinho_quantidade CHECK (quantidade > 0);

-- ---------------------------------------------------------------------
-- 3. RN-02 e RN-03 (db/01): tipo de usuário exigido em cada relação.
-- Função antes dos gatilhos que a usam.
-- ---------------------------------------------------------------------
CREATE FUNCTION origem.fn_exige_tipo_usuario() RETURNS trigger
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
    BEFORE INSERT OR UPDATE OF usuario_id ON origem.artesao
    FOR EACH ROW EXECUTE FUNCTION origem.fn_exige_tipo_usuario('artesao', 'usuario_id');

CREATE TRIGGER trg_pedido_tipo_usuario
    BEFORE INSERT OR UPDATE OF comprador_id ON origem.pedido
    FOR EACH ROW EXECUTE FUNCTION origem.fn_exige_tipo_usuario('comprador', 'comprador_id');

CREATE TRIGGER trg_avaliacao_tipo_usuario
    BEFORE INSERT OR UPDATE OF comprador_id ON origem.avaliacao
    FOR EACH ROW EXECUTE FUNCTION origem.fn_exige_tipo_usuario('comprador', 'comprador_id');

CREATE TRIGGER trg_carrinho_tipo_usuario
    BEFORE INSERT OR UPDATE OF comprador_id ON origem.carrinho
    FOR EACH ROW EXECUTE FUNCTION origem.fn_exige_tipo_usuario('comprador', 'comprador_id');

-- Tipo estável (db/01): impede trocar o tipo de um usuário que já tem registros
-- vinculados ao tipo antigo (senão RN-02 e RN-03 seriam violadas depois do cadastro).
CREATE FUNCTION origem.fn_protege_mudanca_tipo() RETURNS trigger
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
    BEFORE UPDATE OF tipo ON origem.usuario
    FOR EACH ROW EXECUTE FUNCTION origem.fn_protege_mudanca_tipo();

-- ---------------------------------------------------------------------
-- 4. RN-05 (db/01): integridade do pedido conferida no COMMIT.
-- Pedido precisa ter ao menos um item e valor_total = soma de quantidade x preco_unitario.
-- Os gatilhos são CONSTRAINT TRIGGER adiados (DEFERRABLE INITIALLY DEFERRED): pedido e
-- itens precisam ser gravados na mesma transação. fn_confere_pedido vem antes das
-- funções de gatilho que a chamam.
-- ---------------------------------------------------------------------
CREATE FUNCTION origem.fn_confere_pedido(p_pedido UUID) RETURNS void
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

CREATE FUNCTION origem.fn_trg_pedido() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM origem.fn_confere_pedido(NEW.id);
    RETURN NULL;
END;
$$;

CREATE FUNCTION origem.fn_trg_item_pedido() RETURNS trigger
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
    AFTER INSERT OR UPDATE ON origem.pedido
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION origem.fn_trg_pedido();

CREATE CONSTRAINT TRIGGER trg_item_pedido_confere
    AFTER INSERT OR UPDATE OR DELETE ON origem.item_pedido
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION origem.fn_trg_item_pedido();

-- ---------------------------------------------------------------------
-- 5. View de popularidade (db/01), consumida pelo módulo de recomendação (RF-03).
-- O schema.prisma não modela a view; o backend a lê com $queryRaw. Vendas contam só
-- pedidos não pendentes. Depende das tabelas, por isso vem depois delas (0_init).
-- ---------------------------------------------------------------------
CREATE VIEW origem.vw_popularidade_produto AS
SELECT p.id                          AS produto_id,
       COALESCE(v.qtd_vendida, 0)     AS qtd_vendida,
       COALESCE(a.total_avaliacoes, 0) AS total_avaliacoes,
       a.nota_media                   AS nota_media
  FROM origem.produto p
  LEFT JOIN (
        SELECT ip.produto_id, SUM(ip.quantidade)::integer AS qtd_vendida
          FROM origem.item_pedido ip
          JOIN origem.pedido pe ON pe.id = ip.pedido_id
         WHERE pe.status <> 'pendente'
         GROUP BY ip.produto_id
       ) v ON v.produto_id = p.id
  LEFT JOIN (
        SELECT produto_id,
               COUNT(*)::integer     AS total_avaliacoes,
               ROUND(AVG(nota), 2)   AS nota_media
          FROM origem.avaliacao
         GROUP BY produto_id
       ) a ON a.produto_id = p.id;

-- ---------------------------------------------------------------------
-- 6. Perfis de acesso (db/01), princípio do menor privilégio.
-- Roles são GLOBAIS do servidor (não pertencem a um banco nem a um schema): podem já
-- existir porque outro banco do mesmo servidor os criou. Por isso o CREATE ROLE é
-- idempotente (só cria se não existir) e nunca altera um role existente. Os perfis
-- são NOLOGIN; o administrador do banco cria os usuários reais e os associa a eles.
--   origem_app          backend: leitura e escrita nas 8 tabelas e na view
--   origem_recomendacao módulo de IA: só leitura em produto, artesao e na view
-- No db/01 o GRANT é "ON ALL TABLES IN SCHEMA"; aqui a lista é explícita para dar o
-- mesmo resultado sem depender do que mais existir no schema.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'origem_app') THEN
        CREATE ROLE origem_app NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'origem_recomendacao') THEN
        CREATE ROLE origem_recomendacao NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA origem TO origem_app, origem_recomendacao;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    origem.usuario, origem.artesao, origem.produto, origem.pedido, origem.item_pedido,
    origem.avaliacao, origem.carrinho, origem.item_carrinho, origem.vw_popularidade_produto
    TO origem_app;
GRANT SELECT ON origem.produto, origem.artesao, origem.vw_popularidade_produto TO origem_recomendacao;

-- ---------------------------------------------------------------------
-- 7. Documentação no próprio banco (db/01, 04, 06 e 07). O Prisma não gera COMMENT.
-- ---------------------------------------------------------------------
COMMENT ON SCHEMA origem IS 'Marketplace Origem: banco de dados do projeto integrador';

COMMENT ON TABLE origem.usuario       IS 'Pessoa cadastrada na plataforma, como comprador, artesao ou admin';
COMMENT ON TABLE origem.artesao       IS 'Especializacao de usuario: dados proprios de quem vende';
COMMENT ON TABLE origem.produto       IS 'Peca artesanal do catalogo, pertencente a um artesao';
COMMENT ON TABLE origem.pedido        IS 'Compra realizada por um comprador';
COMMENT ON TABLE origem.item_pedido   IS 'Linha de um pedido, ligando pedido a produto';
COMMENT ON TABLE origem.avaliacao     IS 'Nota de 1 a 5 que um comprador atribui a um produto';
COMMENT ON TABLE origem.carrinho      IS 'Carrinho de compras de um comprador, antes de fechar o pedido';
COMMENT ON TABLE origem.item_carrinho IS 'Produto colocado em um carrinho';

COMMENT ON COLUMN origem.usuario.tipo           IS 'Papel do usuario: comprador, artesao ou admin';
COMMENT ON COLUMN origem.artesao.regiao_origem  IS 'Polo de origem, por exemplo Alto do Moura, Tracunhaem ou Pilar';
COMMENT ON COLUMN origem.produto.tecnica        IS 'Tecnica artesanal empregada (insumo do RF-01)';
COMMENT ON COLUMN origem.produto.estoque_qtd    IS 'Quantidade disponivel em estoque';
COMMENT ON COLUMN origem.pedido.status          IS 'Situacao do pedido: pendente, pago, enviado ou entregue';
COMMENT ON COLUMN origem.pedido.valor_total     IS 'Dado derivado: soma de quantidade x preco_unitario dos itens, conferida no COMMIT';
COMMENT ON COLUMN origem.item_pedido.preco_unitario IS 'Preco do produto no momento da compra (RN-05)';
COMMENT ON COLUMN origem.avaliacao.nota         IS 'Nota de 1 a 5';
-- db/04 e db/06 (o 06 substitui o comentário de imagem_url do 04)
COMMENT ON COLUMN origem.produto.descricao      IS 'Texto de apresentação do produto exibido na vitrine';
COMMENT ON COLUMN origem.produto.imagem_url     IS 'Caminho/URL da foto ou data URL (base64, até ~2 MB) enviada pelo artesão; vazio usa o padrão visual da técnica';
-- db/07: só descreve o formato do hash; nenhuma senha ou hash fica nas migrations
COMMENT ON COLUMN origem.usuario.senha_hash     IS 'Hash scrypt da senha (scrypt$N$r$p$sal$hash); nulo = sem acesso ao login';

COMMENT ON VIEW origem.vw_popularidade_produto IS 'Vendas (pedidos nao pendentes) e avaliacoes por produto, para o modulo de recomendacao (RF-03)';

-- <<< fim da migration 1_regras_sql

COMMIT;
