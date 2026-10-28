// Tipos que a API recebe e devolve. Espelham lib/tipos.ts do front (Modelo Lógico):
// qualquer mudança lá deve ser refletida aqui.

export type TipoUsuario = "comprador" | "artesao" | "admin";

export const TECNICAS = ["Cerâmica", "Têxtil", "Madeira", "Renda e Bordado", "Palha"] as const;
export type Tecnica = (typeof TECNICAS)[number];

export const STATUS_PEDIDO = ["pendente", "pago", "enviado", "entregue"] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  tipo: TipoUsuario;
}

export interface DadosSessao extends UsuarioAutenticado {
  exp: number; // epoch em segundos
}

export interface Produto {
  id: string;
  artesaoId: string;
  nome: string;
  descricao: string;
  tecnica: Tecnica;
  categoria: string;
  preco: number;
  estoqueQtd: number;
  dataCadastro: string;
  imagemUrl?: string;
}

export interface ProdutoComArtesao extends Produto {
  artesaoNome: string;
  artesaoRegiao: string;
  artesaoUsuarioId?: string;
}

export interface ResumoAvaliacoes {
  media: number;
  quantidade: number;
}

export interface PerfilArtesao {
  id: string;
  nome: string;
  regiaoOrigem: string;
  biografia: string;
  produtos: ProdutoComArtesao[];
}

export interface Pedido {
  id: string;
  compradorId: string;
  dataPedido: string;
  status: StatusPedido;
  valorTotal: number;
}

export interface ItemPedidoComProduto {
  id: string;
  pedidoId: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  produtoNome: string;
  produtoTecnica: Tecnica;
  artesaoUsuarioId?: string;
  artesaoNome?: string;
}

export interface PedidoComItens extends Pedido {
  compradorNome: string;
  itens: ItemPedidoComProduto[];
}

export interface PontoSerieVendas {
  mes: string;
  faturamento: number;
  pedidos: number;
}

export interface DistribuicaoTecnica {
  tecnica: string;
  totalVendido: number;
  porcentagem: number;
}

export interface EstatisticasPainel {
  vendasDoMes: number;
  vendasDeltaPct: number;
  pedidosPendentes: number;
  historicoMensal: PontoSerieVendas[];
  vendasPorTecnica: DistribuicaoTecnica[];
}
