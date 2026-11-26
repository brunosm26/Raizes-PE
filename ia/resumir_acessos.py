"""Resume as consultas do serviço registradas em JSON Lines."""

import json
from collections import Counter

from log_acessos import caminho_log
from motor_recomendacao import carregar_catalogo


def main() -> None:
    chamadas = Counter()
    erros = Counter()
    produtos_consultados = Counter()
    caminho = caminho_log()
    try:
        with caminho.open(encoding="utf-8") as arquivo:
            for linha in arquivo:
                evento = json.loads(linha)
                chamadas[evento["funcao"]] += 1
                produtos_consultados.update(evento["ids_retornados"])
                if evento["status"] == "erro":
                    erros[evento["erro"]] += 1
    except FileNotFoundError:
        raise SystemExit(f"Log ainda não gerado em {caminho}. Faça as chamadas do README.")

    ids_catalogo = carregar_catalogo().produtos.keys()
    resumo = {
        "chamadas_por_funcao": dict(chamadas),
        "total_erros": sum(erros.values()),
        "erros_por_codigo": dict(erros),
        "produtos_por_frequencia": dict(produtos_consultados.most_common()),
        "produtos_nunca_consultados": sorted(ids_catalogo - produtos_consultados.keys()),
    }
    print(json.dumps(resumo, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
