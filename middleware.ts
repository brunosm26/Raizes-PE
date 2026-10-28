import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, lerToken, PERFIS_POR_AREA } from "@/lib/sessao";
import type { TipoUsuario } from "@/lib/tipos";

// Barreira de acesso por perfil (as rotas da API conferem de novo no servidor):
//   /meus-pedidos → comprador (e admin)   /checkout → comprador
//   /painel       → artesão (e admin)     /admin    → admin
// Sem login vai para /login; com login mas perfil errado volta para a vitrine.
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const area = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/painel")
      ? "painel"
      : pathname.startsWith("/checkout")
        ? "checkout"
        : "pedidos";

  let sessao = null;
  try {
    sessao = await lerToken(request.cookies.get(COOKIE_SESSAO)?.value);
  } catch {
    // SESSION_SECRET ausente: trata como sem sessão (a tela de login mostra o erro real)
  }

  if (!sessao) {
    const destino = new URL("/login", request.url);
    destino.searchParams.set("proxima", pathname + search);
    return NextResponse.redirect(destino);
  }

  const permitidos: readonly TipoUsuario[] = PERFIS_POR_AREA[area];
  if (!permitidos.includes(sessao.tipo)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/meus-pedidos/:path*", "/checkout/:path*", "/painel/:path*", "/admin/:path*"],
};
