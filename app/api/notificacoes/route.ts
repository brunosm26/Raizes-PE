import { NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { listarNotificacoes, resumirFila } from "@/lib/servidor/processamentoAssincrono";

export const dynamic = "force-dynamic";

// GET /api/notificacoes — as notificações que o worker já processou para o usuário logado.
// Admin recebe também o resumo da fila (contagem por status e jobs recentes).
export async function GET() {
  try {
    const sessao = await exigirSessao();
    const caixa = listarNotificacoes(sessao.id);
    const corpo = sessao.tipo === "admin" ? { ...caixa, fila: resumirFila() } : caixa;
    return NextResponse.json(corpo, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    if (erro instanceof ErroAuth) {
      return NextResponse.json({ ok: false, erro: erro.message }, { status: erro.status });
    }
    console.error("GET /api/notificacoes", erro);
    return NextResponse.json({ ok: false, erro: "Erro interno do servidor" }, { status: 500 });
  }
}
