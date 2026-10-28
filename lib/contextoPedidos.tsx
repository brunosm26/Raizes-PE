"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resolverId } from "./idsLegados";
import { useSessao } from "./contextoSessao";
import type {
  ItemCarrinhoComProduto,
  NotificacaoEnvio,
  PedidoComItens,
  StatusPedido,
} from "./tipos";

const CHAVE_ARMAZENAMENTO = "raizes-pe:pedidos";

interface ValorContextoPedidos {
  pedidos: PedidoComItens[];
  notificacoes: NotificacaoEnvio[];
  pedidosDoComprador: (compradorId: string) => PedidoComItens[];
  todosOsPedidos: () => PedidoComItens[];
  pedidosDoArtesao: (usuarioId: string) => PedidoComItens[];
  pedidosPendentesDoArtesao: (usuarioId: string) => number;
  vendasDoArtesao: (usuarioId: string) => number;
  notificacoesDoComprador: (compradorId: string) => NotificacaoEnvio[];
  // Grava o pedido no banco (POST /api/pedidos). Rejeita com a mensagem do servidor
  // (ex.: estoque insuficiente), que a tela de checkout mostra ao comprador.
  criarPedido: (compradorId: string, itens: ItemCarrinhoComProduto[]) => Promise<PedidoComItens>;
  marcarComoEnviado: (pedidoId: string) => Promise<void>;
  marcarNotificacoesComoLidas: (compradorId: string) => void;
}

const ContextoPedidos = createContext<ValorContextoPedidos | null>(null);

function novoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Os pedidos agora vivem no banco; no navegador sobram só os avisos de envio.
// O localStorage é editável, então qualquer coisa fora do formato é descartada.
function ehNotificacaoValida(valor: unknown): valor is NotificacaoEnvio {
  if (typeof valor !== "object" || valor === null) return false;
  const n = valor as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    typeof n.pedidoId === "string" &&
    typeof n.compradorId === "string" &&
    typeof n.mensagem === "string" &&
    typeof n.data === "string" &&
    typeof n.lida === "boolean"
  );
}

function lerNotificacoesSalvas(): NotificacaoEnvio[] {
  try {
    const salvo = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!salvo) return [];
    const valor: unknown = JSON.parse(salvo);
    if (typeof valor !== "object" || valor === null) return [];
    const bruto = (valor as Record<string, unknown>).notificacoes;
    return Array.isArray(bruto) ? bruto.filter(ehNotificacaoValida) : [];
  } catch {
    return [];
  }
}

async function mensagemDeErro(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { erro?: string };
    if (json.erro) return json.erro;
  } catch {
    // resposta sem JSON: cai na mensagem padrão
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

// Mais recentes primeiro — é a ordem que faz sentido nas duas telas.
function porDataDecrescente(a: PedidoComItens, b: PedidoComItens): number {
  return b.dataPedido.localeCompare(a.dataPedido);
}

export function ProvedorPedidos({ children }: { children: React.ReactNode }) {
  const [pedidos, setPedidos] = useState<PedidoComItens[]>([]);
  const [notificacoes, setNotificacoes] = useState<NotificacaoEnvio[]>([]);
  const [hidratado, setHidratado] = useState(false);

  const { usuario } = useSessao();
  const usuarioId = usuario?.id;

  // Pedidos vindos do banco (GET /api/pedidos). O servidor devolve só o que o perfil logado
  // pode ver; ao entrar ou sair, a lista é recarregada (ou esvaziada).
  useEffect(() => {
    if (!usuarioId) {
      setPedidos([]);
      return;
    }
    let ativo = true;
    fetch("/api/pedidos")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((lista: PedidoComItens[]) => {
        if (ativo) setPedidos(lista);
      })
      .catch(() => {
        if (ativo) setPedidos([]);
      });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  // Só lemos depois da montagem, senão o HTML do servidor divergiria do cliente.
  useEffect(() => {
    setNotificacoes(lerNotificacoesSalvas());
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify({ notificacoes }));
    } catch {
      // Sem persistência: os avisos valem só nesta sessão.
    }
  }, [notificacoes, hidratado]);

  // Chamado ao confirmar o checkout: o servidor grava pedido e itens numa transação,
  // confere o estoque e calcula o total com os preços do banco.
  const criarPedido = useCallback(
    async (compradorId: string, itens: ItemCarrinhoComProduto[]): Promise<PedidoComItens> => {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compradorId,
          itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));
      const novo = (await res.json()) as PedidoComItens;
      setPedidos((atuais) => [novo, ...atuais.filter((p) => p.id !== novo.id)]);
      return novo;
    },
    []
  );

  const marcarComoEnviado = useCallback(
    async (pedidoId: string): Promise<void> => {
      const alvo = pedidos.find((p) => p.id === pedidoId);
      if (!alvo) return;

      // Só faz sentido enviar o que ainda não saiu; reenviar geraria aviso duplicado.
      if (alvo.status !== "pendente" && alvo.status !== "pago") return;

      const res = await fetch(`/api/pedidos/${encodeURIComponent(pedidoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "enviado" satisfies StatusPedido }),
      });
      if (!res.ok) throw new Error(await mensagemDeErro(res));

      setPedidos((atuais) =>
        atuais.map((p) => (p.id === pedidoId ? { ...p, status: "enviado" } : p))
      );
      setNotificacoes((anteriores) => [
        {
          id: novoId(),
          pedidoId,
          compradorId: alvo.compradorId,
          mensagem: `Seu pedido foi enviado pelo artesão e está a caminho.`,
          data: new Date().toISOString(),
          lida: false,
        },
        ...anteriores,
      ]);
    },
    [pedidos]
  );

  const marcarNotificacoesComoLidas = useCallback((compradorId: string) => {
    const alvo = resolverId(compradorId);
    setNotificacoes((atuais) =>
      atuais.map((n) => (resolverId(n.compradorId) === alvo ? { ...n, lida: true } : n))
    );
  }, []);

  // Visão do administrador: todos os pedidos da plataforma.
  const todosOsPedidos = useCallback(() => [...pedidos].sort(porDataDecrescente), [pedidos]);

  // O front usa ids do mock ("u7"); o banco usa UUID. resolverId faz a ponte.
  const pedidosDoComprador = useCallback(
    (compradorId: string) => {
      const alvo = resolverId(compradorId);
      return pedidos.filter((p) => p.compradorId === alvo).sort(porDataDecrescente);
    },
    [pedidos]
  );

  // Um pedido pertence ao artesão quando contém ao menos um produto dele.
  const pedidosDoArtesao = useCallback(
    (usuarioId: string) => {
      const alvo = resolverId(usuarioId);
      return pedidos
        .filter((pedido) => pedido.itens.some((i) => i.artesaoUsuarioId === alvo))
        .sort(porDataDecrescente);
    },
    [pedidos]
  );

  const pedidosPendentesDoArtesao = useCallback(
    (usuarioId: string) =>
      pedidosDoArtesao(usuarioId).filter((p) => p.status === "pendente").length,
    [pedidosDoArtesao]
  );

  // Soma só os itens que são do próprio artesão: um pedido pode misturar peças de
  // vários artesãos, e o valorTotal do pedido não serviria para o painel de nenhum deles.
  const vendasDoArtesao = useCallback(
    (usuarioId: string) => {
      const alvo = resolverId(usuarioId);
      return pedidosDoArtesao(usuarioId).reduce(
        (total, pedido) =>
          total +
          pedido.itens
            .filter((item) => item.artesaoUsuarioId === alvo)
            .reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0),
        0
      );
    },
    [pedidosDoArtesao]
  );

  const notificacoesDoComprador = useCallback(
    (compradorId: string) => {
      const alvo = resolverId(compradorId);
      return notificacoes.filter((n) => resolverId(n.compradorId) === alvo);
    },
    [notificacoes]
  );

  const valor = useMemo<ValorContextoPedidos>(
    () => ({
      pedidos,
      notificacoes,
      pedidosDoComprador,
      todosOsPedidos,
      pedidosDoArtesao,
      pedidosPendentesDoArtesao,
      vendasDoArtesao,
      notificacoesDoComprador,
      criarPedido,
      marcarComoEnviado,
      marcarNotificacoesComoLidas,
    }),
    [
      pedidos,
      notificacoes,
      pedidosDoComprador,
      todosOsPedidos,
      pedidosDoArtesao,
      pedidosPendentesDoArtesao,
      vendasDoArtesao,
      notificacoesDoComprador,
      criarPedido,
      marcarComoEnviado,
      marcarNotificacoesComoLidas,
    ]
  );

  return <ContextoPedidos.Provider value={valor}>{children}</ContextoPedidos.Provider>;
}

export function usePedidos(): ValorContextoPedidos {
  const contexto = useContext(ContextoPedidos);
  if (!contexto) {
    throw new Error("usePedidos precisa ser usado dentro de <ProvedorPedidos>.");
  }
  return contexto;
}
