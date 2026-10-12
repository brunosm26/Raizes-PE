"""Serviço BentoML do módulo de recomendação do Origem / Raízes PE (mockup da AV2).

Duas portas de entrada para o mesmo motor (motor_recomendacao.py):

  GET  /api/recomendacoes   contrato da AV1 (design.md, seção 5). É a porta
                            principal e a usada nos testes do README.
  POST /recomendar          rota nativa do BentoML (aparece no Swagger da raiz),
                            com os mesmos campos no corpo JSON.

Subir (a partir da pasta ia/):  bentoml serve servico:Recomendador --port 3000
"""

from __future__ import annotations

import json
import logging
import time

import bentoml
from fastapi import FastAPI
from fastapi.responses import JSONResponse

import motor_recomendacao as motor

logger = logging.getLogger("bentoml.recomendador")

# Catálogo sintético carregado uma vez, na subida do serviço (RNF-02).
CATALOGO = motor.carregar_catalogo()


class RespostaJSON(JSONResponse):
    """JSON indentado e com acentos legíveis, para o docente conferir a saída a olho."""

    def render(self, content) -> bytes:
        return (json.dumps(content, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


app = FastAPI(
    title="Módulo de Recomendação - Origem / Raízes PE",
    description="Mockup da AV2. Contrato da AV1 (design.md, seção 5). Dados sintéticos.",
)


@app.exception_handler(Exception)
async def erro_interno(_requisicao, erro: Exception) -> RespostaJSON:
    # Mensagem genérica de propósito: detalhes internos só vão para o log (design.md, seção 7).
    logger.exception("falha inesperada ao gerar recomendacoes: %s", erro)
    return RespostaJSON(
        status_code=500,
        content={"erro": "erro_interno", "mensagem": "Não foi possível gerar as recomendações agora."},
    )


@app.get(
    "/recomendacoes",
    summary="Recomenda produtos a partir de um produto ou de um filtro de técnica/região",
    responses={
        400: {"description": "Nenhum parâmetro de entrada válido, ou limite inválido"},
        404: {"description": "produto_id informado não existe no catálogo"},
    },
)
def recomendacoes(
    produto_id: str | None = None,
    tecnica: str | None = None,
    regiao: str | None = None,
    limite: str | None = None,
):
    inicio = time.perf_counter()
    try:
        resposta = motor.recomendar(CATALOGO, produto_id, tecnica, regiao, limite)
    except motor.ErroDeContrato as erro:
        logger.warning(
            "recomendacoes recusada: status=%s erro=%s produto_id=%s tecnica=%s regiao=%s",
            erro.status_http, erro.codigo, produto_id, tecnica, regiao,
        )
        return RespostaJSON(
            status_code=erro.status_http,
            content={"erro": erro.codigo, "mensagem": erro.mensagem},
        )

    tempo_ms = (time.perf_counter() - inicio) * 1000
    logger.info(
        "recomendacoes ok: produto_id=%s estrategia=%s itens=%d tempo_ms=%.2f",
        produto_id, resposta["estrategia_aplicada"], len(resposta["recomendacoes"]), tempo_ms,
    )
    return RespostaJSON(content=resposta)


@bentoml.asgi_app(app, path="/api")
@bentoml.service(resources={"cpu": "1"})
class Recomendador:
    @bentoml.api
    def recomendar(
        self,
        produto_id: str | None = None,
        tecnica: str | None = None,
        regiao: str | None = None,
        limite: int = motor.LIMITE_PADRAO,
    ) -> dict:
        """Mesma recomendação da rota GET, no formato nativo do BentoML (POST com corpo JSON).

        Informe produto_id, ou ao menos um entre tecnica e regiao. Se produto_id
        vier junto, ele tem prioridade e os filtros são ignorados.
        """
        try:
            return motor.recomendar(CATALOGO, produto_id, tecnica, regiao, limite)
        except motor.ProdutoNaoEncontrado as erro:
            raise bentoml.exceptions.NotFound(erro.mensagem)
        except motor.ErroDeContrato as erro:
            raise bentoml.exceptions.BadInput(erro.mensagem)
