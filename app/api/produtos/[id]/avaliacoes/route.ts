import { NextResponse } from "next/server";
import { ErroAvaliacao, registrarAvaliacao } from "@/lib/servidor/avaliacoes";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { invalidarCatalogo } from "@/lib/servidor/cacheCatalogo";
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigirSessao(["comprador"]);
    const { id } = await params;
    const corpo = await request.json();
    await registrarAvaliacao(id, sessao.id, corpo?.nota);
    invalidarCatalogo();
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroAvaliacao || erro instanceof ErroAuth) {
      return NextResponse.json({ erro: erro.message }, { status: erro.status });
    }
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    console.error("POST /api/produtos/:id/avaliacoes", erro);
    return NextResponse.json({ erro: "Erro ao registrar a avaliação." }, { status: 500 });
  }
}
