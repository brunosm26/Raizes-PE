// Notificações dos pedidos, guardadas em memória por usuário (sem tabela no banco: reiniciar a
// API apaga a caixa). Quem escreve aqui é o worker da fila assíncrona; as rotas só leem e marcam
// como lidas. Os textos saem do pedido já gravado, então o worker não precisa ler o banco de novo.

export type TipoNotificacao = "pedido.recebido" | "pedido.nova_venda" | "pedido.pago" | "pedido.enviado" | "pedido.entregue";

export interface Notificacao {
  id: string;
  usuarioId: string;
  pedidoId: string;
  tipo: TipoNotificacao;
  mensagem: string;
  /** Só nas novas vendas: texto pronto para o artesão mandar ao comprador pelo WhatsApp. */
  resumoWhatsapp?: string;
  data: string;
  lida: boolean;
}

// `chave` evita a mesma notificação duas vezes quando o job roda de novo depois de uma falha.
export interface NovaNotificacao {
  chave: string;
  usuarioId: string;
  pedidoId: string;
  tipo: TipoNotificacao;
  mensagem: string;
  resumoWhatsapp?: string;
}

export interface CaixaDoUsuario {
  naoLidas: number;
  total: number;
  dados: Notificacao[];
}

// O mínimo do pedido que os textos usam. Os PedidoComItens do Express e do Next encaixam aqui.
export interface ItemDoResumo {
  quantidade: number;
  precoUnitario: number;
  produtoNome: string;
  artesaoUsuarioId?: string;
  artesaoNome?: string;
}

export interface PedidoDoResumo {
  id: string;
  compradorId: string;
  compradorNome: string;
  status: string;
  valorTotal: number;
  itens: ItemDoResumo[];
}

export interface OpcoesCaixaNotificacoes {
  /** Teto por usuário. Ao passar, saem as mais antigas. */
  maxPorUsuario?: number;
  agora?: () => number;
  gerarId?: () => string;
}

interface Guardada extends Notificacao {
  chave: string;
}

const MAX_POR_USUARIO_PADRAO = 50;

export class CaixaNotificacoes {
  private readonly maxPorUsuario: number;
  private readonly agora: () => number;
  private readonly gerarId: () => string;
  // Por usuário, da mais antiga para a mais nova.
  private readonly porUsuario = new Map<string, Guardada[]>();

  constructor({
    maxPorUsuario = MAX_POR_USUARIO_PADRAO,
    agora = () => Date.now(),
    gerarId = () => globalThis.crypto.randomUUID(),
  }: OpcoesCaixaNotificacoes = {}) {
    if (!Number.isInteger(maxPorUsuario) || maxPorUsuario < 1) throw new Error(`maxPorUsuario inválido: ${maxPorUsuario}`);
    this.maxPorUsuario = maxPorUsuario;
    this.agora = agora;
    this.gerarId = gerarId;
  }

  // Devolve false quando a chave já existe para o usuário (job repetido).
  registrar(nova: NovaNotificacao): boolean {
    const lista = this.porUsuario.get(nova.usuarioId) ?? [];
    if (lista.some((n) => n.chave === nova.chave)) return false;
    lista.push({
      ...nova,
      id: this.gerarId(),
      data: new Date(this.agora()).toISOString(),
      lida: false,
    });
    if (lista.length > this.maxPorUsuario) lista.splice(0, lista.length - this.maxPorUsuario);
    this.porUsuario.set(nova.usuarioId, lista);
    return true;
  }

  // Só as do próprio usuário, mais recentes primeiro. Cópias: quem lê não altera a caixa.
  listar(usuarioId: string): CaixaDoUsuario {
    const lista = this.porUsuario.get(usuarioId) ?? [];
    const dados = [...lista].reverse().map(semChave);
    return { naoLidas: dados.filter((n) => !n.lida).length, total: dados.length, dados };
  }

  // Sem ids, marca todas. Ids de outro usuário são ignorados. Devolve quantas mudaram.
  marcarComoLidas(usuarioId: string, ids?: readonly string[]): number {
    const alvo = ids ? new Set(ids) : null;
    let marcadas = 0;
    for (const n of this.porUsuario.get(usuarioId) ?? []) {
      if (n.lida || (alvo && !alvo.has(n.id))) continue;
      n.lida = true;
      marcadas++;
    }
    return marcadas;
  }

  limpar(): void {
    this.porUsuario.clear();
  }
}

function semChave(guardada: Guardada): Notificacao {
  const notificacao: Notificacao & { chave?: string } = { ...guardada };
  delete notificacao.chave;
  return notificacao;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarReais(valor: number): string {
  // O Intl separa "R$" do número com espaço não separável; texto de WhatsApp fica melhor com espaço comum.
  return moeda.format(valor).replace(/\s/g, " ");
}

// "#4A1B2C3D": o começo do UUID basta para o comprador e o artesão se entenderem.
export function codigoDoPedido(pedidoId: string): string {
  return `#${pedidoId.slice(0, 8).toUpperCase()}`;
}

// Um pedido pode ter peças de vários artesãos: cada um recebe só as dele.
export function itensPorArtesao(pedido: PedidoDoResumo): Map<string, ItemDoResumo[]> {
  const grupos = new Map<string, ItemDoResumo[]>();
  for (const item of pedido.itens) {
    if (!item.artesaoUsuarioId) continue;
    grupos.set(item.artesaoUsuarioId, [...(grupos.get(item.artesaoUsuarioId) ?? []), item]);
  }
  return grupos;
}

function subtotal(itens: readonly ItemDoResumo[]): number {
  return itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0);
}

export function resumoWhatsapp(pedido: PedidoDoResumo, itens: readonly ItemDoResumo[]): string {
  const artesao = itens[0]?.artesaoNome ?? "o artesão";
  const linhas = itens.map((i) => `- ${i.quantidade}x ${i.produtoNome} (${formatarReais(i.precoUnitario)} cada)`);
  return [
    `Olá, ${pedido.compradorNome}! Aqui é ${artesao}, do Raízes PE.`,
    `Recebi seu pedido ${codigoDoPedido(pedido.id)}:`,
    ...linhas,
    `Total das minhas peças: ${formatarReais(subtotal(itens))}`,
    "Vamos combinar o pagamento e a entrega?",
  ].join("\n");
}

// Job pedido.criado: um aviso para o comprador e um por artesão envolvido.
export function notificacoesDoPedidoCriado(pedido: PedidoDoResumo): NovaNotificacao[] {
  const codigo = codigoDoPedido(pedido.id);
  const avisos: NovaNotificacao[] = [
    {
      chave: `criado:${pedido.id}`,
      usuarioId: pedido.compradorId,
      pedidoId: pedido.id,
      tipo: "pedido.recebido",
      mensagem:
        `Recebemos seu pedido ${codigo} (${formatarReais(pedido.valorTotal)}). ` +
        "O artesão vai falar com você pelo WhatsApp para combinar pagamento e entrega.",
    },
  ];
  for (const [artesaoId, itens] of itensPorArtesao(pedido)) {
    const pecas = itens.reduce((soma, i) => soma + i.quantidade, 0);
    avisos.push({
      chave: `criado:${pedido.id}`,
      usuarioId: artesaoId,
      pedidoId: pedido.id,
      tipo: "pedido.nova_venda",
      mensagem: `Nova venda: pedido ${codigo} de ${pedido.compradorNome}, ${pecas} peça(s), ${formatarReais(subtotal(itens))}.`,
      resumoWhatsapp: resumoWhatsapp(pedido, itens),
    });
  }
  return avisos;
}

const AVISO_DE_STATUS: Record<string, { tipo: TipoNotificacao; texto: (codigo: string) => string }> = {
  pago: { tipo: "pedido.pago", texto: (c) => `O pagamento do pedido ${c} foi confirmado.` },
  enviado: { tipo: "pedido.enviado", texto: (c) => `Seu pedido ${c} foi enviado pelo artesão e está a caminho.` },
  entregue: { tipo: "pedido.entregue", texto: (c) => `Seu pedido ${c} foi entregue. Que tal avaliar as peças?` },
};

// Job pedido.status_atualizado: aviso para o comprador. "pendente" não gera aviso.
// A chave leva o job: o mesmo status marcado de novo mais tarde avisa de novo; a nova tentativa do mesmo job, não.
export function notificacaoDeStatus(pedido: PedidoDoResumo, jobId: string): NovaNotificacao | null {
  const aviso = AVISO_DE_STATUS[pedido.status];
  if (!aviso) return null;
  return {
    chave: `status:${pedido.id}:${pedido.status}:${jobId}`,
    usuarioId: pedido.compradorId,
    pedidoId: pedido.id,
    tipo: aviso.tipo,
    mensagem: aviso.texto(codigoDoPedido(pedido.id)),
  };
}
