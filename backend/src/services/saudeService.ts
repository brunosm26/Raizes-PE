// Regras de negócio ficam nos services. A saúde da API não depende do banco;
// a verificação do banco é de outra tarefa.
export function obterSaude() {
  return { ok: true } as const;
}
