-- =====================================================================
-- ORIGEM | 04 - MIGRAÇÃO PARA O FRONT-END
-- Pré-requisito: 01_ddl_origem.sql.
-- O front-end (Raízes PE) mostra descrição e foto do produto, campos que o
-- modelo físico original não tinha. A alteração só ACRESCENTA colunas
-- opcionais: nada existente é removido ou alterado, e o script pode ser
-- executado mais de uma vez.
-- =====================================================================
SET client_encoding TO 'UTF8';
SET search_path TO origem;

ALTER TABLE produto ADD COLUMN IF NOT EXISTS descricao  TEXT;
ALTER TABLE produto ADD COLUMN IF NOT EXISTS imagem_url VARCHAR(300);

COMMENT ON COLUMN produto.descricao  IS 'Texto de apresentação do produto exibido na vitrine';
COMMENT ON COLUMN produto.imagem_url IS 'Caminho ou URL da foto do produto; vazio usa o padrão visual da técnica';
