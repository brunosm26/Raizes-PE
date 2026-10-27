import * as usuarioRepository from "../repositories/usuarioRepository";
import type { UsuarioAutenticado } from "../types/dominio";
import { ErroHttp } from "../utils/erroHttp";
import { hashSenha, verificarSenha } from "../utils/senha";

// Login, cadastro e o freio contra tentativas em massa.

// 5 falhas por e-mail+IP a cada 15 minutos. Fica na memória do processo (basta para a
// demonstração; com mais de uma instância, usar um store externo).
const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 5;
const falhas = new Map<string, { quantidade: number; desde: number }>();

function bloqueado(chave: string): boolean {
  const f = falhas.get(chave);
  if (!f) return false;
  if (Date.now() - f.desde > JANELA_MS) {
    falhas.delete(chave);
    return false;
  }
  return f.quantidade >= MAX_FALHAS;
}

function registrarFalha(chave: string): void {
  const atual = falhas.get(chave);
  falhas.set(chave, { quantidade: (atual?.quantidade ?? 0) + 1, desde: atual?.desde ?? Date.now() });
}

// Hash descartável: quando o e-mail não existe, ainda gastamos o mesmo tempo de uma
// verificação real, para a resposta não revelar quais e-mails estão cadastrados.
let hashFalso: Promise<string> | null = null;

async function autenticar(email: string, senha: string): Promise<UsuarioAutenticado | null> {
  const usuario = await usuarioRepository.buscarPorEmail(email.trim());
  if (!usuario || !usuario.senhaHash) {
    hashFalso ??= hashSenha("senha-descartavel");
    await verificarSenha(senha, await hashFalso);
    return null;
  }
  if (!(await verificarSenha(senha, usuario.senhaHash))) return null;
  return { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo };
}

// `perfil` é a aba escolhida na tela de login; `ip` identifica a origem para o freio.
export async function entrar(
  entrada: { email?: unknown; senha?: unknown; perfil?: unknown },
  ip: string
): Promise<UsuarioAutenticado> {
  const email = typeof entrada.email === "string" ? entrada.email : "";
  const senha = typeof entrada.senha === "string" ? entrada.senha : "";
  if (!email || !senha) throw new ErroHttp(400, "Informe e-mail e senha.");

  const chave = `${ip}|${email.trim().toLowerCase()}`;
  if (bloqueado(chave)) throw new ErroHttp(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo.");

  const usuario = await autenticar(email, senha);
  if (!usuario) {
    registrarFalha(chave);
    throw new ErroHttp(401, "E-mail ou senha incorretos.");
  }

  // A aba escolhida precisa bater com o perfil real da conta (o admin pode usar qualquer aba).
  const perfil = typeof entrada.perfil === "string" ? entrada.perfil : undefined;
  if (perfil && usuario.tipo !== "admin" && perfil !== usuario.tipo) {
    throw new ErroHttp(403, `Esta conta não é de ${perfil === "artesao" ? "artesão" : perfil}. Use a aba correta.`);
  }

  falhas.delete(chave);
  return usuario;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cadastro público: sempre cria um COMPRADOR. Contas de artesão e admin são criadas
// por quem administra a plataforma.
export async function cadastrarComprador(entrada: {
  nome?: unknown;
  email?: unknown;
  senha?: unknown;
}): Promise<UsuarioAutenticado> {
  const nome = (typeof entrada.nome === "string" ? entrada.nome : "").trim();
  const email = (typeof entrada.email === "string" ? entrada.email : "").trim().toLowerCase();
  const senha = typeof entrada.senha === "string" ? entrada.senha : "";
  if (!nome || nome.length > 150) throw new ErroHttp(400, "Informe seu nome (até 150 caracteres).");
  if (!EMAIL.test(email) || email.length > 150) throw new ErroHttp(400, "Informe um e-mail válido.");
  if (senha.length < 8 || senha.length > 200) throw new ErroHttp(400, "A senha precisa ter de 8 a 200 caracteres.");

  try {
    return await usuarioRepository.inserirComprador(nome, email, await hashSenha(senha));
  } catch (erro) {
    if (erro instanceof usuarioRepository.ErroEmailDuplicado) {
      throw new ErroHttp(409, "Este e-mail já está cadastrado.");
    }
    throw erro;
  }
}
