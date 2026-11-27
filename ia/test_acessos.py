import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import motor_recomendacao as motor
from resumir_acessos import main as resumir


class TestAcessos(unittest.TestCase):
    def test_tres_chamadas_acumulam_consultas_e_erro_no_mesmo_log(self):
        catalogo = motor.carregar_catalogo()
        origem = "GET /api/recomendacoes"
        with tempfile.TemporaryDirectory() as pasta:
            log = Path(pasta) / "acessos.jsonl"
            with patch.dict(os.environ, {"RAIZES_IA_LOG": str(log)}):
                motor.recomendar(catalogo, produto_id="p1", limite=3, origem=origem)
                motor.recomendar(catalogo, tecnica="Palha", regiao="Pilar", limite=3, origem=origem)
                with self.assertRaises(motor.ProdutoNaoEncontrado):
                    motor.recomendar(catalogo, produto_id="p999", origem=origem)

                eventos = [json.loads(linha) for linha in log.read_text(encoding="utf-8").splitlines()]
                saida = io.StringIO()
                with redirect_stdout(saida):
                    resumir()

        self.assertEqual([evento["quantidade"] for evento in eventos], [1, 10, 11, 0])
        self.assertEqual([evento["origem"] for evento in eventos], [origem] * 4)
        self.assertEqual(eventos[-1]["parametros"], {"produto_id": "desconhecido"})
        resumo = json.loads(saida.getvalue())
        self.assertEqual(
            resumo["chamadas_por_funcao"],
            {"buscar_produto_por_id": 2, "listar_produtos_disponiveis": 2},
        )
        self.assertEqual(resumo["total_erros"], 1)
        self.assertEqual(resumo["erros_por_codigo"], {"produto_nao_encontrado": 1})
        self.assertEqual(resumo["produtos_nunca_consultados"], ["p10"])
        self.assertEqual(
            resumo["produtos_por_frequencia"],
            {produto_id: 2 for produto_id in catalogo.produtos if produto_id != "p10"},
        )
