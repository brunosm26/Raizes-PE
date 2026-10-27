import { NextRequest, NextResponse } from "next/server";
import { autenticar } from "@/lib/servidor/auth";
import { COOKIE_SESSAO, criarToken, DURACAO_SESSAO_SEG } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// Freio simples contra tentativas em massa: 5 falhas por e-mail+IP a cada 15 minutos.
// Fica na memória do servidor (basta para a demonstração; em produção usar um store externo).
const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 5;
const falhas = new Map<string, { quantidade: number; desde: number }>();

function chaveFalha(request: NextRequest, email: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  return `${ip}|${email.trim().toLowerCase()}`;
}

function bloqueado(chave: string): boolean {
  const f = falhas.get(chave);
  if (!f) return false;
  if (Date.now() - f.desde > JANELA_MS) {
    falhas.delete(chave);
    return false;
  }
  return f.quantidade >= MAX_FALHAS;
}

// POST /api/auth/login  { email, senha, perfil? }  — perfil é a aba escolhida na tela
export async function POST(request: NextRequest) {
  let corpo: { email?: unknown; senha?: unknown; perfil?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const email = typeof corpo.email === "string" ? corpo.email : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  if (!email || !senha) {
    return NextResponse.json({ erro: "Informe e-mail e senha." }, { status: 400 });
  }

  const chave = chaveFalha(request, email);
  if (bloqueado(chave)) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
      { status: 429 }
    );
  }

  try {
    const usuario = await autenticar(email, senha);
    if (!usuario) {
      const atual = falhas.get(chave);
      falhas.set(chave, { quantidade: (atual?.quantidade ?? 0) + 1, desde: atual?.desde ?? Date.now() });
      return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
    }

    // A aba escolhida precisa bater com o perfil real da conta (o admin pode usar qualquer aba).
    const perfil = typeof corpo.perfil === "string" ? corpo.perfil : undefined;
    if (perfil && usuario.tipo !== "admin" && perfil !== usuario.tipo) {
      return NextResponse.json(
        { erro: `Esta conta não é de ${perfil === "artesao" ? "artesão" : perfil}. Use a aba correta.` },
        { status: 403 }
      );
    }

    falhas.delete(chave);
    const resposta = NextResponse.json({ usuario });
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
    console.error("POST /api/auth/login", erro);
    return NextResponse.json({ erro: "Erro ao entrar. Tente novamente." }, { status: 500 });
  }
}
