// Tipos espelhando 1 a 1 o Modelo Lógico definido na sprint de Banco de Dados
// (ver Modelo_Logico.md). Qualquer mudança lá deve ser refletida aqui.

export type TipoUsuario = "comprador" | "artesao" | "admin";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: TipoUsuario;
  dataCadastro: string; // ISO date
}

export interface Artesao {
  id: string;
  usuarioId: string;
  regiaoOrigem: string;
  biografia: string;
}

export type Tecnica =
  | "Cerâmica"
  | "Têxtil"
  | "Madeira"
  | "Renda e Bordado"
  | "Palha";

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
  // Opcional: produtos antigos (ou cadastrados sem foto) continuam mostrando o
  // padrão visual da técnica, em vez de quebrar a tela.
  imagemUrl?: string;
}

export type StatusPedido = "pendente" | "pago" | "enviado" | "entregue";

export interface Pedido {
  id: string;
  compradorId: string;
  dataPedido: string;
  status: StatusPedido;
  valorTotal: number;
}

export interface ItemPedido {
  id: string;
  pedidoId: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
}

export interface Avaliacao {
  id: string;
  produtoId: string;
  compradorId: string;
  nota: number; // 1 a 5
  dataAvaliacao: string;
}

export interface Carrinho {
  id: string;
  compradorId: string;
  dataCriacao: string;
}

export interface ItemCarrinho {
  id: string;
  carrinhoId: string;
  produtoId: string;
  quantidade: number;
}

// Tipos de apresentação (join entre entidades), usados pela UI

export interface ProdutoComArtesao extends Produto {
  artesaoNome: string;
  artesaoRegiao: string;
  // Preenchido quando o produto vem do banco: usuário dono da loja (painel do artesão).
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

// Item do carrinho já resolvido com o produto, para a UI não precisar buscar cada
// produto por id ao renderizar a lista ou somar o total. Enquanto não existe backend,
// `id` é gerado no cliente e `carrinhoId` usa um valor local fixo.
export interface ItemCarrinhoComProduto extends ItemCarrinho {
  produto: ProdutoComArtesao;
}

// Dados coletados no checkout simulado. Ainda não têm tabela no Modelo Lógico:
// quando o pedido passar a ser persistido, isto vira o endereço de entrega do Pedido.
export interface DadosEntrega {
  nome: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}

// Pedido já resolvido com seus itens e o nome do comprador, para o painel do artesão e o
// histórico do comprador não precisarem cruzar itensPedido/produtos/usuarios na tela.
export interface ItemPedidoComProduto extends ItemPedido {
  produtoNome: string;
  produtoTecnica: Tecnica;
  // Preenchidos quando o pedido vem do banco: quem vende o item (usuário do artesão).
  artesaoUsuarioId?: string;
  artesaoNome?: string;
}

export interface PedidoComItens extends Pedido {
  compradorNome: string;
  itens: ItemPedidoComProduto[];
}

// Aviso mostrado ao comprador quando o artesão marca o pedido como enviado.
// Sem backend de notificações, vive no mesmo estado local dos pedidos.
export interface NotificacaoEnvio {
  id: string;
  pedidoId: string;
  compradorId: string;
  mensagem: string;
  data: string;
  lida: boolean;
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
  // Sem tabela de visitas no modelo físico: só o mock (apiFalsa) preenche estes dois.
  visitasNoPerfil?: number;
  visitasDeltaPct?: number;
  historicoMensal: PontoSerieVendas[];
  vendasPorTecnica: DistribuicaoTecnica[];
}
