import { NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { editarProduto, ErroProduto } from "@/lib/servidor/produtos";
import { buscarProduto } from "@/lib/servidor/catalogo";

export const dynamic = "force-dynamic";

// GET /api/produtos/:id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const produto = await buscarProduto(id);
    if (!produto) return NextResponse.json({ mensagem: "Produto não encontrado" }, { status: 404 });
    return NextResponse.json(produto);
  } catch (erro) {
    console.error("GET /api/produtos/:id", erro);
    return NextResponse.json({ mensagem: "Erro ao consultar o produto" }, { status: 500 });
  }
}

// PATCH /api/produtos/:id  { nome, descricao, preco, estoqueQtd, imagemUrl? }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigirSessao(["artesao", "admin"]);
    const { id } = await params;
    const corpo = (await request.json()) as Record<string, unknown>;
    return NextResponse.json(await editarProduto(id, corpo, sessao));
  } catch (erro) {
    if (erro instanceof ErroProduto || erro instanceof ErroAuth) {
      return NextResponse.json({ erro: erro.message }, { status: erro.status });
    }
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    console.error("PATCH /api/produtos/:id", erro);
    return NextResponse.json({ erro: "Erro ao atualizar o produto." }, { status: 500 });
  }
}
