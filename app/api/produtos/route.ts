import { NextRequest, NextResponse } from "next/server";
import { listarProdutos } from "@/lib/servidor/catalogo";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { criarProduto, ErroProduto } from "@/lib/servidor/produtos";
import type { Tecnica } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// GET /api/produtos?tecnica=&busca=&regiao=&categoria=
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  try {
    const dados = await listarProdutos({
      tecnica: (p.get("tecnica") as Tecnica | null) ?? undefined,
      busca: p.get("busca") ?? undefined,
      regiao: p.get("regiao") ?? undefined,
      categoria: p.get("categoria") ?? undefined,
    });
    return NextResponse.json(dados);
  } catch (erro) {
    console.error("GET /api/produtos", erro);
    return NextResponse.json({ mensagem: "Erro ao consultar produtos" }, { status: 500 });
  }
}

// POST /api/produtos  { nome, descricao, tecnica, categoria, preco, estoqueQtd, imagemUrl? }
export async function POST(request: NextRequest) {
  try {
    // Só artesão cadastra produto, e sempre na própria loja (o id vem da sessão).
    const sessao = await exigirSessao(["artesao"]);
    const corpo = (await request.json()) as Record<string, unknown>;
    const produto = await criarProduto(sessao.id, corpo);
    return NextResponse.json(produto, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroProduto || erro instanceof ErroAuth) {
      return NextResponse.json({ erro: erro.message }, { status: erro.status });
    }
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    console.error("POST /api/produtos", erro);
    return NextResponse.json({ erro: "Erro ao cadastrar o produto." }, { status: 500 });
  }
}
