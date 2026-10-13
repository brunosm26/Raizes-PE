"""RF-07: calcula e registra as métricas de avaliação do baseline (design.md, seção 4.1).

Simula um lote de chamadas de teste: uma recomendação para cada produto do
catálogo sintético, com o limite padrão. Depois calcula as três métricas do
design.md sobre esse lote e grava o resultado em resultados/metricas_baseline.json.

Uso (a partir da pasta ia/):  python avaliar_baseline.py

Observação: no design.md as métricas saem dos logs reais do endpoint. Neste
mockup não existe tráfego real, então o lote é simulado sobre o catálogo.
"""

from __future__ import annotations

import json
from pathlib import Path

import motor_recomendacao as motor

ARQUIVO_RESULTADO = Path(__file__).resolve().parent / "resultados" / "metricas_baseline.json"


def avaliar() -> dict:
    catalogo = motor.carregar_catalogo()
    elegiveis = {p.id for p in catalogo.elegiveis}

    chamadas = [motor.recomendar(catalogo, produto_id=pid) for pid in catalogo.produtos]
    itens = [item for chamada in chamadas for item in chamada["recomendacoes"]]

    chamadas_cold_start = sum(1 for c in chamadas if c["estrategia_aplicada"] == motor.ESTRATEGIA_COLD_START)
    distintos = {item["produto_id"] for item in itens}
    itens_diversificados = sum(1 for item in itens if item["criterio"] == motor.CRITERIO_DIVERSIFICACAO)

    return {
        "chamadas_simuladas": len(chamadas),
        "itens_recomendados": len(itens),
        "taxa_cold_start": round(chamadas_cold_start / len(chamadas), 4),
        "cobertura_catalogo": round(len(distintos & elegiveis) / len(elegiveis), 4),
        "taxa_diversificacao_efetiva": round(itens_diversificados / len(itens), 4),
    }


def main() -> None:
    metricas = avaliar()
    ARQUIVO_RESULTADO.parent.mkdir(parents=True, exist_ok=True)
    ARQUIVO_RESULTADO.write_text(
        json.dumps(metricas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print("Métricas do baseline (lote simulado sobre o catálogo sintético)")
    print(f"  chamadas simuladas           {metricas['chamadas_simuladas']}")
    print(f"  itens recomendados           {metricas['itens_recomendados']}")
    print(f"  taxa de cold start           {metricas['taxa_cold_start']:.1%}")
    print(f"  cobertura do catálogo        {metricas['cobertura_catalogo']:.1%}")
    print(f"  diversificação efetiva       {metricas['taxa_diversificacao_efetiva']:.1%}")
    print(f"Registrado em {ARQUIVO_RESULTADO.relative_to(ARQUIVO_RESULTADO.parent.parent)}")


if __name__ == "__main__":
    main()
