import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parse } from "yaml";

// Garante que openapi.yaml e as rotas do Express descrevem a mesma API:
// toda rota registrada está documentada e todo caminho documentado existe.

const raiz = join(__dirname, "..");
const spec = parse(readFileSync(join(raiz, "openapi.yaml"), "utf8")) as {
  paths: Record<string, Record<string, { responses?: Record<string, unknown>; security?: unknown[] }>>;
};
const METODOS = ["get", "post", "put", "patch", "delete"];

// Lê src/routes: `rotas.use("/x", xRoutes)` no index e `xRoutes.get("/:id", ...)` em cada arquivo.
function rotasDoExpress(): Set<string> {
  const pasta = join(raiz, "src", "routes");
  const montagens = new Map<string, string>();
  for (const [, prefixo, router] of readFileSync(join(pasta, "index.ts"), "utf8").matchAll(
    /rotas\.use\("([^"]+)",\s*(\w+)\)/g
  )) {
    montagens.set(router!, prefixo!);
  }

  const rotas = new Set<string>();
  for (const arquivo of readdirSync(pasta).filter((f) => f !== "index.ts")) {
    const codigo = readFileSync(join(pasta, arquivo), "utf8");
    for (const [, router, metodo, caminho] of codigo.matchAll(/(\w+)\.(get|post|put|patch|delete)\("([^"]*)"/g)) {
      const prefixo = montagens.get(router!);
      assert.ok(prefixo, `${router} (em ${arquivo}) não está montado em routes/index.ts`);
      const completo = (prefixo + (caminho === "/" ? "" : caminho)).replace(/:(\w+)/g, "{$1}");
      rotas.add(`${metodo!.toUpperCase()} ${completo}`);
    }
  }
  return rotas;
}

function rotasDaSpec(): Set<string> {
  const rotas = new Set<string>();
  for (const [caminho, operacoes] of Object.entries(spec.paths)) {
    for (const metodo of Object.keys(operacoes).filter((m) => METODOS.includes(m))) {
      rotas.add(`${metodo.toUpperCase()} ${caminho}`);
    }
  }
  return rotas;
}

describe("openapi.yaml", () => {
  const doCodigo = rotasDoExpress();
  const daSpec = rotasDaSpec();

  it("documenta todas as rotas do Express", () => {
    assert.deepEqual([...doCodigo].filter((r) => !daSpec.has(r)).sort(), []);
  });

  it("não documenta rota que não existe", () => {
    assert.deepEqual([...daSpec].filter((r) => !doCodigo.has(r)).sort(), []);
  });

  it("toda operação declara se exige sessão e, se exige, documenta o 401", () => {
    for (const [caminho, operacoes] of Object.entries(spec.paths)) {
      for (const [metodo, op] of Object.entries(operacoes)) {
        if (!METODOS.includes(metodo)) continue;
        assert.ok(Array.isArray(op.security), `${metodo} ${caminho} sem "security"`);
        const exigeSessao = op.security.length > 0 && !op.security.some((s) => Object.keys(s as object).length === 0);
        if (exigeSessao) assert.ok(op.responses?.["401"], `${metodo} ${caminho} exige sessão mas não documenta 401`);
      }
    }
  });
});

describe("Swagger UI", () => {
  it("serve a página em /api-docs e a spec em /api-docs.json", async () => {
    const { subirApi } = await import("./ajudantes.js");
    const api = await subirApi();
    try {
      const raiz = api.url.replace(/\/api$/, "");
      const pagina = await fetch(`${raiz}/api-docs/`);
      assert.equal(pagina.status, 200);
      assert.match(await pagina.text(), /<title>API Raízes PE<\/title>/);

      const servida = await (await fetch(`${raiz}/api-docs.json`)).json();
      assert.deepEqual(Object.keys(servida.paths).sort(), Object.keys(spec.paths).sort());
    } finally {
      await api.fechar();
    }
  });
});
