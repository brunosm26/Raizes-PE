import { NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { estatisticasDoArtesao } from "@/lib/servidor/estatisticas";

export const dynamic = "force-dynamic";

// GET /api/painel/estatisticas — do artesão logado (admin vê zerado: não tem loja)
export async function GET() {
  try {
    const sessao = await exigirSessao(["artesao", "admin"]);
    return NextResponse.json(await estatisticasDoArtesao(sessao.id));
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ erro: erro.message }, { status: erro.status });
    console.error("GET /api/painel/estatisticas", erro);
    return NextResponse.json({ erro: "Erro ao calcular as estatísticas." }, { status: 500 });
  }
}
