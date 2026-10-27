import { NextRequest, NextResponse } from "next/server";
import { listarRelacionados } from "@/lib/servidor/catalogo";

export const dynamic = "force-dynamic";

// GET /api/produtos/:id/relacionados?limite=3
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limite = Number.parseInt(request.nextUrl.searchParams.get("limite") ?? "3", 10);
  try {
    const dados = await listarRelacionados(id, Number.isNaN(limite) ? 3 : Math.min(Math.max(limite, 1), 20));
    return NextResponse.json(dados);
  } catch (erro) {
    console.error("GET /api/produtos/:id/relacionados", erro);
    return NextResponse.json({ mensagem: "Erro ao consultar produtos relacionados" }, { status: 500 });
  }
}
