const CHAVE = "raizes-pe:checkout-pendente";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Pendente = { assinatura: string; chave: string };
type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function criarControleCheckout(
  obterStorage: () => Armazenamento = () => window.sessionStorage,
  gerarChave: () => string = () => crypto.randomUUID()
) {
  let memoria: Pendente | null = null;
  const concluidas = new Set<string>();
  return {
    obterChave(compradorId: string, itens: { produtoId: string; quantidade: number }[]): string {
      const assinatura = JSON.stringify({ compradorId, itens: [...itens].sort((a, b) => a.produtoId.localeCompare(b.produtoId)) });
      if (memoria?.assinatura === assinatura) return memoria.chave;
      try {
        const bruto: unknown = JSON.parse(obterStorage().getItem(CHAVE) ?? "null");
        if (bruto && typeof bruto === "object" && "assinatura" in bruto && "chave" in bruto &&
            bruto.assinatura === assinatura && typeof bruto.chave === "string" && UUID.test(bruto.chave) &&
            !concluidas.has(bruto.chave)) {
          memoria = { assinatura, chave: bruto.chave };
          return memoria.chave;
        }
      } catch { /* storage bloqueado, quota ou JSON inválido: usa memória */ }
      memoria = { assinatura, chave: gerarChave() };
      try { obterStorage().setItem(CHAVE, JSON.stringify(memoria)); } catch { /* memória mantém os retries */ }
      return memoria.chave;
    },
    concluir(preservarRecuperacao = false) {
      if (memoria) concluidas.add(memoria.chave);
      memoria = null;
      if (!preservarRecuperacao) {
        try { obterStorage().removeItem(CHAVE); } catch { /* a chave concluída não é reutilizada nesta sessão */ }
      }
    },
  };
}
