import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Senha em scrypt, no formato scrypt$N$r$p$sal$hash (o mesmo de db/07_autenticacao.sql).

const scrypt = promisify(scryptCb) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number }
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await scrypt(senha, sal, 64, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${chave.toString("base64")}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [algoritmo, n, r, p, sal, esperado, ...resto] = armazenado.split("$");
  if (algoritmo !== "scrypt" || !n || !r || !p || !sal || !esperado || resto.length > 0) return false;
  try {
    const esperadoBuf = Buffer.from(esperado, "base64");
    const obtido = await scrypt(senha, Buffer.from(sal, "base64"), esperadoBuf.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return obtido.length === esperadoBuf.length && timingSafeEqual(obtido, esperadoBuf);
  } catch {
    return false;
  }
}
