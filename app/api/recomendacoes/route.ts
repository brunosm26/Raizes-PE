import { NextRequest, NextResponse } from "next/server";
import { calcularRecomendacoes } from "@/lib/motorRecomendacao";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const compradorId = searchParams.get("compradorId") ?? undefined;
  const limiteStr = searchParams.get("limite");
  const limite = limiteStr ? parseInt(limiteStr, 10) : 4;

  try {
    const recomendacoes = await calcularRecomendacoes(compradorId, isNaN(limite) ? 4 : limite);
    return NextResponse.json({
      sucesso: true,
      origem: "baseline_ia_v1",
      compradorId: compradorId ?? null,
      total: recomendacoes.length,
      dados: recomendacoes,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Erro ao gerar recomendações de produtos",
        erro: erro instanceof Error ? erro.message : String(erro),
      },
      { status: 500 }
    );
  }
}
