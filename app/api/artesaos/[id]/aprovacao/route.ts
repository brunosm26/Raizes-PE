import { NextResponse } from "next/server";
import { ehUuid, resolverId } from "@/lib/idsLegados";
import { aprovarArtesao } from "@/lib/servidor/artesaos";
import { ErroAuth, exigirSessao } from "@/lib/servidor/auth";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirSessao(["admin"]);
    const id = resolverId((await params).id);
    if (!ehUuid(id) || !(await aprovarArtesao(id))) {
      return NextResponse.json({ ok: false, erro: "Artesão não encontrado" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (erro) {
    if (erro instanceof ErroAuth) return NextResponse.json({ ok: false, erro: erro.message }, { status: erro.status });
    console.error("PATCH /api/artesaos/:id/aprovacao", erro);
    return NextResponse.json({ ok: false, erro: "Erro interno do servidor" }, { status: 500 });
  }
}
