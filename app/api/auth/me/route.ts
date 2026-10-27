import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/servidor/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/me  → { usuario: { id, nome, tipo } | null }
export async function GET() {
  try {
    const sessao = await obterSessao();
    return NextResponse.json({
      usuario: sessao ? { id: sessao.id, nome: sessao.nome, tipo: sessao.tipo } : null,
    });
  } catch (erro) {
    console.error("GET /api/auth/me", erro);
    return NextResponse.json({ usuario: null });
  }
}
