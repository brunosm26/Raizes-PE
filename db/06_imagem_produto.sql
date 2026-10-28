-- =====================================================================
-- ORIGEM | 06 - FOTO DO PRODUTO ENVIADA PELO ARTESÃO
-- Pré-requisito: 04_migracao_front.sql.
-- No painel, o artesão envia a foto do produto (até 2 MB). Ela é guardada
-- no próprio banco como data URL (texto), por isso a coluna imagem_url
-- deixa de ser VARCHAR(300) e passa a TEXT, com limite de tamanho.
-- Nada existente é perdido; o script pode ser executado mais de uma vez.
-- =====================================================================
SET client_encoding TO 'UTF8';
SET search_path TO origem;

ALTER TABLE produto ALTER COLUMN imagem_url TYPE TEXT;

ALTER TABLE produto DROP CONSTRAINT IF EXISTS ck_produto_imagem_tamanho;
ALTER TABLE produto ADD CONSTRAINT ck_produto_imagem_tamanho
    CHECK (imagem_url IS NULL OR length(imagem_url) <= 2800000);

COMMENT ON COLUMN produto.imagem_url IS 'Caminho/URL da foto ou data URL (base64, até ~2 MB) enviada pelo artesão; vazio usa o padrão visual da técnica';
