-- AlterTable
ALTER TABLE "origem"."produto" ADD COLUMN     "rejeicao_autor_id" UUID,
ADD COLUMN     "rejeicao_em" TIMESTAMPTZ(3),
ADD COLUMN     "rejeicao_justificativa" VARCHAR(500);

-- AddForeignKey
ALTER TABLE "origem"."produto" ADD CONSTRAINT "fk_produto_rejeicao_autor" FOREIGN KEY ("rejeicao_autor_id") REFERENCES "origem"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
