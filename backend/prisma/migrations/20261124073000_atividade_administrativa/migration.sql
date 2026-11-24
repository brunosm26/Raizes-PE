-- AlterTable
ALTER TABLE "origem"."usuario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "origem"."produto" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;
