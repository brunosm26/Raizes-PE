-- AlterTable
ALTER TABLE "origem"."artesao" ADD COLUMN     "aprovado" BOOLEAN NOT NULL DEFAULT false;

-- Preserva o acesso dos artesãos que já tinham credenciais antes da curadoria.
UPDATE "origem"."artesao" AS a
   SET "aprovado" = true
  FROM "origem"."usuario" AS u
 WHERE u."id" = a."usuario_id" AND u."senha_hash" IS NOT NULL;
