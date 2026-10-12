"""Motor de regras (baseline) do módulo de recomendação do Origem / Raízes PE.

Este arquivo é a lógica pura: não conhece HTTP nem BentoML, só recebe um
catálogo e devolve um dicionário no formato do contrato (design.md, seção 5).
O servidor (servico.py) e o script de métricas (avaliar_baseline.py) usam
exatamente esta mesma função, então o que se mede é o que se serve.

Algoritmo (design.md, seção 4):
  0. Entrada: um produto de referência (produto_id) OU um filtro explícito
     de técnica e/ou região.
  1. Pool de candidatos: produtos elegíveis (estoque > 0) da mesma técnica
     ou da mesma região (RF-01, RF-02).
  2. Ordena o pool por popularidade = unidades vendidas + nota média (RF-03).
  3. Se o pool não preenche as vagas de popularidade, completa com os mais
     populares da base geral (cold start, RF-05). Empate: mais recente primeiro.
  4. Diversificação (RF-06): 30% da lista (arredondado para cima) fica
     reservada para os produtos de menor popularidade que ainda não entraram.
  5. Devolve até `limite` itens, cada um com o critério que o originou (RNF-04).
"""

from __future__ import annotations

import json
import math
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path

CAMINHO_CATALOGO = Path(__file__).resolve().parent / "dados" / "catalogo_sintetico.json"

LIMITE_PADRAO = 5
LIMITE_MAXIMO = 20
FRACAO_DIVERSIFICACAO = 0.30

ESTRATEGIA_PRINCIPAL = "tecnica_regiao_popularidade"
ESTRATEGIA_COLD_START = "cold_start"

CRITERIO_TECNICA = "mesma_tecnica"
CRITERIO_REGIAO = "mesma_regiao"
CRITERIO_POPULARIDADE = "popularidade"
CRITERIO_DIVERSIFICACAO = "diversificacao"


# ---------------------------------------------------------------------------
# Erros do contrato (cada um já sabe seu código HTTP e o corpo da resposta)
# ---------------------------------------------------------------------------


class ErroDeContrato(Exception):
    status_http = 400
    codigo = "requisicao_invalida"

    def __init__(self, mensagem: str) -> None:
        super().__init__(mensagem)
        self.mensagem = mensagem


class ParametrosInsuficientes(ErroDeContrato):
    status_http = 400
    codigo = "parametros_insuficientes"


class LimiteInvalido(ErroDeContrato):
    status_http = 400
    codigo = "limite_invalido"


class ProdutoNaoEncontrado(ErroDeContrato):
    status_http = 404
    codigo = "produto_nao_encontrado"


# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Produto:
    id: str
    nome: str
    tecnica: str
    categoria: str
    preco: float
    estoque_qtd: int
    data_cadastro: date
    artesao_id: str
    regiao_origem: str
    vendas: int
    nota_media: float
    popularidade: float


@dataclass(frozen=True)
class Catalogo:
    produtos: dict[str, Produto]

    @property
    def elegiveis(self) -> list[Produto]:
        """Produtos que podem ser recomendados: com estoque disponível."""
        return [p for p in self.produtos.values() if p.estoque_qtd > 0]


def carregar_catalogo(caminho: Path = CAMINHO_CATALOGO) -> Catalogo:
    """Lê o JSON sintético e calcula vendas, nota média e popularidade."""
    bruto = json.loads(Path(caminho).read_text(encoding="utf-8"))

    regiao_por_artesao = {a["id"]: a["regiao_origem"] for a in bruto["artesao"]}

    vendas: dict[str, int] = {}
    for item in bruto["item_pedido"]:
        vendas[item["produto_id"]] = vendas.get(item["produto_id"], 0) + item["quantidade"]

    notas: dict[str, list[int]] = {}
    for av in bruto["avaliacao"]:
        notas.setdefault(av["produto_id"], []).append(av["nota"])

    produtos: dict[str, Produto] = {}
    for p in bruto["produto"]:
        qtd_vendida = vendas.get(p["id"], 0)
        lista_notas = notas.get(p["id"], [])
        media = sum(lista_notas) / len(lista_notas) if lista_notas else 0.0
        produtos[p["id"]] = Produto(
            id=p["id"],
            nome=p["nome"],
            tecnica=p["tecnica"],
            categoria=p["categoria"],
            preco=float(p["preco"]),
            estoque_qtd=int(p["estoque_qtd"]),
            data_cadastro=date.fromisoformat(p["data_cadastro"]),
            artesao_id=p["artesao_id"],
            regiao_origem=regiao_por_artesao[p["artesao_id"]],
            vendas=qtd_vendida,
            nota_media=round(media, 2),
            popularidade=round(qtd_vendida + media, 2),
        )
    return Catalogo(produtos=produtos)


# ---------------------------------------------------------------------------
# Funções auxiliares
# ---------------------------------------------------------------------------


def _normalizar(texto: str) -> str:
    """Minúsculas, sem acento e sem espaços repetidos (para comparar textos)."""
    decomposto = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in decomposto if unicodedata.category(c) != "Mn")
    return " ".join(sem_acento.casefold().split())


def _limpar(valor: str | None) -> str | None:
    if valor is None:
        return None
    valor = valor.strip()
    return valor or None


def _validar_limite(valor: int | str | None) -> int:
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return LIMITE_PADRAO
    try:
        limite = int(valor)
    except (TypeError, ValueError):
        raise LimiteInvalido(f"O limite deve ser um número inteiro entre 1 e {LIMITE_MAXIMO}.")
    if not 1 <= limite <= LIMITE_MAXIMO:
        raise LimiteInvalido(f"O limite deve ser um número inteiro entre 1 e {LIMITE_MAXIMO}.")
    return limite


def _chave_mais_popular(p: Produto) -> tuple:
    """Popularidade maior primeiro; empate: cadastro mais recente, depois id."""
    return (-p.popularidade, -p.data_cadastro.toordinal(), p.id)


def _chave_menos_popular(p: Produto) -> tuple:
    """Popularidade menor primeiro; empate: cadastro mais recente, depois id."""
    return (p.popularidade, -p.data_cadastro.toordinal(), p.id)


def _item_resposta(p: Produto, criterio: str) -> dict:
    return {
        "produto_id": p.id,
        "nome": p.nome,
        "tecnica": p.tecnica,
        "preco": p.preco,
        "criterio": criterio,
    }


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------


def recomendar(
    catalogo: Catalogo,
    produto_id: str | None = None,
    tecnica: str | None = None,
    regiao: str | None = None,
    limite: int | str | None = None,
) -> dict:
    """Devolve a recomendação no formato do contrato (design.md, seção 5).

    Se `produto_id` for informado, ele manda: `tecnica` e `regiao` são ignorados.
    Sem `produto_id`, é preciso informar `tecnica` e/ou `regiao`.
    """
    limite_final = _validar_limite(limite)
    produto_id = _limpar(produto_id)
    tecnica = _limpar(tecnica)
    regiao = _limpar(regiao)

    if produto_id is None and tecnica is None and regiao is None:
        raise ParametrosInsuficientes("Informe produto_id, ou ao menos um dos campos tecnica/regiao.")

    # 0. Define o alvo da busca: produto de referência ou filtro explícito.
    excluidos: set[str] = set()
    filtro_aplicado: dict | None = None
    if produto_id is not None:
        referencia = catalogo.produtos.get(produto_id)
        if referencia is None:
            raise ProdutoNaoEncontrado("Nenhum produto com o id informado foi encontrado no catálogo.")
        alvo_tecnica: str | None = referencia.tecnica
        alvo_regiao: str | None = referencia.regiao_origem
        excluidos.add(referencia.id)
    else:
        alvo_tecnica, alvo_regiao = tecnica, regiao
        filtro_aplicado = {"tecnica": tecnica, "regiao": regiao}

    tecnica_norm = _normalizar(alvo_tecnica) if alvo_tecnica else None
    regiao_norm = _normalizar(alvo_regiao) if alvo_regiao else None
    elegiveis = [p for p in catalogo.elegiveis if p.id not in excluidos]

    # 1. Pool de candidatos: mesma técnica OU mesma região (RF-01, RF-02).
    pool: list[tuple[Produto, str]] = []
    for p in elegiveis:
        if tecnica_norm and _normalizar(p.tecnica) == tecnica_norm:
            pool.append((p, CRITERIO_TECNICA))
        elif regiao_norm and regiao_norm in _normalizar(p.regiao_origem):
            pool.append((p, CRITERIO_REGIAO))

    # 2. Ordena o pool por popularidade (RF-03).
    pool.sort(key=lambda par: _chave_mais_popular(par[0]))

    # Vagas: a fração de diversificação é reservada (RF-06); o resto é por popularidade.
    vagas_diversificacao = math.ceil(limite_final * FRACAO_DIVERSIFICACAO) if limite_final >= 2 else 0
    vagas_populares = limite_final - vagas_diversificacao

    # 3. Cold start (RF-05): se o pool não enche as vagas, completa com a base geral.
    ranqueados: list[tuple[Produto, str, bool]] = [(p, c, False) for p, c in pool]
    if len(ranqueados) < vagas_populares:
        ids_no_pool = {p.id for p, _ in pool}
        complemento = sorted((p for p in elegiveis if p.id not in ids_no_pool), key=_chave_mais_popular)
        faltam = vagas_populares - len(ranqueados)
        ranqueados += [(p, CRITERIO_POPULARIDADE, True) for p in complemento[:faltam]]

    topo = ranqueados[:vagas_populares]
    usou_cold_start = any(veio_do_complemento for _, _, veio_do_complemento in topo)

    # 4. Diversificação (RF-06): os menos populares que ainda não entraram na lista.
    ids_usados = {p.id for p, _, _ in topo}
    restantes = [p for p in elegiveis if p.id not in ids_usados]
    diversificados = sorted(restantes, key=_chave_menos_popular)[:vagas_diversificacao]

    recomendacoes = [_item_resposta(p, criterio) for p, criterio, _ in topo]
    recomendacoes += [_item_resposta(p, CRITERIO_DIVERSIFICACAO) for p in diversificados]

    return {
        "produto_referencia_id": produto_id,
        "filtro_aplicado": filtro_aplicado,
        "estrategia_aplicada": ESTRATEGIA_COLD_START if usou_cold_start else ESTRATEGIA_PRINCIPAL,
        "recomendacoes": recomendacoes,
    }
