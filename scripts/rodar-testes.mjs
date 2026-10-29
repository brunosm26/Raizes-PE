// Roda todos os tests/**/*.test.mjs com o node --test. A lista de arquivos é montada aqui,
// e não pelo shell: o cmd.exe não expande "*" e o node --test só aceita padrões a partir
// do Node 21, então "node --test tests/*.test.mjs" falhava no Windows com Node 20.
// Arquivos passados (npm test -- tests/sessao.test.mjs) substituem a lista; os demais
// argumentos vão para o node --test (ex.: npm test -- --test-reporter=spec).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ehArquivo = (arg) => !arg.startsWith("-") && arg.endsWith(".test.mjs");
const extras = process.argv.slice(2);
const escolhidos = extras.filter(ehArquivo);
const opcoes = extras.filter((arg) => !ehArquivo(arg));

const pasta = fileURLToPath(new URL("../tests", import.meta.url));
const arquivos =
  escolhidos.length > 0
    ? escolhidos
    : readdirSync(pasta, { recursive: true, encoding: "utf8" })
        .filter((nome) => nome.endsWith(".test.mjs"))
        .sort()
        .map((nome) => join(pasta, nome));

const resultado = spawnSync(process.execPath, ["--test", ...opcoes, ...arquivos], { stdio: "inherit" });
if (resultado.error) {
  console.error(`Não foi possível iniciar os testes: ${resultado.error.message}`);
  process.exit(1);
}
if (resultado.signal) {
  console.error(`Os testes foram interrompidos (${resultado.signal}).`);
  process.exit(1);
}
process.exit(resultado.status ?? 1);
