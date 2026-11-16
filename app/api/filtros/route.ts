import { NextResponse } from "next/server";
import { obterOpcoesFiltros } from "@/lib/servidor/filtros";

export const dynamic = "force-dynamic";

// GET /api/filtros — público. Fallback do Express (sem API_URL), com o mesmo contrato.
export async function GET() {
  try {
    return NextResponse.json(await obterOpcoesFiltros());
  } catch (erro) {
    console.error("GET /api/filtros", erro);
    return NextResponse.json({ ok: false, erro: "Erro interno do servidor" }, { status: 500 });
  }
}
