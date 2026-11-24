import { NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { invalidarCatalogo } from "@/lib/servidor/cacheCatalogo";
import { arquivarProduto, editarProduto, ErroProduto } from "@/lib/servidor/produtos";
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
    const produto = await editarProduto(id, corpo, sessao);
    invalidarCatalogo();
    return NextResponse.json(produto);
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessao = await exigirSessao(["artesao"]);
    const { id } = await params;
    await arquivarProduto(id, sessao.id);
    invalidarCatalogo();
    return new NextResponse(null, { status: 204 });
  } catch (erro) {
    if (erro instanceof ErroProduto || erro instanceof ErroAuth) {
      return NextResponse.json({ erro: erro.message }, { status: erro.status });
    }
    console.error("DELETE /api/produtos/:id", erro);
    return NextResponse.json({ erro: "Não foi possível remover o produto." }, { status: 500 });
  }
}
