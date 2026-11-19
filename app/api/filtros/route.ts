import { NextResponse } from "next/server";
import { cabecalhosCache, cacheCatalogo, CHAVE_FILTROS } from "@/lib/servidor/cacheCatalogo";
import { obterOpcoesFiltros } from "@/lib/servidor/filtros";

export const dynamic = "force-dynamic";

// GET /api/filtros — público. Fallback do Express (sem API_URL), com o mesmo contrato e cache.
export async function GET() {
  try {
    const { valor, origem } = await cacheCatalogo.lerOuCalcular(CHAVE_FILTROS, obterOpcoesFiltros);
    return NextResponse.json(valor, { headers: cabecalhosCache(origem) });
  } catch (erro) {
    console.error("GET /api/filtros", erro);
    return NextResponse.json({ ok: false, erro: "Erro interno do servidor" }, { status: 500 });
  }
}
