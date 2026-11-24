import { NextResponse } from "next/server";
import { listarAtividade } from "@/lib/servidor/atividadeAdmin";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await exigirSessao(["admin"]);
    return NextResponse.json(await listarAtividade(), { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ erro: erro.message }, { status: erro.status });
    console.error("GET /api/admin/atividade", erro);
    return NextResponse.json({ erro: "Não foi possível consultar os cadastros." }, { status: 500 });
  }
}
