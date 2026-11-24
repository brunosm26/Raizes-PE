CREATE TYPE "origem"."status_curadoria_produto" AS ENUM ('pendente', 'aprovado', 'rejeitado');

-- Preserva a visibilidade do catálogo existente. Somente produtos novos entram pendentes.
ALTER TABLE "origem"."produto"
  ADD COLUMN "status_curadoria" "origem"."status_curadoria_produto" NOT NULL DEFAULT 'aprovado';

ALTER TABLE "origem"."produto"
  ALTER COLUMN "status_curadoria" SET DEFAULT 'pendente';
