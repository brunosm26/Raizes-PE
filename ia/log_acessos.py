"""Registro das consultas do serviço ao catálogo sintético."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

CAMINHO_PADRAO = Path(__file__).resolve().parent / "logs" / "acessos.jsonl"
TRAVA_ESCRITA = Lock()


def caminho_log() -> Path:
    configurado = os.environ.get("RAIZES_IA_LOG")
    return Path(configurado) if configurado else CAMINHO_PADRAO


def registrar_acesso(
    funcao: str,
    origem: str,
    parametros: dict,
    ids_retornados: list[str],
    erro: str | None = None,
) -> None:
    evento = {
        "data_hora": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "funcao": funcao,
        "origem": origem,
        "parametros": parametros,
        "quantidade": len(ids_retornados),
        "ids_retornados": ids_retornados,
        "status": "erro" if erro else "sucesso",
        "erro": erro,
    }
    linha = json.dumps(evento, ensure_ascii=False) + "\n"
    caminho = caminho_log()
    with TRAVA_ESCRITA:
        caminho.parent.mkdir(parents=True, exist_ok=True)
        with caminho.open("a", encoding="utf-8") as arquivo:
            arquivo.write(linha)
