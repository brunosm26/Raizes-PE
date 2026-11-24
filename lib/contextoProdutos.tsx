"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resolverId } from "./idsLegados";
import { useSessao } from "./contextoSessao";
import { apiFetch } from "./apiUrl";
import type { Produto, ProdutoComArtesao, Tecnica } from "./tipos";

interface DadosNovoProduto {
  nome: string;
  descricao: string;
  tecnica: Tecnica;
  categoria: string;
  preco: number;
  estoqueQtd: number;
  imagemUrl?: string;
}

interface ValorContextoProdutos {
  // Visão de gestão do catálogo, limitada ao escopo de quem está autenticado.
  produtos: ProdutoComArtesao[];
  carregandoProdutos: boolean;
  erroProdutos: boolean;
  recarregarProdutos: () => void;
  produtosDoArtesao: (usuarioId: string) => ProdutoComArtesao[];
  // Gravam no banco pela API. Rejeitam com a mensagem do servidor (validação, 404...).
  moderarProduto: (id: string, status: "aprovado") => Promise<ProdutoComArtesao>;
  criarProduto: (usuarioId: string, dados: DadosNovoProduto) => Promise<ProdutoComArtesao>;
  editarProduto: (
    id: string,
    dados: Pick<Produto, "nome" | "descricao" | "preco" | "estoqueQtd" | "imagemUrl">
  ) => Promise<ProdutoComArtesao>;
}

const ContextoProdutos = createContext<ValorContextoProdutos | null>(null);

async function mensagemDeErro(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { erro?: string };
    if (json.erro) return json.erro;
  } catch {
    // resposta sem JSON: cai na mensagem padrão
  }
  return "Não foi possível salvar o produto. Tente novamente.";
}

export function ProvedorProdutos({ children }: { children: React.ReactNode }) {
  const { usuario } = useSessao();
  const idGestor = usuario?.tipo === "admin" || usuario?.tipo === "artesao" ? usuario.id : undefined;
  const [catalogo, setCatalogo] = useState<{ gestor: string; produtos: ProdutoComArtesao[]; erro?: boolean }>();
  const [tentativa, setTentativa] = useState(0);
  const recarregarProdutos = useCallback(() => {
    setCatalogo(undefined);
    setTentativa((atual) => atual + 1);
  }, []);
  const catalogoAtual = catalogo?.gestor === idGestor ? catalogo : undefined;
  const produtos = catalogoAtual?.produtos;
  const carregandoProdutos = idGestor !== undefined && !catalogoAtual;
  const erroProdutos = Boolean(catalogoAtual?.erro);

  useEffect(() => {
    if (!idGestor) return;
    let ativo = true;
    apiFetch("/api/produtos?visao=gestao")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((lista: ProdutoComArtesao[]) => {
        if (ativo) setCatalogo({ gestor: idGestor, produtos: lista });
      })
      .catch(() => {
        if (ativo) setCatalogo({ gestor: idGestor, produtos: [], erro: true });
      });
    return () => {
      ativo = false;
    };
  }, [idGestor, tentativa]);

  // Chamado ao salvar o formulário do popup "Adicionar Produto" no painel do artesão.
  const criarProduto = useCallback(
    async (usuarioId: string, dados: DadosNovoProduto): Promise<ProdutoComArtesao> => {
      const res = await apiFetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, usuarioId }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      const novo = (await res.json()) as ProdutoComArtesao;
      if (idGestor) {
        setCatalogo((atual) => ({
          gestor: idGestor,
          produtos: [novo, ...(atual?.gestor === idGestor ? atual.produtos : []).filter((p) => p.id !== novo.id)],
        }));
      }
      return novo;
    },
    [idGestor]
  );

  const editarProduto = useCallback(
    async (
      id: string,
      dados: Pick<Produto, "nome" | "descricao" | "preco" | "estoqueQtd" | "imagemUrl">
    ): Promise<ProdutoComArtesao> => {
      const res = await apiFetch(`/api/produtos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      const atualizado = (await res.json()) as ProdutoComArtesao;
      setCatalogo((atual) => atual && atual.gestor === idGestor
        ? { ...atual, produtos: atual.produtos.map((p) => (p.id === atualizado.id ? atualizado : p)) }
        : atual
      );
      return atualizado;
    },
    [idGestor]
  );

  const moderarProduto = useCallback(
    async (id: string, status: "aprovado"): Promise<ProdutoComArtesao> => {
      const res = await apiFetch(`/api/produtos/${encodeURIComponent(id)}/curadoria`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      const atualizado = (await res.json()) as ProdutoComArtesao;
      setCatalogo((atual) => atual && atual.gestor === idGestor
        ? { ...atual, produtos: atual.produtos.map((p) => (p.id === atualizado.id ? atualizado : p)) }
        : atual
      );
      return atualizado;
    },
    [idGestor]
  );

  // O front usa ids do mock ("u2"); o banco usa UUID. resolverId faz a ponte.
  const produtosDoArtesao = useCallback(
    (usuarioId: string): ProdutoComArtesao[] => {
      const alvo = resolverId(usuarioId);
      return produtos?.filter((p) => p.artesaoUsuarioId === alvo) ?? [];
    },
    [produtos]
  );

  const valor = useMemo<ValorContextoProdutos>(
    () => ({
      produtos: produtos ?? [],
      carregandoProdutos,
      erroProdutos,
      recarregarProdutos,
      produtosDoArtesao,
      criarProduto,
      editarProduto,
      moderarProduto,
    }),
    [produtos, carregandoProdutos, erroProdutos, recarregarProdutos, produtosDoArtesao, criarProduto, editarProduto, moderarProduto]
  );

  return <ContextoProdutos.Provider value={valor}>{children}</ContextoProdutos.Provider>;
}

export function useProdutos(): ValorContextoProdutos {
  const contexto = useContext(ContextoProdutos);
  if (!contexto) {
    throw new Error("useProdutos precisa ser usado dentro de <ProvedorProdutos>.");
  }
  return contexto;
}
