import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Rota de teste da ligação com o banco: GET /api/saude-bd
export async function GET() {
  try {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS produtos FROM origem.produto"
    );
    return Response.json({ ok: true, ...rows[0] });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "erro desconhecido";
    return Response.json({ ok: false, erro: mensagem }, { status: 500 });
  }
}
