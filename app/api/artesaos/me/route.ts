import { NextResponse } from "next/server";
import { buscarMeuPerfil, editarMeuPerfil, ErroPerfilArtesao } from "@/lib/servidor/artesaos";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { invalidarCatalogo } from "@/lib/servidor/cacheCatalogo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessao = await exigirSessao(["artesao"]);
    const perfil = await buscarMeuPerfil(sessao.id);
    if (!perfil) return NextResponse.json({ erro: "Perfil de artesão não encontrado." }, { status: 404 });
    return NextResponse.json(perfil);
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ erro: erro.message }, { status: erro.status });
    console.error("GET /api/artesaos/me", erro);
    return NextResponse.json({ erro: "Erro ao consultar o perfil." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sessao = await exigirSessao(["artesao"]);
    const corpo = await request.json();
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    const perfil = await editarMeuPerfil(sessao.id, corpo);
    if (!perfil) return NextResponse.json({ erro: "Perfil de artesão não encontrado." }, { status: 404 });
    invalidarCatalogo();
    return NextResponse.json(perfil);
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ erro: erro.message }, { status: erro.status });
    if (erro instanceof ErroPerfilArtesao) return NextResponse.json({ erro: erro.message }, { status: 400 });
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    console.error("PATCH /api/artesaos/me", erro);
    return NextResponse.json({ erro: "Erro ao atualizar o perfil." }, { status: 500 });
  }
}
