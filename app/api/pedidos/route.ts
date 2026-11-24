import { NextRequest, NextResponse } from "next/server";
import { lerPeriodoPedidos } from "@/lib/periodoPedidos";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { invalidarCatalogo } from "@/lib/servidor/cacheCatalogo";
import {
  criarPedido,
  ErroPedido,
  listarPedidos,
  listarPedidosAdministrativos,
  listarPedidosDoArtesao,
} from "@/lib/servidor/pedidos";
import { enfileirarPedidoCriado } from "@/lib/servidor/processamentoAssincrono";

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
export async function GET(request: NextRequest) {
  try {
    const sessao = await exigirSessao();
    const inicio = request.nextUrl.searchParams.getAll("inicio");
    const fim = request.nextUrl.searchParams.getAll("fim");
    if (inicio.length || fim.length) {
      if (sessao.tipo !== "admin") throw new ErroAuth("Apenas administradores podem filtrar pedidos por período.", 403);
      if (inicio.length > 1 || fim.length > 1) throw new ErroPedido("Informe um período válido.");
      const periodo = lerPeriodoPedidos(inicio[0], fim[0]);
      if (!periodo) throw new ErroPedido("Informe um período válido.");
      return NextResponse.json(await listarPedidosAdministrativos(periodo));
    }
    if (sessao.tipo === "admin") return NextResponse.json(await listarPedidosAdministrativos());
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
    invalidarCatalogo();
    enfileirarPedidoCriado(pedido); // roda depois da resposta, sem ser esperado
    return NextResponse.json(pedido, { status: 201 });
  } catch (erro) {
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    return falha(erro);
  }
}
