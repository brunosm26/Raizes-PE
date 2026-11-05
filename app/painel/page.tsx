"use client";

import { useEffect, useState } from "react";
import { Flex, Box, Heading, Text, Button, SimpleGrid, useDisclosure, useToast } from "@chakra-ui/react";
import BarraNavegacao from "@/components/BarraNavegacao";
import CartaoEstatistica from "@/components/CartaoEstatistica";
import GraficoVendas from "@/components/GraficoVendas";
import LinhaProduto from "@/components/LinhaProduto";
import LinhaPedido from "@/components/LinhaPedido";
import ModalAdicionarProduto, { DadosProdutoSubmetido } from "@/components/ModalAdicionarProduto";
import ModalEditarProduto from "@/components/ModalEditarProduto";
import MensagemErro from "@/components/MensagemErro";
import type { ProdutoComArtesao } from "@/lib/tipos";
import { usePedidos } from "@/lib/contextoPedidos";
import { useProdutos } from "@/lib/contextoProdutos";
import { useSessao } from "@/lib/contextoSessao";
import { apiFetch } from "@/lib/apiUrl";
import type { EstatisticasPainel } from "@/lib/tipos";

export default function Pagina() {
  const { usuario } = useSessao();
  const usuarioId = usuario?.id ?? "";
  const [estatisticas, setEstatisticas] = useState<EstatisticasPainel | null>(null);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<ProdutoComArtesao | null>(null);
  const [erroEstatisticas, setErroEstatisticas] = useState(false);
  const [tentativaEstatisticas, setTentativaEstatisticas] = useState(0);
  const { pedidosDoArtesao, pedidosPendentesDoArtesao, marcarComoEnviado } =
    usePedidos();
  const { produtosDoArtesao, criarProduto, editarProduto } = useProdutos();
  const { isOpen: modalAberto, onOpen: abrirModal, onClose: fecharModal } = useDisclosure();
  const toast = useToast();

  const pedidos = pedidosDoArtesao(usuarioId);
  const pendentes = pedidosPendentesDoArtesao(usuarioId);
  // Produtos da loja do artesão, direto do banco.
  const produtos = produtosDoArtesao(usuarioId);

  // Estatísticas calculadas no banco a partir dos pedidos reais do artesão logado.
  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    setErroEstatisticas(false);
    apiFetch("/api/painel/estatisticas")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((dados: EstatisticasPainel) => {
        if (ativo) setEstatisticas(dados);
      })
      .catch(() => {
        if (ativo) setErroEstatisticas(true);
      });
    return () => {
      ativo = false;
    };
  }, [tentativaEstatisticas, usuarioId]);

  async function enviarPedido(pedidoId: string) {
    try {
      await marcarComoEnviado(pedidoId);
      toast({
        title: "Pedido marcado como enviado",
        description: "O comprador foi avisado de que o pedido está a caminho.",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    } catch (erro) {
      toast({
        title: "Não foi possível atualizar o pedido",
        description: erro instanceof Error ? erro.message : "Tente novamente.",
        status: "error",
        duration: 6000,
        isClosable: true,
        position: "top",
      });
    }
  }

  function avisarErro(titulo: string, erro: unknown) {
    toast({
      title: titulo,
      description: erro instanceof Error ? erro.message : "Tente novamente.",
      status: "error",
      duration: 6000,
      isClosable: true,
      position: "top",
    });
  }

  async function salvarNovoProduto(dados: DadosProdutoSubmetido) {
    try {
      const criado = await criarProduto(usuarioId, dados);
      toast({
        title: "Produto adicionado",
        description: `"${criado.nome}" já está disponível na sua loja.`,
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    } catch (erro) {
      avisarErro("Não foi possível adicionar o produto", erro);
    }
  }

  async function salvarEdicaoProduto(id: string, dados: Parameters<typeof editarProduto>[1]) {
    try {
      await editarProduto(id, dados);
      toast({
        title: "Produto atualizado",
        status: "success",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    } catch (erro) {
      avisarErro("Não foi possível atualizar o produto", erro);
    }
  }

  return (
    <>
      <BarraNavegacao />
      <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }}>
        <Flex justify="space-between" align="flex-end" py={12} flexWrap="wrap" gap={4}>
          <Box>
            <Heading fontSize="1.9rem">Olá, Cooperativa de Tacaratu</Heading>
            <Text color="mutedFg" mt={2}>
              Aqui está o resumo da sua loja hoje.
            </Text>
          </Box>
          <Button variant="solid" onClick={abrirModal}>
            Adicionar Produto
          </Button>
        </Flex>

        {erroEstatisticas ? (
          <Box mb={10}>
            <MensagemErro
              mensagem="Não foi possível carregar as estatísticas da loja."
              aoTentarNovamente={() => setTentativaEstatisticas((atual) => atual + 1)}
            />
          </Box>
        ) : (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5} mb={10}>
          {estatisticas && (
            <>
              {/* Mês mais recente com vendas, somando só os itens deste artesão. */}
              <CartaoEstatistica
                rotulo="Vendas do Mês"
                valor={`R$ ${estatisticas.vendasDoMes.toFixed(2).replace(".", ",")}`}
                variacao={`${estatisticas.vendasDeltaPct >= 0 ? "+" : ""}${estatisticas.vendasDeltaPct}% em relação ao mês anterior`}
                tom={estatisticas.vendasDeltaPct >= 0 ? "bom" : "atencao"}
              />
              {/* Vem do contexto, não da apiFalsa: precisa cair na hora em que o
                  artesão marca um pedido como enviado, logo abaixo nesta mesma tela. */}
              <CartaoEstatistica
                rotulo="Pedidos Pendentes"
                valor={String(pendentes)}
                variacao={pendentes > 0 ? "Requer atenção" : "Nenhum pedido em aberto"}
                tom={pendentes > 0 ? "atencao" : "bom"}
              />
              <CartaoEstatistica
                rotulo="Peças em Estoque"
                valor={String(produtos.reduce((soma, p) => soma + p.estoqueQtd, 0))}
                variacao={`${produtos.length} ${produtos.length === 1 ? "produto cadastrado" : "produtos cadastrados"}`}
                tom="bom"
              />
            </>
          )}
        </SimpleGrid>
        )}

        {estatisticas && (
          <GraficoVendas
            historicoMensal={estatisticas.historicoMensal}
            vendasPorTecnica={estatisticas.vendasPorTecnica}
          />
        )}

        <Box
          bg="card"
          border="1px solid"
          borderColor="border"
          borderRadius="10px"
          overflow="hidden"
          mb={10}
        >
          <Box px={5} py={4} borderBottom="1px solid" borderColor="border">
            <Heading fontSize="1.05rem" fontWeight={500}>
              Pedidos recebidos
            </Heading>
            <Text fontSize="0.82rem" color="mutedFg" mt={1}>
              Ao marcar um pedido como enviado, o comprador é avisado na área dele.
            </Text>
          </Box>

          {pedidos.length === 0 ? (
            <Text px={5} py={8} color="mutedFg" textAlign="center">
              Nenhum pedido recebido ainda.
            </Text>
          ) : (
            pedidos.map((pedido) => (
              <LinhaPedido
                key={pedido.id}
                pedido={pedido}
                mostrarComprador
                aoEnviar={enviarPedido}
              />
            ))
          )}
        </Box>

        <Box
          bg="card"
          border="1px solid"
          borderColor="border"
          borderRadius="10px"
          overflow="hidden"
          mb={16}
        >
          <Box px={5} py={4} borderBottom="1px solid" borderColor="border">
            <Heading fontSize="1.05rem" fontWeight={500}>
              Seus produtos (estoque)
            </Heading>
          </Box>
          {produtos.length === 0 ? (
            <Text px={5} py={8} color="mutedFg" textAlign="center">
              Nenhum produto cadastrado ainda.
            </Text>
          ) : (
            produtos.map((p) => <LinhaProduto key={p.id} produto={p} aoEditar={setProdutoEmEdicao} />)
          )}
        </Box>
      </Box>

      <ModalAdicionarProduto aberto={modalAberto} aoFechar={fecharModal} aoSalvar={salvarNovoProduto} />
      <ModalEditarProduto
        produto={produtoEmEdicao}
        aberto={!!produtoEmEdicao}
        aoFechar={() => setProdutoEmEdicao(null)}
        aoSalvar={salvarEdicaoProduto}
      />
    </>
  );
}
