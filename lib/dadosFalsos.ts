import {
  Usuario,
  Artesao,
  Produto,
  Pedido,
  ItemPedido,
  Avaliacao,
  Carrinho,
  ItemCarrinho,
} from "./tipos";

export const usuarios: Usuario[] = [
  { id: "u1", nome: "Vitalino Neto", email: "vitalino@raizespe.dev", tipo: "artesao", dataCadastro: "2025-02-10" },
  { id: "u2", nome: "Cooperativa de Tacaratu", email: "tacaratu@raizespe.dev", tipo: "artesao", dataCadastro: "2025-01-22" },
  { id: "u3", nome: "José Bezerra", email: "jbezerra@raizespe.dev", tipo: "artesao", dataCadastro: "2025-03-05" },
  { id: "u4", nome: "Marlene Costa", email: "marlene@raizespe.dev", tipo: "artesao", dataCadastro: "2025-02-28" },
  { id: "u5", nome: "Raimundo Silva", email: "raimundo@raizespe.dev", tipo: "artesao", dataCadastro: "2025-04-01" },
  { id: "u6", nome: "Ateliê Barro Vivo", email: "barrovivo@raizespe.dev", tipo: "artesao", dataCadastro: "2025-03-18" },
  { id: "u7", nome: "Ana Beatriz", email: "ana.beatriz@raizespe.dev", tipo: "comprador", dataCadastro: "2025-05-02" },
  { id: "u8", nome: "Carlos Andrade", email: "carlos.andrade@raizespe.dev", tipo: "comprador", dataCadastro: "2025-05-14" },
  { id: "u9", nome: "Administração Raízes PE", email: "admin@raizespe.dev", tipo: "admin", dataCadastro: "2025-01-01" },
];

export const artesaos: Artesao[] = [
  { id: "a1", usuarioId: "u1", regiaoOrigem: "Alto do Moura, Caruaru", biografia: "Ceramista da família Vitalino, quinta geração. Trabalha com peças figurativas e utilitárias, herdando técnicas passadas pelo avô." },
  { id: "a2", usuarioId: "u2", regiaoOrigem: "Tacaratu", biografia: "Cooperativa têxtil com 12 artesãs associadas, especializada em tear manual e tingimento natural." },
  { id: "a3", usuarioId: "u3", regiaoOrigem: "Garanhuns", biografia: "Escultor em madeira, trabalha com reaproveitamento de troncos e reconhecido pelas peças de fauna nordestina." },
  { id: "a4", usuarioId: "u4", regiaoOrigem: "Tracunhaém", biografia: "Rendeira de bilro, aprendeu o ofício com a avó e hoje ensina o ponto a jovens da comunidade." },
  { id: "a5", usuarioId: "u5", regiaoOrigem: "Comunidade do Pilar", biografia: "Trabalha com trançados de palha há mais de 20 anos, com peças utilitárias e de decoração." },
  { id: "a6", usuarioId: "u6", regiaoOrigem: "Alto do Moura, Caruaru", biografia: "Ateliê coletivo de cerâmica fosca contemporânea, unindo técnica tradicional a acabamentos modernos." },
];

// Fotos de placeholder (SVGs em public/produtos/, um por produto) só pra tirar os cards
// do gradiente genérico enquanto não existe upload real de foto vindo do artesão. São
// arquivos locais — sem depender de nenhum serviço externo — e o artesão pode trocar
// pela foto de verdade a qualquer momento pelo popup "Adicionar Produto"/edição.
export const produtos: Produto[] = [
  {
    id: "p1", artesaoId: "a1", nome: "Vaso de Cerâmica Maragogi",
    descricao: "Vaso torneado à mão em argila local, com acabamento em duas cores e queima em forno a lenha. Cada peça é única, com pequenas variações de tom.",
    tecnica: "Cerâmica", categoria: "Decoração", preco: 185.0, estoqueQtd: 8, estoqueVersao: "0", dataCadastro: "2025-06-01",
    imagemUrl: "/produtos/p1.svg",
  },
  {
    id: "p2", artesaoId: "a2", nome: "Tapete Tear Manual",
    descricao: "Tapete tecido em tear manual de madeira, com algodão cru e tingimento natural à base de plantas da região.",
    tecnica: "Têxtil", categoria: "Casa", preco: 320.0, estoqueQtd: 8, estoqueVersao: "0", dataCadastro: "2025-05-20",
    imagemUrl: "/produtos/p2.svg",
  },
  {
    id: "p3", artesaoId: "a3", nome: "Escultura em Madeira - Leão",
    descricao: "Escultura entalhada em tronco de umburana reaproveitado, inspirada na fauna do sertão pernambucano.",
    tecnica: "Madeira", categoria: "Decoração", preco: 410.0, estoqueQtd: 3, estoqueVersao: "0", dataCadastro: "2025-05-11",
    imagemUrl: "/produtos/p3.svg",
  },
  {
    id: "p4", artesaoId: "a4", nome: "Renda de Bilro Flor do Agreste",
    descricao: "Renda de bilro trabalhada fio a fio, com padrão floral tradicional de Tracunhaém.",
    tecnica: "Renda e Bordado", categoria: "Vestuário", preco: 95.0, estoqueQtd: 15, estoqueVersao: "0", dataCadastro: "2025-06-10",
    imagemUrl: "/produtos/p4.svg",
  },
  {
    id: "p5", artesaoId: "a5", nome: "Cesto de Palha Trançada",
    descricao: "Cesto trançado à mão em palha de carnaúba, ideal para organização ou decoração.",
    tecnica: "Palha", categoria: "Casa", preco: 68.0, estoqueQtd: 20, estoqueVersao: "0", dataCadastro: "2025-06-15",
    imagemUrl: "/produtos/p5.svg",
  },
  {
    id: "p6", artesaoId: "a6", nome: "Jarro de Cerâmica Fosco",
    descricao: "Jarro de cerâmica com acabamento fosco contemporâneo, mantendo a técnica de modelagem manual tradicional.",
    tecnica: "Cerâmica", categoria: "Decoração", preco: 210.0, estoqueQtd: 6, estoqueVersao: "0", dataCadastro: "2025-06-18",
    imagemUrl: "/produtos/p6.svg",
  },
  {
    id: "p7", artesaoId: "a2", nome: "Manta de Algodão Cru",
    descricao: "Manta tecida em algodão cru não tingido, macia e respirável, feita sob encomenda pela cooperativa.",
    tecnica: "Têxtil", categoria: "Casa", preco: 275.0, estoqueQtd: 5, estoqueVersao: "0", dataCadastro: "2025-06-20",
    imagemUrl: "/produtos/p7.svg",
  },
];

export const pedidos: Pedido[] = [
  { id: "pe1", compradorId: "u7", dataPedido: "2025-07-02", status: "entregue", valorTotal: 185.0 },
  { id: "pe2", compradorId: "u8", dataPedido: "2025-07-05", status: "pago", valorTotal: 363.0 },
  { id: "pe3", compradorId: "u7", dataPedido: "2025-07-09", status: "pendente", valorTotal: 320.0 },
];

export const itensPedido: ItemPedido[] = [
  { id: "ip1", pedidoId: "pe1", produtoId: "p1", quantidade: 1, precoUnitario: 185.0 },
  { id: "ip2", pedidoId: "pe2", produtoId: "p4", quantidade: 1, precoUnitario: 95.0 },
  { id: "ip3", pedidoId: "pe2", produtoId: "p5", quantidade: 1, precoUnitario: 68.0 },
  { id: "ip4", pedidoId: "pe2", produtoId: "p6", quantidade: 1, precoUnitario: 200.0 },
  { id: "ip5", pedidoId: "pe3", produtoId: "p2", quantidade: 1, precoUnitario: 320.0 },
];

export const avaliacoes: Avaliacao[] = [
  { id: "av1", produtoId: "p1", compradorId: "u7", nota: 5, dataAvaliacao: "2025-07-06" },
  { id: "av2", produtoId: "p1", compradorId: "u8", nota: 4, dataAvaliacao: "2025-07-20" },
  { id: "av3", produtoId: "p2", compradorId: "u8", nota: 4, dataAvaliacao: "2025-06-01" },
  { id: "av4", produtoId: "p4", compradorId: "u8", nota: 5, dataAvaliacao: "2025-07-10" },
  { id: "av5", produtoId: "p4", compradorId: "u7", nota: 5, dataAvaliacao: "2025-07-22" },
  { id: "av6", produtoId: "p6", compradorId: "u7", nota: 4, dataAvaliacao: "2025-07-25" },
];

export const carrinhos: Carrinho[] = [
  { id: "c1", compradorId: "u7", dataCriacao: "2025-07-15" },
];

export const itensCarrinho: ItemCarrinho[] = [
  { id: "ic1", carrinhoId: "c1", produtoId: "p3", quantidade: 1 },
  { id: "ic2", carrinhoId: "c1", produtoId: "p6", quantidade: 2 },
];
