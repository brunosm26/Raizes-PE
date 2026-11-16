// Contagem de produtos por categoria para /admin/categorias. As categorias vêm de GET /api/filtros
// (D1 da PI4-143: são as dos produtos, sem tabela própria), já sem espaços nas pontas e com as
// grafias que só diferem em maiúsculas juntadas. Por isso a contagem compara do mesmo jeito: um
// produto com " casa" conta em "Casa".

export interface ContagemCategoria {
  categoria: string;
  totalProdutos: number;
}

function chave(valor: string | null | undefined): string {
  return (valor ?? "").trim().toLocaleLowerCase("pt-BR");
}

// Mantém a ordem de `categorias`. Categoria sem produto na lista conta 0; produto cuja categoria
// não está na lista (ex.: cadastrado depois da última leitura de /api/filtros) fica de fora.
export function contarPorCategoria(
  categorias: readonly string[],
  produtos: readonly { categoria: string | null | undefined }[]
): ContagemCategoria[] {
  const totais = new Map<string, number>();
  for (const produto of produtos) {
    const k = chave(produto.categoria);
    if (k) totais.set(k, (totais.get(k) ?? 0) + 1);
  }
  return categorias.map((categoria) => ({ categoria, totalProdutos: totais.get(chave(categoria)) ?? 0 }));
}
