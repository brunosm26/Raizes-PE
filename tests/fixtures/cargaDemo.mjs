// Recorte da carga db/05_dados_raizes_pe.sql (mesmos UUIDs, nomes, técnicas, datas, estoques e
// notas) para os testes que não usam banco. Não é lido por nenhuma tela.

export const COMPRADORES = {
  anaBeatriz: "10000000-0000-4000-8000-000000000007",
  carlosAndrade: "10000000-0000-4000-8000-000000000008",
};

export const PRODUTO = {
  vasoMaragogi: "30000000-0000-4000-8000-000000000001",
  tapeteTear: "30000000-0000-4000-8000-000000000002",
  esculturaLeao: "30000000-0000-4000-8000-000000000003",
  rendaBilro: "30000000-0000-4000-8000-000000000004",
  cestoPalha: "30000000-0000-4000-8000-000000000005",
  jarroFosco: "30000000-0000-4000-8000-000000000006",
  mantaAlgodao: "30000000-0000-4000-8000-000000000007",
};

const ARTESAO = {
  "20000000-0000-4000-8000-000000000001": { nome: "Vitalino Neto", regiao: "Alto do Moura, Caruaru" },
  "20000000-0000-4000-8000-000000000002": { nome: "Cooperativa de Tacaratu", regiao: "Tacaratu" },
  "20000000-0000-4000-8000-000000000003": { nome: "José Bezerra", regiao: "Garanhuns" },
  "20000000-0000-4000-8000-000000000004": { nome: "Marlene Costa", regiao: "Tracunhaém" },
  "20000000-0000-4000-8000-000000000005": { nome: "Raimundo Silva", regiao: "Comunidade do Pilar" },
  "20000000-0000-4000-8000-000000000006": { nome: "Ateliê Barro Vivo", regiao: "Alto do Moura, Caruaru" },
};

// [id, artesaoId, nome, tecnica, categoria, preco, estoqueQtd, dataCadastro], na ordem da carga.
const LINHAS = [
  [PRODUTO.vasoMaragogi, "20000000-0000-4000-8000-000000000001", "Vaso de Cerâmica Maragogi", "Cerâmica", "Decoração", 185, 8, "2025-06-01"],
  [PRODUTO.tapeteTear, "20000000-0000-4000-8000-000000000002", "Tapete Tear Manual", "Têxtil", "Casa", 320, 8, "2025-05-20"],
  [PRODUTO.esculturaLeao, "20000000-0000-4000-8000-000000000003", "Escultura em Madeira - Leão", "Madeira", "Decoração", 410, 3, "2025-05-11"],
  [PRODUTO.rendaBilro, "20000000-0000-4000-8000-000000000004", "Renda de Bilro Flor do Agreste", "Renda e Bordado", "Vestuário", 95, 15, "2025-06-10"],
  [PRODUTO.cestoPalha, "20000000-0000-4000-8000-000000000005", "Cesto de Palha Trançada", "Palha", "Casa", 68, 20, "2025-06-15"],
  [PRODUTO.jarroFosco, "20000000-0000-4000-8000-000000000006", "Jarro de Cerâmica Fosco", "Cerâmica", "Decoração", 210, 6, "2025-06-18"],
  [PRODUTO.mantaAlgodao, "20000000-0000-4000-8000-000000000002", "Manta de Algodão Cru", "Têxtil", "Casa", 275, 5, "2025-06-20"],
];

// Produtos no formato que as rotas devolvem (ProdutoComArtesao), com a foto da carga (/produtos/pN.svg).
export const PRODUTOS = LINHAS.map(([id, artesaoId, nome, tecnica, categoria, preco, estoqueQtd, dataCadastro], i) => ({
  id,
  artesaoId,
  nome,
  descricao: "",
  tecnica,
  categoria,
  preco,
  estoqueQtd,
  dataCadastro,
  imagemUrl: `/produtos/p${i + 1}.svg`,
  artesaoNome: ARTESAO[artesaoId].nome,
  artesaoRegiao: ARTESAO[artesaoId].regiao,
}));

// Notas da tabela avaliacao, por produto.
export const NOTAS = {
  [PRODUTO.vasoMaragogi]: [5, 4],
  [PRODUTO.tapeteTear]: [4],
  [PRODUTO.rendaBilro]: [5, 5],
  [PRODUTO.jarroFosco]: [4],
};

// Itens dos pedidos de cada comprador, na ordem da tabela item_pedido.
export const COMPRAS = {
  [COMPRADORES.anaBeatriz]: [
    { produtoId: PRODUTO.vasoMaragogi, quantidade: 1 },
    { produtoId: PRODUTO.tapeteTear, quantidade: 1 },
  ],
  [COMPRADORES.carlosAndrade]: [
    { produtoId: PRODUTO.rendaBilro, quantidade: 1 },
    { produtoId: PRODUTO.cestoPalha, quantidade: 1 },
    { produtoId: PRODUTO.jarroFosco, quantidade: 1 },
  ],
};
