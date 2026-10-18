"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TipoUsuario } from "./tipos";

export interface UsuarioSessao {
  id: string;
  nome: string;
  tipo: TipoUsuario;
}

interface ValorContextoSessao {
  usuario: UsuarioSessao | null;
  // true até a primeira resposta de /api/auth/me (evita piscar "Entrar" para quem já está logado)
  carregando: boolean;
  entrar: (email: string, senha: string, perfil?: TipoUsuario) => Promise<UsuarioSessao>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<UsuarioSessao>;
  sair: () => Promise<void>;
}

const ContextoSessao = createContext<ValorContextoSessao | null>(null);

async function enviar(url: string, corpo?: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

async function lerUsuarioOuErro(res: Response): Promise<UsuarioSessao> {
  let json: { usuario?: UsuarioSessao; erro?: string } = {};
  try {
    json = await res.json();
  } catch {
    // resposta sem JSON
  }
  if (!res.ok || !json.usuario) {
    throw new Error(json.erro ?? "Não foi possível concluir. Tente novamente.");
  }
  return json.usuario;
}

export function ProvedorSessao({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    fetch("/api/auth/me")
      .then((res) => res.json() as Promise<{ usuario: UsuarioSessao | null }>)
      .then((json) => {
        if (ativo) setUsuario(json.usuario);
      })
      .catch(() => {
        if (ativo) setUsuario(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string, perfil?: TipoUsuario) => {
    const logado = await lerUsuarioOuErro(await enviar("/api/auth/login", { email, senha, perfil }));
    setUsuario(logado);
    return logado;
  }, []);

  const cadastrar = useCallback(async (nome: string, email: string, senha: string) => {
    const novo = await lerUsuarioOuErro(await enviar("/api/auth/cadastro", { nome, email, senha }));
    setUsuario(novo);
    return novo;
  }, []);

  const sair = useCallback(async () => {
    await enviar("/api/auth/logout").catch(() => undefined);
    setUsuario(null);
  }, []);

  const valor = useMemo<ValorContextoSessao>(
    () => ({ usuario, carregando, entrar, cadastrar, sair }),
    [usuario, carregando, entrar, cadastrar, sair]
  );

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

export function useSessao(): ValorContextoSessao {
  const contexto = useContext(ContextoSessao);
  if (!contexto) {
    throw new Error("useSessao precisa ser usado dentro de <ProvedorSessao>.");
  }
  return contexto;
}
