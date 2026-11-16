import { NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { listarArtesaosAdmin } from "@/lib/servidor/artesaos";

export const dynamic = "force-dynamic";

// GET /api/artesaos — só admin. Fallback do Express (sem API_URL), com o mesmo contrato:
// 401 sem sessão, 403 para outro perfil e erro sempre em { ok: false, erro }.
export async function GET() {
  try {
    await exigirSessao(["admin"]);
    return NextResponse.json(await listarArtesaosAdmin());
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ ok: false, erro: erro.message }, { status: erro.status });
    console.error("GET /api/artesaos", erro);
    return NextResponse.json({ ok: false, erro: "Erro interno do servidor" }, { status: 500 });
  }
}
