import { NextResponse } from "next/server";
import { alterarAtividade } from "@/lib/servidor/atividadeAdmin";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  try {
    await exigirSessao(["admin"]);
    const { tipo, id } = await params;
    const corpo: unknown = await request.json().catch(() => null);
    await alterarAtividade(tipo, id, corpo);
    return new NextResponse(null, { status: 204 });
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ erro: erro.message }, { status: erro.status });
    console.error("PATCH /api/admin/atividade", erro);
    return NextResponse.json({ erro: "Não foi possível atualizar o cadastro." }, { status: 500 });
  }
}
