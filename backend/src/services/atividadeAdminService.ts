import { executorPadrao } from "../repositories/transacao";
import type { TipoUsuario } from "../types/dominio";
import { ErroHttp } from "../utils/erroHttp";
import { ehUuid, resolverId } from "../utils/ids";
import { invalidarCatalogo } from "./cacheCatalogo";

export interface AtividadeAdmin {
  usuarios: { id: string; nome: string; tipo: TipoUsuario; ativo: boolean }[];
  produtos: { id: string; nome: string; artesaoNome: string; ativo: boolean }[];
}

const SQL_USUARIOS = "SELECT id, nome, tipo, ativo FROM origem.usuario ORDER BY nome, id";
const SQL_PRODUTOS = `
  SELECT p.id, p.nome, p.ativo, u.nome AS "artesaoNome"
    FROM origem.produto p
    JOIN origem.artesao a ON a.id = p.artesao_id
    JOIN origem.usuario u ON u.id = a.usuario_id
   ORDER BY p.nome, p.id`;

export async function listarAtividade(): Promise<AtividadeAdmin> {
  const db = executorPadrao();
  const [usuarios, produtos] = await Promise.all([
    db.query<AtividadeAdmin["usuarios"][number]>(SQL_USUARIOS),
    db.query<AtividadeAdmin["produtos"][number]>(SQL_PRODUTOS),
  ]);
  return { usuarios: usuarios.rows, produtos: produtos.rows };
}

export async function alterarAtividade(tipo: string, idBruto: string, corpo: unknown): Promise<void> {
  if (tipo !== "usuarios" && tipo !== "produtos") throw new ErroHttp(404, "Tipo de cadastro não encontrado.");
  const id = resolverId(idBruto);
  if (!ehUuid(id)) throw new ErroHttp(404, "Cadastro não encontrado.");
  const ativo = (corpo as { ativo?: unknown } | null)?.ativo;
  if (typeof ativo !== "boolean") throw new ErroHttp(400, "Informe se o cadastro está ativo.");

  const db = executorPadrao();
  if (tipo === "produtos") {
    const atualizado = await db.query("UPDATE origem.produto SET ativo = $2 WHERE id = $1", [id, ativo]);
    if (!atualizado.rowCount) throw new ErroHttp(404, "Cadastro não encontrado.");
  } else {
    const atualizado = await db.query(
      "UPDATE origem.usuario SET ativo = $2 WHERE id = $1 AND ($2 OR tipo <> 'admin')",
      [id, ativo]
    );
    if (!atualizado.rowCount) {
      const conta = await db.query("SELECT 1 FROM origem.usuario WHERE id = $1 AND tipo = 'admin'", [id]);
      if (conta.rowCount) throw new ErroHttp(403, "Contas administrativas não podem ser inativadas.");
      throw new ErroHttp(404, "Cadastro não encontrado.");
    }
  }
  invalidarCatalogo();
}
