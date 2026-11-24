import { NextRequest, NextResponse } from "next/server";
import { cadastrarContaPublica, ErroAuth } from "@/lib/servidor/auth";
import { COOKIE_SESSAO, criarToken, DURACAO_SESSAO_SEG } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Comprador inicia a sessão. Artesão aguarda aprovação antes de entrar.
export async function POST(request: NextRequest) {
  try {
    const corpo = ((await request.json()) ?? {}) as {
      nome?: unknown; email?: unknown; senha?: unknown; perfil?: unknown; tipo?: unknown;
    };
    const usuario = await cadastrarContaPublica(
      typeof corpo.nome === "string" ? corpo.nome : "",
      typeof corpo.email === "string" ? corpo.email : "",
      typeof corpo.senha === "string" ? corpo.senha : "",
      corpo.perfil,
      corpo.tipo
    );
    const resposta = NextResponse.json({ usuario }, { status: 201 });
    if (usuario.tipo === "artesao") return resposta;
    resposta.cookies.set({
      name: COOKIE_SESSAO,
      value: await criarToken(usuario),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DURACAO_SESSAO_SEG,
    });
    return resposta;
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ erro: erro.message }, { status: erro.status });
    if (erro instanceof SyntaxError) return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    console.error("POST /api/auth/cadastro", erro);
    return NextResponse.json({ erro: "Erro ao criar a conta. Tente novamente." }, { status: 500 });
  }
}
