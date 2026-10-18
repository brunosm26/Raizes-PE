import { NextRequest, NextResponse } from "next/server";
import { calcularRecomendacoes } from "@/lib/motorRecomendacao";
import { obterSessao } from "@/lib/servidor/auth";

export const dynamic = "force-dynamic";

// GET /api/recomendacoes?limite=4
// Comprador logado recebe recomendações pelo próprio histórico; visitante (ou outro
// perfil) recebe o cold start. O comprador vem da sessão, nunca da URL.
export async function GET(request: NextRequest) {
  const limiteStr = request.nextUrl.searchParams.get("limite");
  const limite = limiteStr ? parseInt(limiteStr, 10) : 4;

  try {
    const sessao = await obterSessao();
    const compradorId = sessao?.tipo === "comprador" ? sessao.id : undefined;
    const recomendacoes = await calcularRecomendacoes(
      compradorId,
      isNaN(limite) ? 4 : Math.min(Math.max(limite, 1), 20)
    );
    return NextResponse.json({
      sucesso: true,
      origem: "baseline_ia_v1",
      compradorId: compradorId ?? null,
      total: recomendacoes.length,
      dados: recomendacoes,
    });
  } catch (erro) {
    console.error("GET /api/recomendacoes", erro);
    return NextResponse.json(
      { sucesso: false, mensagem: "Erro ao gerar recomendações de produtos" },
      { status: 500 }
    );
  }
}
