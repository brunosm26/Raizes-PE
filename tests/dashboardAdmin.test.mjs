import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const arquivo = new URL("../app/admin/page.tsx", import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(arquivo, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});

function carregarDashboard(consultarArtesaos) {
  const exports = {};
  const bloco = ({ children }) => createElement("div", null, children);
  const modulos = {
    react: { useMemo: (calcular) => calcular() },
    "react/jsx-runtime": jsxRuntime,
    "@chakra-ui/react": { Box: bloco, Heading: bloco, SimpleGrid: bloco },
    recharts: { ResponsiveContainer: () => null },
    "@/components/CartaoEstatistica": {
      default: ({ rotulo, valor }) => createElement("output", { "aria-label": rotulo }, valor),
    },
    "@/components/MensagemErro": { default: () => null },
    "@/lib/contextoPedidos": { usePedidos: () => ({ todosOsPedidos: () => [] }) },
    "@/lib/contextoProdutos": {
      useProdutos: () => ({ produtosDoArtesao: () => [{ estoqueQtd: 1 }] }),
    },
    "@/lib/useArtesaosAdmin": {
      useArtesaosAdmin: () => ({ artesaos: consultarArtesaos(), carregando: false, erro: false }),
    },
  };
  runInNewContext(outputText, {
    exports,
    require: (nome) => {
      if (nome === "recharts") {
        return new Proxy(modulos.recharts, { get: (controles, nome) => controles[nome] ?? bloco });
      }
      assert.ok(nome in modulos, `Dependência inesperada: ${nome}`);
      return modulos[nome];
    },
  });
  return exports.default;
}

test("dashboard conta apenas artesãos aprovados e ativos a cada leitura", () => {
  let artesaos = [
    { usuarioId: "aprovado", aprovado: true, ativo: true },
    { usuarioId: "pendente", aprovado: false, ativo: true },
    { usuarioId: "inativo", aprovado: true, ativo: false },
  ];
  const Dashboard = carregarDashboard(() => artesaos);
  const renderizar = () => renderToStaticMarkup(createElement(Dashboard));

  const inicial = renderizar();
  assert.match(inicial, /aria-label="Artesãos Ativos">1<\/output>/);
  assert.match(inicial, /aria-label="Produtos Cadastrados">3<\/output>/);

  artesaos = artesaos.map((artesao) =>
    artesao.usuarioId === "pendente" ? { ...artesao, aprovado: true } : artesao
  );
  assert.match(renderizar(), /aria-label="Artesãos Ativos">2<\/output>/);

  artesaos = artesaos.map((artesao) =>
    artesao.usuarioId === "aprovado" ? { ...artesao, ativo: false } : artesao
  );
  assert.match(renderizar(), /aria-label="Artesãos Ativos">1<\/output>/);
});
