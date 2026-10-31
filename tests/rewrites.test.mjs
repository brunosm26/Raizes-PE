import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Importa o next.config.mjs de novo (query diferente = módulo novo) com a API_URL desejada.
async function carregarConfig(apiUrl) {
  const antes = process.env.API_URL;
  if (apiUrl === undefined) delete process.env.API_URL;
  else process.env.API_URL = apiUrl;
  try {
    const url = pathToFileURL(resolve("next.config.mjs")).href + `?t=${Math.random()}`;
    return (await import(url)).default;
  } finally {
    if (antes === undefined) delete process.env.API_URL;
    else process.env.API_URL = antes;
  }
}

test("sem API_URL não há rewrites: valem as rotas do próprio Next", async () => {
  const config = await carregarConfig(undefined);
  assert.deepEqual(await config.rewrites(), []);
});

test("com API_URL, /api/* é repassado ao Express antes das rotas do Next", async () => {
  const config = await carregarConfig("http://localhost:4000/");
  assert.deepEqual(await config.rewrites(), {
    beforeFiles: [{ source: "/api/:caminho*", destination: "http://localhost:4000/api/:caminho*" }],
  });
});

test("API_URL sem http(s):// é recusada na subida, em vez de gerar um proxy quebrado", async () => {
  await assert.rejects(() => carregarConfig("localhost:4000"), /API_URL inválida/);
});
