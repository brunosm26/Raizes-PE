// Autenticação no servidor: senha (scrypt), login, cadastro e leitura da sessão.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { COOKIE_SESSAO, lerToken, type DadosSessao } from "@/lib/sessao";
import type { TipoUsuario } from "@/lib/tipos";

const scrypt = promisify(scryptCb) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number }
) => Promise<Buffer>;

export class ErroAuth extends Error {
  constructor(mensagem: string, public status = 401) {
    super(mensagem);
  }
}

const N = 16384;
const R = 8;
const P = 1;

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await scrypt(senha, sal, 64, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${chave.toString("base64")}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, esperado] = partes;
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

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  tipo: TipoUsuario;
}

// Hash descartável: quando o e-mail não existe, ainda gastamos o mesmo tempo de uma
// verificação real, para a resposta não revelar quais e-mails estão cadastrados.
let hashFalso: Promise<string> | null = null;

export async function autenticar(email: string, senha: string): Promise<UsuarioAutenticado | null> {
  const { rows } = await pool.query<UsuarioAutenticado & { senhaHash: string | null }>(
    `SELECT id, nome, tipo, senha_hash AS "senhaHash"
       FROM origem.usuario WHERE lower(email) = lower($1)`,
    [email.trim()]
  );
  const usuario = rows[0];
  if (!usuario || !usuario.senhaHash) {
    hashFalso ??= hashSenha("senha-descartavel");
    await verificarSenha(senha, await hashFalso);
    return null;
  }
  if (!(await verificarSenha(senha, usuario.senhaHash))) return null;
  return { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cadastro público: sempre cria um COMPRADOR. Contas de artesão e admin são criadas
// por quem administra a plataforma.
export async function cadastrarComprador(
  nome: string,
  email: string,
  senha: string
): Promise<UsuarioAutenticado> {
  const nomeLimpo = nome.trim();
  const emailLimpo = email.trim().toLowerCase();
  if (!nomeLimpo || nomeLimpo.length > 150) throw new ErroAuth("Informe seu nome (até 150 caracteres).", 400);
  if (!EMAIL.test(emailLimpo) || emailLimpo.length > 150) throw new ErroAuth("Informe um e-mail válido.", 400);
  if (senha.length < 8 || senha.length > 200) throw new ErroAuth("A senha precisa ter de 8 a 200 caracteres.", 400);

  const hash = await hashSenha(senha);
  try {
    const { rows } = await pool.query<UsuarioAutenticado>(
      `INSERT INTO origem.usuario (nome, email, tipo, senha_hash)
       VALUES ($1, $2, 'comprador', $3)
       RETURNING id, nome, tipo`,
      [nomeLimpo, emailLimpo, hash]
    );
    return rows[0];
  } catch (erro) {
    if ((erro as { code?: string }).code === "23505") throw new ErroAuth("Este e-mail já está cadastrado.", 409);
    throw erro;
  }
}

// Sessão da requisição atual: confere a assinatura do cookie E se o usuário ainda existe
// com o mesmo perfil (se o perfil mudou ou a conta sumiu, a sessão deixa de valer).
export async function obterSessao(): Promise<DadosSessao | null> {
  const jar = await cookies();
  const dados = await lerToken(jar.get(COOKIE_SESSAO)?.value);
  if (!dados) return null;
  const { rows } = await pool.query<{ nome: string; tipo: TipoUsuario }>(
    `SELECT nome, tipo FROM origem.usuario WHERE id = $1`,
    [dados.id]
  );
  if (!rows[0] || rows[0].tipo !== dados.tipo) return null;
  return { ...dados, nome: rows[0].nome };
}

// Exige login (e, opcionalmente, um dos perfis). Lança ErroAuth 401/403.
export async function exigirSessao(perfis?: readonly TipoUsuario[]): Promise<DadosSessao> {
  const sessao = await obterSessao();
  if (!sessao) throw new ErroAuth("Faça login para continuar.", 401);
  if (perfis && !perfis.includes(sessao.tipo)) {
    throw new ErroAuth("Seu perfil não tem permissão para esta ação.", 403);
  }
  return sessao;
}
