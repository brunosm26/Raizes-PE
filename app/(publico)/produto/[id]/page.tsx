"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import NextLink from "next/link";
import {
  Box,
  Grid,
  Heading,
  Text,
  Badge,
  Button,
  HStack,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { FiArrowLeft, FiMapPin } from "react-icons/fi";
import BarraNavegacao from "@/components/BarraNavegacao";
import GradeProdutos from "@/components/GradeProdutos";
import MensagemErro from "@/components/MensagemErro";
import ResumoAvaliacao from "@/components/ResumoAvaliacao";
import {
  getProdutoPorId,
  getProdutosRelacionados,
  getResumoAvaliacoes,
} from "@/lib/apiCatalogo";
import { estiloFundoProduto } from "@/lib/arteProduto";
import { useCarrinho } from "@/lib/contextoCarrinho";
import type { ProdutoComArtesao, ResumoAvaliacoes } from "@/lib/tipos";

export default function Pagina() {
  const parametros = useParams<{ id: string }>();
  const { adicionarItem, abrirGaveta } = useCarrinho();
  const [produto, setProduto] = useState<ProdutoComArtesao | null | undefined>(undefined);
  const [relacionados, setRelacionados] = useState<ProdutoComArtesao[]>([]);
  const [resumoAvaliacoes, setResumoAvaliacoes] = useState<ResumoAvaliacoes | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setErro(false);
    setProduto(undefined);
    getProdutoPorId(parametros.id)
      .then((p) => {
        if (!ativo) return;
        setProduto(p ?? null);
      })
      .catch(() => {
        if (ativo) setErro(true);
      });
    return () => {
      ativo = false;
    };
  }, [parametros.id, tentativa]);

  useEffect(() => {
    if (!produto) return;
    let ativo = true;
    setErroSecundario(false);
    getProdutosRelacionados(produto.id)
      .then((dados) => {
        if (ativo) setRelacionados(dados);
      })
      .catch(() => {
        if (ativo) setErroSecundario(true);
      });
    getResumoAvaliacoes(produto.id)
      .then((dados) => {
        if (ativo) setResumoAvaliacoes(dados);
      })
      .catch(() => {
        if (ativo) setErroSecundario(true);
      });
    return () => {
      ativo = false;
    };
  }, [produto]);

  const [erroSecundario, setErroSecundario] = useState(false);

  if (erro) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={20}>
          <MensagemErro mensagem="Não foi possível carregar este produto." aoTentarNovamente={() => setTentativa((atual) => atual + 1)} />
        </Box>
      </>
    );
  }

  if (produto === undefined) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={20} textAlign="center">
          <Text color="mutedFg">Carregando produto...</Text>
        </Box>
      </>
    );
  }

  if (produto === null) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={20} textAlign="center">
          <Heading fontSize="1.5rem" mb={3}>
            Produto não encontrado
          </Heading>
          <Text color="mutedFg" mb={6}>
            Esse produto pode ter sido removido ou o endereço está incorreto.
          </Text>
          <Button as={NextLink} href="/" variant="solid">
            Voltar à vitrine
          </Button>
        </Box>
      </>
    );
  }

  const semEstoque = produto.estoqueQtd <= 0;

  return (
    <>
      <BarraNavegacao />
      <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={10}>
        <ChakraLink
          as={NextLink}
          href="/"
          display="inline-flex"
          alignItems="center"
          gap={2}
          fontSize="0.88rem"
          color="mutedFg"
          mb={8}
          _hover={{ color: "primary" }}
        >
          <FiArrowLeft /> Voltar à vitrine
        </ChakraLink>

        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={12} mb={20}>
          <Box
            h={{ base: "320px", md: "480px" }}
            borderRadius="12px"
            {...estiloFundoProduto(produto)}
          />

          <Box>
            <Badge
              bg="accent"
              color="accentFg"
              borderRadius="full"
              px={3}
              py={0.5}
              fontSize="0.72rem"
              fontWeight={600}
              mb={3}
              textTransform="none"
            >
              {produto.tecnica}
            </Badge>

            <Heading fontSize="2rem" mb={3}>
              {produto.nome}
            </Heading>

            {resumoAvaliacoes && (
              <Box mb={4}>
                <ResumoAvaliacao resumo={resumoAvaliacoes} />
              </Box>
            )}
            {erroSecundario && (
              <Box mb={4}>
                <MensagemErro
                  mensagem="Não foi possível carregar avaliações e recomendações."
                  aoTentarNovamente={() => setTentativa((atual) => atual + 1)}
                />
              </Box>
            )}

            <Text fontSize="1.6rem" fontWeight={600} mb={5}>
              R$ {produto.preco.toFixed(2).replace(".", ",")}
            </Text>

            <Text color="mutedFg" lineHeight={1.7} mb={7}>
              {produto.descricao}
            </Text>

            {/* Abrir a gaveta logo em seguida deixa visível que a peça entrou no carrinho */}
            <Button
              variant="solid"
              size="lg"
              mb={2}
              isDisabled={semEstoque}
              onClick={() => {
                adicionarItem(produto);
                abrirGaveta();
              }}
            >
              {semEstoque ? "Peça esgotada" : "Adicionar ao carrinho"}
            </Button>

            <Text fontSize="0.82rem" color="mutedFg" mb={8}>
              {semEstoque
                ? "Esta peça acabou. Fale com o artesão para saber de uma nova produção."
                : `${produto.estoqueQtd} ${produto.estoqueQtd === 1 ? "peça disponível" : "peças disponíveis"}`}
            </Text>

            <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" p={5}>
              <Text fontSize="0.8rem" color="mutedFg" mb={1}>
                Feito por
              </Text>
              <ChakraLink
                as={NextLink}
                href={`/artesao/${produto.artesaoId}`}
                fontFamily="heading"
                fontSize="1.1rem"
                fontWeight={500}
                _hover={{ color: "primary" }}
              >
                {produto.artesaoNome}
              </ChakraLink>
              <HStack fontSize="0.82rem" color="mutedFg" mt={1} spacing={1}>
                <FiMapPin size={12} />
                <Text>{produto.artesaoRegiao}</Text>
              </HStack>
            </Box>
          </Box>
        </Grid>

        {relacionados.length > 0 && (
          <Box pb={10}>
            <Heading fontSize="1.3rem" mb={6}>
              Você também pode gostar
            </Heading>
            <GradeProdutos produtos={relacionados} colunas={3} />
          </Box>
        )}
      </Box>
    </>
  );
}
