"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resolverId } from "./idsLegados";
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
  // Lista de produtos do banco (GET /api/produtos), com o dono de cada loja.
  produtos: ProdutoComArtesao[];
  produtosDoArtesao: (usuarioId: string) => ProdutoComArtesao[];
  // Gravam no banco pela API. Rejeitam com a mensagem do servidor (validação, 404...).
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
  const [produtos, setProdutos] = useState<ProdutoComArtesao[]>([]);

  useEffect(() => {
    let ativo = true;
    fetch("/api/produtos")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((lista: ProdutoComArtesao[]) => {
        if (ativo) setProdutos(lista);
      })
      .catch(() => {
        if (ativo) setProdutos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  // Chamado ao salvar o formulário do popup "Adicionar Produto" no painel do artesão.
  const criarProduto = useCallback(
    async (usuarioId: string, dados: DadosNovoProduto): Promise<ProdutoComArtesao> => {
      const res = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, usuarioId }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      const novo = (await res.json()) as ProdutoComArtesao;
      setProdutos((atuais) => [novo, ...atuais.filter((p) => p.id !== novo.id)]);
      return novo;
    },
    []
  );

  const editarProduto = useCallback(
    async (
      id: string,
      dados: Pick<Produto, "nome" | "descricao" | "preco" | "estoqueQtd" | "imagemUrl">
    ): Promise<ProdutoComArtesao> => {
      const res = await fetch(`/api/produtos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      const atualizado = (await res.json()) as ProdutoComArtesao;
      setProdutos((atuais) => atuais.map((p) => (p.id === atualizado.id ? atualizado : p)));
      return atualizado;
    },
    []
  );

  // O front usa ids do mock ("u2"); o banco usa UUID. resolverId faz a ponte.
  const produtosDoArtesao = useCallback(
    (usuarioId: string): ProdutoComArtesao[] => {
      const alvo = resolverId(usuarioId);
      return produtos.filter((p) => p.artesaoUsuarioId === alvo);
    },
    [produtos]
  );

  const valor = useMemo<ValorContextoProdutos>(
    () => ({ produtos, produtosDoArtesao, criarProduto, editarProduto }),
    [produtos, produtosDoArtesao, criarProduto, editarProduto]
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
