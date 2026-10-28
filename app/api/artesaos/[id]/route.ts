import { NextResponse } from "next/server";
import { buscarPerfilArtesao } from "@/lib/servidor/catalogo";

export const dynamic = "force-dynamic";

// GET /api/artesaos/:id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const perfil = await buscarPerfilArtesao(id);
    if (!perfil) return NextResponse.json({ mensagem: "Artesão não encontrado" }, { status: 404 });
    return NextResponse.json(perfil);
  } catch (erro) {
    console.error("GET /api/artesaos/:id", erro);
    return NextResponse.json({ mensagem: "Erro ao consultar o artesão" }, { status: 500 });
  }
}
