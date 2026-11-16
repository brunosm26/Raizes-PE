import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { diferencas } from "../scripts/comparar-esquemas";
import { montarDdl } from "../scripts/gerar-ddl";
import { exigirBancoLocalDescartavel, type UrlDoTime } from "../scripts/travaBanco";

// Migrations e DDL final (PI4-147). Nada aqui toca banco; as URLs são fictícias.

const NEON = "postgresql://dono:senha@ep-azul-123-pooler.sa-east-1.aws.neon.tech/raizes?sslmode=require";
const LOCAL = "postgresql://postgres:x@127.0.0.1:15433/raizes_b";
const doTime = (valor: string): UrlDoTime[] => [{ fonte: "backend/.env", variavel: "DIRECT_URL", valor }];

describe("trava dos scripts de banco descartável", () => {
  it("aceita host local e devolve só host, porta e banco", () => {
    assert.deepEqual(exigirBancoLocalDescartavel(LOCAL, "MIGRATE_DATABASE_URL", doTime(NEON)), {
      host: "127.0.0.1",
      porta: "15433",
      banco: "raizes_b",
    });
    exigirBancoLocalDescartavel("postgresql://postgres@localhost/raizes", "X", []);
    exigirBancoLocalDescartavel("postgresql://postgres@[::1]:5432/raizes", "X", []);
  });

  it("recusa host remoto, mesmo que não seja o do time", () => {
    assert.throws(
      () => exigirBancoLocalDescartavel("postgresql://u:s@ep-verde-9.neon.tech/outro", "MIGRATE_DATABASE_URL", []),
      /MIGRATE_DATABASE_URL precisa apontar para localhost/
    );
  });

  it("recusa a mesma URL do time e não mostra o valor", () => {
    assert.throws(
      () => exigirBancoLocalDescartavel(LOCAL, "COMPARAR_URL_A", doTime(LOCAL)),
      (erro: Error) => {
        assert.match(erro.message, /COMPARAR_URL_A aponta para o mesmo banco da DIRECT_URL de backend\/\.env/);
        assert.doesNotMatch(erro.message, /postgres:x|15433|raizes_b/);
        return true;
      }
    );
  });

  it("recusa URL que não é do PostgreSQL", () => {
    assert.throws(() => exigirBancoLocalDescartavel("https://127.0.0.1/x", "X", []), /Não foi possível analisar a X/);
  });
});

describe("comparador de esquemas", () => {
  it("catálogos iguais não têm diferença", () => {
    const a = new Map([["constraint | produto.ck_produto_preco", "def=CHECK (preco >= 0)"]]);
    assert.deepEqual(diferencas(a, new Map(a)), []);
  });

  it("aponta o que só existe em um lado e o que difere", () => {
    const a = new Map([
      ["constraint | produto.ck_produto_preco", "def=CHECK (preco >= 0)"],
      ["relacao | carrinho", "comentario=x"],
    ]);
    const b = new Map([
      ["relacao | carrinho", "comentario=y"],
      ["gatilho | pedido.trg_novo", "def=..."],
    ]);
    const difs = diferencas(a, b);
    assert.equal(difs.length, 3);
    assert.match(difs[0]!, /^- só em A: constraint \| produto\.ck_produto_preco/);
    assert.match(difs[1]!, /^\+ só em B: gatilho \| pedido\.trg_novo/);
    assert.match(difs[2]!, /^~ difere: relacao \| carrinho\n {4}A: comentario=x\n {4}B: comentario=y/);
  });
});

describe("db/ddl_final.sql", () => {
  it("está atualizado com as migrations (senão: npm run db:ddl)", () => {
    const arquivo = readFileSync(join(__dirname, "..", "..", "db", "ddl_final.sql"), "utf8").replace(/\r\n/g, "\n");
    assert.equal(arquivo, montarDdl());
  });

  it("traz as duas migrations, na ordem, dentro de uma transação", () => {
    const ddl = montarDdl();
    const i0 = ddl.indexOf("-- >>> migration 0_init");
    const i1 = ddl.indexOf("-- >>> migration 1_regras_sql");
    assert.ok(i0 > ddl.indexOf("BEGIN;") && i1 > i0 && ddl.trimEnd().endsWith("COMMIT;"));
  });
});
