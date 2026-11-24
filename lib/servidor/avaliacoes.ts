import { pool } from "@/lib/db";
import { ehUuid, resolverId } from "@/lib/idsLegados";

export class ErroAvaliacao extends Error {
  constructor(mensagem: string, public status: number) {
    super(mensagem);
  }
}

export async function registrarAvaliacao(idBruto: string, compradorId: string, nota: unknown) {
  const produtoId = resolverId(idBruto);
  if (!ehUuid(produtoId)) throw new ErroAvaliacao("Produto inválido.", 400);
  if (typeof nota !== "number" || !Number.isInteger(nota) || nota < 1 || nota > 5) {
    throw new ErroAvaliacao("Escolha uma nota inteira de 1 a 5.", 400);
  }
  const { rows } = await pool.query<{ permitido: boolean; gravada: boolean }>(
    `WITH elegivel AS (
       SELECT EXISTS (
         SELECT 1 FROM origem.pedido pe
         JOIN origem.item_pedido ip ON ip.pedido_id = pe.id
         WHERE pe.comprador_id = $2 AND pe.status = 'entregue' AND ip.produto_id = $1
       ) AS permitido
     ), inserida AS (
       INSERT INTO origem.avaliacao (produto_id, comprador_id, nota)
       SELECT $1::uuid, $2::uuid, $3::int FROM elegivel WHERE permitido
       ON CONFLICT (produto_id, comprador_id) DO NOTHING
       RETURNING id
     )
     SELECT permitido, EXISTS (SELECT 1 FROM inserida) AS gravada FROM elegivel`,
    [produtoId, compradorId, nota]
  );
  if (!rows[0]?.permitido) throw new ErroAvaliacao("Você só pode avaliar produtos de pedidos entregues.", 403);
  if (!rows[0].gravada) throw new ErroAvaliacao("Você já avaliou este produto.", 409);
}
