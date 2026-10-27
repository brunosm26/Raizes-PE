import { NextRequest, NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { atualizarStatus, ErroPedido } from "@/lib/servidor/pedidos";

export const dynamic = "force-dynamic";

// PATCH /api/pedidos/:id  { status } — artesão (só "enviado", só pedido dele) ou admin
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessao = await exigirSessao(["artesao", "admin"]);
    const { id } = await params;
    const corpo = (await request.json()) as { status?: string };
    return NextResponse.json(await atualizarStatus(id, corpo.status ?? "", sessao));
  } catch (erro) {
    if (erro instanceof ErroPedido || erro instanceof ErroAuth) {
      return NextResponse.json({ erro: erro.message }, { status: erro.status });
    }
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    console.error(erro);
    return NextResponse.json({ erro: "Erro ao atualizar o pedido." }, { status: 500 });
  }
}
