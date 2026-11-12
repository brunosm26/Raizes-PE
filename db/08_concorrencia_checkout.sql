-- Aplicar após 01, 04, 05, 06 e 07. O banco compartilhado é atualizado
-- pelo fluxo SQL do projeto; este arquivo não altera dados de pedidos existentes.
BEGIN;

ALTER TABLE origem.produto ADD COLUMN estoque_versao bigint NOT NULL DEFAULT 0;

CREATE FUNCTION origem.incrementa_versao_estoque() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estoque_qtd IS DISTINCT FROM OLD.estoque_qtd THEN
    NEW.estoque_versao := OLD.estoque_versao + 1;
  ELSE
    NEW.estoque_versao := OLD.estoque_versao;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_produto_versao_estoque
BEFORE UPDATE ON origem.produto FOR EACH ROW
EXECUTE FUNCTION origem.incrementa_versao_estoque();

CREATE TABLE origem.checkout_idempotencia (
  comprador_id uuid NOT NULL REFERENCES origem.usuario(id),
  chave uuid NOT NULL,
  itens_canonicos text NOT NULL,
  resposta jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comprador_id, chave)
);

COMMIT;
