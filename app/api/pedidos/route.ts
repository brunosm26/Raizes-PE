import { NextRequest, NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import {
  criarPedido,
  ErroPedido,
  listarPedidos,
  listarPedidosDoArtesao,
} from "@/lib/servidor/pedidos";

export const dynamic = "force-dynamic";

function falha(erro: unknown) {
  if (erro instanceof ErroPedido || erro instanceof ErroAuth) {
    return NextResponse.json({ erro: erro.message }, { status: erro.status });
  }
  console.error(erro);
  return NextResponse.json({ erro: "Erro ao acessar os pedidos." }, { status: 500 });
}

// GET /api/pedidos — cada perfil enxerga só o que é seu:
//   comprador → os próprios pedidos; artesão → pedidos com produtos dele; admin → todos.
export async function GET() {
  try {
    const sessao = await exigirSessao();
    if (sessao.tipo === "admin") return NextResponse.json(await listarPedidos());
    if (sessao.tipo === "artesao") return NextResponse.json(await listarPedidosDoArtesao(sessao.id));
    return NextResponse.json(await listarPedidos(sessao.id));
  } catch (erro) {
    return falha(erro);
  }
}

// POST /api/pedidos  { itens: [{ produtoId, quantidade }] } — o comprador é o usuário logado
export async function POST(request: NextRequest) {
  try {
    const sessao = await exigirSessao(["comprador"]);
    const corpo = (await request.json()) as {
      itens?: { produtoId: string; quantidade: number }[];
    };
    const pedido = await criarPedido(sessao.id, corpo.itens ?? []);
    return NextResponse.json(pedido, { status: 201 });
  } catch (erro) {
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    return falha(erro);
  }
}
