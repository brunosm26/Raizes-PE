import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { bancoDeTeste, itComBanco, json, subirApi, type Api } from "./ajudantes";
import {
  bancoEhLocal,
  ErroDeUso,
  executar,
  FLAG_AUTORIZACAO,
  lerArgumentos,
  validarSenha,
  type Ambiente,
} from "../scripts/contas-artesao";

// Script de senha das contas de artesão (PI4-143, D3). Sem banco: validação da senha, trava de
// host remoto e saída sem segredo. Com banco (TEST_DATABASE_URL LOCAL, carga db/05 + db/07):
// dry-run, --aplicar, idempotência e login com a senha gravada. Nenhum teste passa a flag de
// autorização: banco remoto nunca é alterado por aqui.

const SENHA_TESTE = "senha-de-teste-artesaos-143"; // placeholder dos testes, não é senha de conta real
const SEGREDO_DA_URL = "segredo-da-url-de-teste";
const URL_REMOTA = `postgresql://usuario:${SEGREDO_DA_URL}@banco-remoto.invalid:5432/banco?sslmode=require`;
const URL_LOCAL_FECHADA = `postgresql://usuario:${SEGREDO_DA_URL}@127.0.0.1:1/banco`;
const FORMATO_DE_HASH = /scrypt\$|[A-Za-z0-9+/]{40,}={0,2}/;
const PROIBIDOS = [SENHA_TESTE, SEGREDO_DA_URL, "banco-remoto.invalid", "127.0.0.1:1", "@raizespe.dev"];

const ARTESAOS_SEM_SENHA = ["Ateliê Barro Vivo", "José Bezerra", "Marlene Costa", "Raimundo Silva", "Vitalino Neto"];

async function rodar(args: string[], ambiente: Ambiente): Promise<{ codigo: number; saida: string }> {
  const linhas: string[] = [];
  const codigo = await executar(args, ambiente, (linha) => linhas.push(linha));
  return { codigo, saida: linhas.join("\n") };
}

// A mensagem de falha não repete o valor proibido, para o próprio teste não vazá-lo.
function conferirSaidaLimpa(saida: string, extras: string[] = []): void {
  [...PROIBIDOS, ...extras].forEach((proibido, i) => {
    assert.ok(!saida.includes(proibido), `a saída contém o valor proibido nº ${i}`);
  });
  assert.ok(!FORMATO_DE_HASH.test(saida), "a saída contém algo com formato de hash");
}

function recusaSemRepetir(valor: string | undefined): void {
  assert.throws(
    () => validarSenha(valor),
    (erro: unknown) => {
      assert.ok(erro instanceof ErroDeUso);
      if (valor?.trim()) assert.ok(!erro.message.includes(valor.trim()), "a mensagem repete a senha");
      return true;
    }
  );
}

describe("contas-artesao: sem banco", () => {
  it("SENHA_ARTESAOS: aceita de 8 a 200 caracteres", () => {
    assert.equal(validarSenha(SENHA_TESTE), SENHA_TESTE);
    assert.equal(validarSenha("12345678"), "12345678");
    assert.equal(validarSenha("x".repeat(200)), "x".repeat(200));
  });

  it("SENHA_ARTESAOS: recusa ausente, vazia, curta, longa, demo123, espaço nas pontas e aspas, sem repetir o valor", () => {
    for (const valor of [undefined, "", "   ", "1234567", "x".repeat(201), "demo123", "DEMO123"]) recusaSemRepetir(valor);
    for (const valor of [` ${SENHA_TESTE}`, `${SENHA_TESTE} `, `"${SENHA_TESTE}"`, `'${SENHA_TESTE}'`]) recusaSemRepetir(valor);
  });

  it("argumentos: dry-run é o padrão; --aplicar com e sem a flag; recusa os dois juntos e argumento solto", () => {
    assert.deepEqual(lerArgumentos([]), { aplicar: false, autorizado: false });
    assert.deepEqual(lerArgumentos(["--dry-run"]), { aplicar: false, autorizado: false });
    assert.deepEqual(lerArgumentos(["--aplicar"]), { aplicar: true, autorizado: false });
    assert.deepEqual(lerArgumentos(["--aplicar", FLAG_AUTORIZACAO]), { aplicar: true, autorizado: true });
    assert.throws(() => lerArgumentos(["--dry-run", "--aplicar"]), ErroDeUso);
    assert.throws(
      () => lerArgumentos(["--aplicar", SENHA_TESTE]),
      (erro: unknown) => erro instanceof ErroDeUso && !erro.message.includes(SENHA_TESTE)
    );
  });

  it("host: só localhost, 127.0.0.1 e ::1 são locais; URL inválida é recusada sem ser repetida", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]", "LOCALHOST"]) {
      assert.equal(bancoEhLocal(`postgresql://u:p@${host}:5432/banco`), true, host);
    }
    assert.equal(bancoEhLocal(URL_REMOTA), false);
    assert.equal(bancoEhLocal("postgresql://u:p@ep-exemplo-pooler.sa-east-1.aws.neon.tech/banco?sslmode=require"), false);
    assert.equal(bancoEhLocal("postgresql://u:p@localhost/banco?host=banco-remoto.invalid"), false, "?host= tem precedência");
    assert.equal(bancoEhLocal("postgresql:///banco"), false, "sem host conta como remoto");
    for (const invalida of ["nao-e-url-segredo", "mysql://u:segredo@localhost/banco"]) {
      assert.throws(
        () => bancoEhLocal(invalida),
        (erro: unknown) => erro instanceof ErroDeUso && !erro.message.includes("segredo")
      );
    }
  });

  it("--aplicar em banco remoto sem a flag: recusa antes de conectar e explica", async () => {
    const { codigo, saida } = await rodar(["--aplicar"], { DATABASE_URL: URL_REMOTA, SENHA_ARTESAOS: SENHA_TESTE });
    assert.equal(codigo, 2);
    assert.match(saida, /fora de localhost/);
    assert.ok(saida.includes(FLAG_AUTORIZACAO));
    assert.match(saida, /nenhuma conexão foi aberta/);
    conferirSaidaLimpa(saida);
  });

  it("--aplicar com a flag mas senha inválida: recusa antes de conectar", async () => {
    const { codigo, saida } = await rodar(["--aplicar", FLAG_AUTORIZACAO], { DATABASE_URL: URL_REMOTA, SENHA_ARTESAOS: "demo123" });
    assert.equal(codigo, 2);
    assert.match(saida, /demonstração/);
    conferirSaidaLimpa(saida, ["demo123"]);
  });

  it("senha passada como argumento: recusa sem repeti-la", async () => {
    const { codigo, saida } = await rodar(["--aplicar", SENHA_TESTE], { DATABASE_URL: URL_LOCAL_FECHADA });
    assert.equal(codigo, 2);
    conferirSaidaLimpa(saida);
  });

  it("sem DATABASE_URL: recusa", async () => {
    const { codigo, saida } = await rodar([], {});
    assert.equal(codigo, 2);
    assert.match(saida, /DATABASE_URL não definida/);
  });

  it("falha de conexão: código 1, só o código do erro, sem URL, senha nem hash", async () => {
    const { codigo, saida } = await rodar(["--aplicar"], { DATABASE_URL: URL_LOCAL_FECHADA, SENHA_ARTESAOS: SENHA_TESTE });
    assert.equal(codigo, 1);
    assert.match(saida, /^Falha: .*Nada foi gravado\.$/m);
    conferirSaidaLimpa(saida);
  });

  it("pela linha de comando (tsx): banco remoto sem a flag sai com código 2 e saída limpa", () => {
    const r = spawnSync(
      process.execPath,
      [require.resolve("tsx/cli"), join(__dirname, "..", "scripts", "contas-artesao.ts"), "--aplicar"],
      {
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env, DATABASE_URL: URL_REMOTA, SENHA_ARTESAOS: SENHA_TESTE },
      }
    );
    const saida = `${r.stdout}\n${r.stderr}`;
    assert.equal(r.status, 2, "código de saída");
    assert.ok(saida.includes(FLAG_AUTORIZACAO));
    conferirSaidaLimpa(saida);
  });
});

// Grava senha: só em banco local, mesmo que a TEST_DATABASE_URL remota tenha sido liberada.
let bancoLocal = false;
try {
  bancoLocal = bancoDeTeste !== undefined && bancoEhLocal(bancoDeTeste);
} catch {
  bancoLocal = false;
}
function itComBancoLocal(nome: string, fn: () => Promise<void>): void {
  if (bancoDeTeste && !bancoLocal) {
    it(nome, { skip: "TEST_DATABASE_URL fora de localhost: este teste grava senhas e só roda em banco local" }, fn);
    return;
  }
  itComBanco(nome, fn);
}

describe("contas-artesao: com banco", () => {
  let pool: Pool | undefined;
  let api: Api | undefined;
  let idsSemSenha: string[] = [];
  const ambiente = (): Ambiente => ({ DATABASE_URL: bancoDeTeste, SENHA_ARTESAOS: SENHA_TESTE });

  // Retrato das 9 contas fixas da carga db/05 (outros arquivos de teste criam e apagam usuários
  // em paralelo). md5 do hash, para comparar sem trazer o hash para o teste.
  async function retrato(): Promise<{ id: string; tipo: string; impressao: string | null }[]> {
    const { rows } = await pool!.query<{ id: string; tipo: string; impressao: string | null }>(
      `SELECT id, tipo, md5(senha_hash) AS impressao FROM origem.usuario
        WHERE id::text LIKE '10000000-0000-4000-8000-00000000000_' ORDER BY id`
    );
    return rows;
  }

  before(async () => {
    if (!bancoLocal) return;
    pool = new Pool({ connectionString: bancoDeTeste });
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM origem.usuario WHERE tipo = 'artesao' AND senha_hash IS NULL ORDER BY id`
    );
    idsSemSenha = rows.map((r) => r.id);
    api = await subirApi();
  });

  // Devolve o banco ao estado da carga: só as contas que estavam sem senha voltam a ficar sem.
  after(async () => {
    if (pool && idsSemSenha.length > 0) {
      await pool.query(`UPDATE origem.usuario SET senha_hash = NULL WHERE id = ANY($1::uuid[])`, [idsSemSenha]);
    }
    await pool?.end();
    await api?.fechar();
  });

  itComBancoLocal("dry-run lista só pelo nome os 5 artesãos sem senha e não grava nada", async () => {
    assert.equal(idsSemSenha.length, 5, "a carga de demonstração tem 5 artesãos sem senha");
    const antes = await retrato();

    const { codigo, saida } = await rodar(["--dry-run"], ambiente());

    assert.equal(codigo, 0);
    for (const nome of ARTESAOS_SEM_SENHA) assert.ok(saida.includes(`  - ${nome}`), nome);
    assert.match(saida, /^Total: 5$/m);
    for (const nome of ["Cooperativa de Tacaratu", "Carlos Andrade", "Ana Beatriz", "Administração"]) {
      assert.ok(!saida.includes(nome), `não lista ${nome}`);
    }
    conferirSaidaLimpa(saida, [bancoDeTeste!]);
    assert.deepEqual(await retrato(), antes);
  });

  itComBancoLocal("--aplicar grava só nos artesãos sem senha, um sal por conta, e não toca nos outros", async () => {
    const antes = await retrato();

    const { codigo, saida } = await rodar(["--aplicar"], ambiente());

    assert.equal(codigo, 0);
    assert.match(saida, /^Contas de artesão atualizadas: 5$/m);
    conferirSaidaLimpa(saida, [bancoDeTeste!]);

    const { rows } = await pool!.query<{ sem_senha: number; com_senha: number; distintos: number }>(
      `SELECT count(*) FILTER (WHERE senha_hash IS NULL)::int AS sem_senha,
              count(*) FILTER (WHERE senha_hash LIKE 'scrypt$%')::int AS com_senha,
              count(DISTINCT senha_hash)::int AS distintos
         FROM origem.usuario WHERE id = ANY($1::uuid[])`,
      [idsSemSenha]
    );
    assert.deepEqual(rows[0], { sem_senha: 0, com_senha: 5, distintos: 5 });

    const depois = await retrato();
    const intocadas = (r: { id: string }[]) => r.filter((u) => !idsSemSenha.includes(u.id));
    assert.deepEqual(intocadas(depois), intocadas(antes), "o artesão com senha e os outros perfis não mudam");
    assert.ok(
      depois.some((u) => u.tipo === "comprador" && u.impressao === null),
      "o comprador sem senha continua sem senha"
    );
  });

  itComBancoLocal("rodar --aplicar de novo não muda nada, e o dry-run mostra 0 restantes", async () => {
    const antes = await retrato();

    const segunda = await rodar(["--aplicar"], ambiente());
    assert.equal(segunda.codigo, 0);
    assert.match(segunda.saida, /^Contas de artesão atualizadas: 0$/m);
    assert.deepEqual(await retrato(), antes);

    const conferencia = await rodar([], ambiente());
    assert.match(conferencia.saida, /^Total: 0$/m);
  });

  itComBancoLocal("depois do --aplicar, um desses artesãos entra com a senha de teste", async () => {
    const r = await fetch(`${api!.url}/auth/login`, {
      method: "POST",
      ...json({ email: "vitalino@raizespe.dev", senha: SENHA_TESTE, perfil: "artesao" }),
    });
    assert.equal(r.status, 200);
    const { usuario } = await r.json();
    assert.equal(usuario.tipo, "artesao");
    assert.equal(usuario.nome, "Vitalino Neto");

    const demo = await fetch(`${api!.url}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.143" },
      body: JSON.stringify({ email: "vitalino@raizespe.dev", senha: "demo123", perfil: "artesao" }),
    });
    assert.equal(demo.status, 401, "a senha de demonstração não vale para essas contas");
  });
});
