// Ordem alfabética em pt-BR (acentos no lugar certo), igual com qualquer collation do banco.
// Com caseFirst "upper", entre duas grafias que só diferem em maiúsculas a maiúscula vem antes.
// Cópia de backend/src/utils/ordenacao.ts: o tests/rotasAdminFiltros.test.mjs confere que as
// duas dão o mesmo resultado.
const collator = new Intl.Collator("pt-BR", { caseFirst: "upper" });

export function compararPtBr(a: string, b: string): number {
  return collator.compare(a, b);
}

// Opções de filtro: tira os espaços das pontas, descarta vazias e junta as que só diferem em
// maiúsculas/minúsculas (fica a grafia que vem primeiro na ordem pt-BR). Devolve em ordem pt-BR.
export function normalizarOpcoes(valores: readonly (string | null | undefined)[]): string[] {
  const vistas = new Set<string>();
  return valores
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length > 0)
    .sort(compararPtBr)
    .filter((v) => {
      const chave = v.toLocaleLowerCase("pt-BR");
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
}
