import { NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { invalidarCatalogo } from "@/lib/servidor/cacheCatalogo";
import { ErroProduto, moderarProduto } from "@/lib/servidor/produtos";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirSessao(["admin"]);
    const { id } = await params;
    const corpo = (await request.json()) as { status?: unknown } | null;
    const produto = await moderarProduto(id, corpo?.status);
    invalidarCatalogo();
    return NextResponse.json(produto);
  } catch (erro) {
    if (erro instanceof ErroProduto || erro instanceof ErroAuth) {
      return NextResponse.json({ erro: erro.message }, { status: erro.status });
    }
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    console.error("PATCH /api/produtos/:id/curadoria", erro);
    return NextResponse.json({ erro: "Não foi possível atualizar a curadoria." }, { status: 500 });
  }
}
