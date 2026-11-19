import { NextRequest, NextResponse } from "next/server";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";
import { ErroNotificacao, marcarComoLidas } from "@/lib/servidor/processamentoAssincrono";

export const dynamic = "force-dynamic";

// Corpo vazio vale como "marcar todas", igual ao Express.
async function lerCorpo(request: NextRequest): Promise<{ ids?: unknown }> {
  const texto = await request.text();
  if (texto.trim() === "") return {};
  const corpo: unknown = JSON.parse(texto);
  return typeof corpo === "object" && corpo !== null ? (corpo as { ids?: unknown }) : {};
}

// POST /api/notificacoes/ler  { ids?: string[] } — sem ids, marca todas do usuário logado
export async function POST(request: NextRequest) {
  try {
    const corpo = await lerCorpo(request);
    const sessao = await exigirSessao();
    return NextResponse.json(marcarComoLidas(sessao.id, corpo.ids));
  } catch (erro) {
    if (erro instanceof SyntaxError) {
      return NextResponse.json({ ok: false, erro: "Corpo da requisição inválido." }, { status: 400 });
    }
    if (erro instanceof ErroAuth || erro instanceof ErroNotificacao) {
      return NextResponse.json({ ok: false, erro: erro.message }, { status: erro.status });
    }
    console.error("POST /api/notificacoes/ler", erro);
    return NextResponse.json({ ok: false, erro: "Erro interno do servidor" }, { status: 500 });
  }
}
