// Roda todos os tests/**/*.test.mjs com o node --test. A lista de arquivos é montada aqui,
// e não pelo shell: o cmd.exe não expande "*" e o node --test só aceita padrões a partir
// do Node 21, então "node --test tests/*.test.mjs" falhava no Windows com Node 20.
// Argumentos extras vão para o node --test (ex.: npm test -- --test-reporter=spec).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pasta = fileURLToPath(new URL("../tests", import.meta.url));
const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" })
  .filter((nome) => nome.endsWith(".test.mjs"))
  .sort()
  .map((nome) => join(pasta, nome));

const resultado = spawnSync(process.execPath, ["--test", ...process.argv.slice(2), ...arquivos], { stdio: "inherit" });
process.exit(resultado.status ?? 1);
