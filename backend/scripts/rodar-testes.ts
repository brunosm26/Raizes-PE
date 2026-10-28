// Roda todos os test/**/*.test.ts com o tsx --test. A lista de arquivos é montada aqui,
// e não pelo shell: o cmd.exe não expande "*" e o node --test só aceita padrões a partir
// do Node 21, então "tsx --test test/*.test.ts" falhava no Windows com Node 20.
// Argumentos extras vão para o node --test (ex.: npm test -- --test-reporter=spec).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const pasta = join(__dirname, "..", "test");
const arquivos = readdirSync(pasta, { recursive: true, encoding: "utf8" })
  .filter((nome) => nome.endsWith(".test.ts"))
  .sort()
  .map((nome) => join(pasta, nome));

const resultado = spawnSync(process.execPath, [require.resolve("tsx/cli"), "--test", ...process.argv.slice(2), ...arquivos], {
  stdio: "inherit",
});
process.exit(resultado.status ?? 1);
