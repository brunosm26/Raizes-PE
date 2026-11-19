import { NextRequest, NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { invalidarCatalogo } from "@/lib/servidor/cacheCatalogo";
import { atualizarStatus, ErroPedido } from "@/lib/servidor/pedidos";
import { enfileirarStatusAtualizado } from "@/lib/servidor/processamentoAssincrono";

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
    const pedido = await atualizarStatus(id, corpo.status ?? "", sessao);
    invalidarCatalogo();
    enfileirarStatusAtualizado(pedido);
    return NextResponse.json(pedido);
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
