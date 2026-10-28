import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./ajudantes"; // ambiente de teste antes de carregar o service (sem banco)
import { limitar } from "../src/services/catalogoService";
import { lerCookie } from "../src/utils/cookies";
import { ErroHttp } from "../src/utils/erroHttp";
import { ehUuid, resolverId } from "../src/utils/ids";
import { textoDaQuery } from "../src/utils/query";
import { hashSenha, verificarSenha } from "../src/utils/senha";

// Funções puras de utils e services que migraram do Next para o backend. Nada aqui toca o banco.

describe("lerCookie", () => {
  it("acha o cookie pelo nome exato, com espaços e vários cookies", () => {
    assert.equal(lerCookie("a=1; raizes_sessao=abc; b=2", "raizes_sessao"), "abc");
    assert.equal(lerCookie("  raizes_sessao = abc ", "raizes_sessao"), "abc");
    assert.equal(lerCookie("x_raizes_sessao=1; raizes_sessao_2=2", "raizes_sessao"), undefined);
  });

  it("decodifica o valor e devolve undefined para cabeçalho vazio ou valor malformado", () => {
    assert.equal(lerCookie("n=a%20b", "n"), "a b");
    assert.equal(lerCookie("n=a=b", "n"), "a=b");
    assert.equal(lerCookie(undefined, "n"), undefined);
    assert.equal(lerCookie("", "n"), undefined);
    assert.equal(lerCookie("semigual; n", "n"), undefined);
    assert.equal(lerCookie("n=%E0%A4%A", "n"), undefined);
  });
});

describe("ids", () => {
  it("ehUuid aceita UUID em qualquer caixa e recusa o resto", () => {
    assert.equal(ehUuid("30000000-0000-4000-8000-000000000004"), true);
    assert.equal(ehUuid("ABCDEF00-0000-4000-8000-00000000000A"), true);
    assert.equal(ehUuid("p4"), false);
    assert.equal(ehUuid("30000000-0000-4000-8000-00000000000"), false);
  });

  it("resolverId traduz os ids antigos do mock para os UUIDs da carga e mantém o resto", () => {
    assert.equal(resolverId("p4"), "30000000-0000-4000-8000-000000000004");
    assert.equal(resolverId("u7"), "10000000-0000-4000-8000-000000000007");
    assert.equal(resolverId("a12"), "20000000-0000-4000-8000-000000000012");
    const uuid = "30000000-0000-4000-8000-000000000001";
    assert.equal(resolverId(uuid), uuid);
    for (const outro of ["x1", "p", "p1234567", "P1", "nao-existe"]) assert.equal(resolverId(outro), outro);
  });
});

describe("query e limite", () => {
  it("textoDaQuery pega o primeiro valor e ignora o que não é texto", () => {
    assert.equal(textoDaQuery("Cerâmica"), "Cerâmica");
    assert.equal(textoDaQuery(["1", "2"]), "1");
    assert.equal(textoDaQuery(undefined), undefined);
    assert.equal(textoDaQuery(3), undefined);
    assert.equal(textoDaQuery([{ a: 1 }]), undefined);
  });

  it("limitar usa o padrão quando não é número e prende entre 1 e o máximo", () => {
    assert.equal(limitar("5", 3), 5);
    assert.equal(limitar(undefined, 3), 3);
    assert.equal(limitar("abc", 3), 3);
    assert.equal(limitar(5, 3), 3); // só texto (vem da query string)
    assert.equal(limitar("0", 3), 1);
    assert.equal(limitar("-7", 3), 1);
    assert.equal(limitar("500", 3), 20);
    assert.equal(limitar("500", 3, 50), 50);
  });
});

describe("senha (scrypt)", () => {
  it("gera hash no formato scrypt$N$r$p$sal$hash, com sal novo a cada vez, e confere a senha", async () => {
    const hash = await hashSenha("segredo-123");
    assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    assert.notEqual(await hashSenha("segredo-123"), hash);
    assert.equal(await verificarSenha("segredo-123", hash), true);
    assert.equal(await verificarSenha("segredo-124", hash), false);
  });

  it("recusa hash armazenado malformado sem lançar erro", async () => {
    const hash = await hashSenha("x");
    for (const ruim of ["", "texto", hash.replace("scrypt", "bcrypt"), `${hash}$extra`, hash.split("$").slice(0, 5).join("$")]) {
      assert.equal(await verificarSenha("x", ruim), false);
    }
  });
});

describe("ErroHttp", () => {
  it("carrega status e mensagem e continua sendo um Error", () => {
    const erro = new ErroHttp(409, "Só restam 2 unidade(s).");
    assert.ok(erro instanceof Error);
    assert.equal(erro.status, 409);
    assert.equal(erro.message, "Só restam 2 unidade(s).");
    assert.equal(erro.name, "ErroHttp");
  });
});
