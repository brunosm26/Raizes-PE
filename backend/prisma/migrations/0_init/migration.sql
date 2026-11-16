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
