import * as saudeRepository from "../repositories/saudeRepository";

// Regras de negócio ficam nos services. A saúde da API não depende do banco.
export function obterSaude() {
  return { ok: true } as const;
}

// Saúde do banco: prova que a API alcança o PostgreSQL e lê o schema origem.
export async function verificarBanco() {
  return { ok: true, produtos: await saudeRepository.contarProdutos() } as const;
}
