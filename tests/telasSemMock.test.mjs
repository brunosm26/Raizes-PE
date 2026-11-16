import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Aceite da PI4-143 (PR2): as telas do admin, a vitrine, o rodapé e o modal de produto não
// importam lib/dadosFalsos.ts nem os mocks de lib/apiFalsa.ts. Os arquivos mock continuam no
// repositório (a remoção é a PI4-144); aqui só se confere quem os importa.

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const TELAS = [
  "app/admin/page.tsx",
  "app/admin/artesaos/page.tsx",
  "app/admin/produtos/page.tsx",
  "app/admin/categorias/page.tsx",
  "app/admin/pedidos/page.tsx",
  "app/admin/layout.tsx",
  "components/VisaoVitrine.tsx",
  "components/Rodape.tsx",
  "components/ModalAdicionarProduto.tsx",
];

// Mocks de lib/apiFalsa.ts substituídos pelas rotas GET /api/artesaos e GET /api/filtros
// e pela constante TECNICAS (lib/tipos.ts).
const MOCKS = ["getArtesaos", "getUsuarios", "categorias", "regioes", "tecnicas"];

function importacoes(codigo) {
  const lista = [];
  const padrao = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  for (const m of codigo.matchAll(padrao)) lista.push({ nomes: m[1], origem: m[2] });
  return lista;
}

for (const arquivo of TELAS) {
  test(`${arquivo} não importa dadosFalsos nem os mocks de apiFalsa`, () => {
    const codigo = fs.readFileSync(path.join(raiz, arquivo), "utf8");
    for (const { nomes, origem } of importacoes(codigo)) {
      assert.doesNotMatch(origem, /dadosFalsos/, `${arquivo} importa ${origem}`);
      if (/apiFalsa$/.test(origem)) {
        const importados = nomes.replace(/[{}]/g, "").split(",").map((n) => n.trim().split(/\s+as\s+/)[0]);
        for (const mock of MOCKS) {
          assert.ok(!importados.includes(mock), `${arquivo} importa ${mock} de ${origem}`);
        }
      }
    }
  });
}
