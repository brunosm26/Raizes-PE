import { NextResponse } from "next/server";
import { resumirAvaliacoes } from "@/lib/servidor/catalogo";

export const dynamic = "force-dynamic";

// GET /api/produtos/:id/avaliacoes
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await resumirAvaliacoes(id));
  } catch (erro) {
    console.error("GET /api/produtos/:id/avaliacoes", erro);
    return NextResponse.json({ mensagem: "Erro ao consultar avaliações" }, { status: 500 });
  }
}
