import { NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/sessao";

export const dynamic = "force-dynamic";

// POST /api/auth/logout
export async function POST() {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set({ name: COOKIE_SESSAO, value: "", path: "/", maxAge: 0 });
  return resposta;
}
