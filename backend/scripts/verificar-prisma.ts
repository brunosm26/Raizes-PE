// Verificação SOMENTE LEITURA da ligação Prisma ↔ Neon: conta as linhas das 8 tabelas
// do esquema origem e da view de popularidade. Imprime só números (nada de connection
// string, e-mails ou hashes). Uso: npm run prisma:verificar
import { desconectarPrisma, obterPrisma } from "../src/config/prisma";
import { listarPopularidade } from "../src/repositories/popularidadeRepository";

async function main() {
  const prisma = obterPrisma();

  const [usuario, artesao, produto, pedido, itemPedido, avaliacao, carrinho, itemCarrinho, popularidade] =
    await Promise.all([
      prisma.usuario.count(),
      prisma.artesao.count(),
      prisma.produto.count(),
      prisma.pedido.count(),
      prisma.itemPedido.count(),
      prisma.avaliacao.count(),
      prisma.carrinho.count(),
      prisma.itemCarrinho.count(),
      listarPopularidade(),
    ]);

  console.table({
    usuario,
    artesao,
    produto,
    pedido,
    item_pedido: itemPedido,
    avaliacao,
    carrinho,
    item_carrinho: itemCarrinho,
    vw_popularidade_produto: popularidade.length,
  });
}

main()
  .catch((erro: unknown) => {
    // Só o tipo e o código: a mensagem do driver pode conter host e usuário.
    const { name, code } = (erro ?? {}) as { name?: string; code?: string };
    console.error(`Falha na verificação: ${name ?? "Erro"}${code ? ` (código ${code})` : ""}`);
    process.exitCode = 1;
  })
  .finally(desconectarPrisma);
