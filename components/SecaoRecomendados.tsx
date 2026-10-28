"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Badge,
  HStack,
  Button,
  Flex,
  Icon,
  Tooltip,
  useToast,
  Link as ChakraLink,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { FiCompass, FiMapPin, FiShoppingCart, FiHelpCircle } from "react-icons/fi";
import type { ProdutoRecomendado } from "@/lib/motorRecomendacao";
import { useCarrinho } from "@/lib/contextoCarrinho";
import { useSessao } from "@/lib/contextoSessao";
import { estiloFundoProduto } from "@/lib/arteProduto";

export default function SecaoRecomendados() {
  const { usuario, carregando } = useSessao();
  // Comprador logado → recomendações pelo histórico dele; visitante e demais perfis → cold start.
  // Quem decide é o servidor, pela sessão; aqui só recarregamos quando a pessoa entra ou sai.
  const compradorId = usuario?.tipo === "comprador" ? usuario.id : undefined;
  const [recomendados, setRecomendados] = useState<ProdutoRecomendado[]>([]);
  const { itens, adicionarItem } = useCarrinho();
  const toast = useToast();

  useEffect(() => {
    if (carregando) return;
    let ativo = true;
    fetch("/api/recomendacoes?limite=4")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: { dados?: ProdutoRecomendado[] }) => {
        if (ativo) setRecomendados(json.dados ?? []);
      })
      .catch(() => {
        if (ativo) setRecomendados([]);
      });
    return () => {
      ativo = false;
    };
  }, [compradorId, carregando]);

  function handleAdicionar(produto: ProdutoRecomendado) {
    adicionarItem(produto);
    toast({
      title: "Adicionado ao carrinho!",
      description: `${produto.nome} foi colocado no seu cesto de compras.`,
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
  }

  const ehModoHistorico = Boolean(compradorId);

  return (
    <Box
      bg="bg"
      border="1px solid"
      borderColor="border"
      borderRadius="14px"
      p={{ base: 5, md: 7 }}
      mb={10}
      boxShadow="sm"
    >
      <Flex
        justify="space-between"
        align={{ base: "flex-start", sm: "center" }}
        direction={{ base: "column", sm: "row" }}
        gap={4}
        mb={6}
      >
        <Box>
          <HStack spacing={2} mb={1}>
            <Icon as={FiCompass} color="primary" />
            <Heading fontSize="1.3rem" fontWeight={600}>
              {ehModoHistorico ? "Recomendações para Você" : "Destaques Curados para Começar"}
            </Heading>
            <Tooltip
              label="Recomendação inteligente via baseline de IA (PI4-20): prioriza técnicas do seu histórico, região e itens mais avaliados."
              hasArrow
              placement="top"
            >
              <span>
                <Icon as={FiHelpCircle} color="mutedFg" cursor="help" />
              </span>
            </Tooltip>
          </HStack>
          <Text fontSize="0.88rem" color="mutedFg">
            {ehModoHistorico
              ? "Itens selecionados pelo módulo de IA com base nas suas preferências de artesanato."
              : "Sugestões de boas-vindas com base nas peças mais procuradas da nossa cultura."}
          </Text>
        </Box>

      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={5}>
        {recomendados.map((prod) => {
          const quantidadeNoCarrinho = itens.find((item) => item.produtoId === prod.id)?.quantidade ?? 0;

          return (
            <Box
              key={prod.id}
              border="1px solid"
              borderColor="border"
              borderRadius="10px"
              overflow="hidden"
              bg="card"
              display="flex"
              flexDirection="column"
              transition="transform 0.2s, box-shadow 0.2s"
              _hover={{ transform: "translateY(-3px)", boxShadow: "md" }}
            >
              <ChakraLink
                as={NextLink}
                href={`/produto/${prod.id}`}
                _hover={{ textDecoration: "none" }}
              >
                <Box h="160px" position="relative" {...estiloFundoProduto(prod)}>
                  <Badge
                    position="absolute"
                    top={2}
                    left={2}
                    bg="accent"
                    color="accentFg"
                    borderRadius="full"
                    px={2.5}
                    py={0.5}
                    fontSize="0.68rem"
                    fontWeight={600}
                    textTransform="none"
                  >
                    {prod.tecnica}
                  </Badge>
                </Box>
              </ChakraLink>

              <Box p={{ base: 4, md: 5 }} display="flex" flexDirection="column" flex="1">
                {/* Badge explicativo da IA */}
                <Box mb={2}>
                  <Badge
                    bg="rgba(183, 92, 64, 0.12)"
                    color="primary"
                    borderRadius="md"
                    px={2}
                    py={1}
                    fontSize="0.72rem"
                    fontWeight={500}
                    display="block"
                    whiteSpace="normal"
                    lineHeight={1.25}
                  >
                    💡 {prod.motivo}
                  </Badge>
                </Box>

                <ChakraLink
                  as={NextLink}
                  href={`/produto/${prod.id}`}
                  fontFamily="heading"
                  fontSize="0.98rem"
                  fontWeight={500}
                  lineHeight={1.3}
                  mb={1}
                  _hover={{ color: "primary" }}
                >
                  {prod.nome}
                </ChakraLink>

                <Text fontSize="0.8rem" color="mutedFg" mb={2}>
                  por {prod.artesaoNome}
                </Text>

                <HStack fontSize="0.75rem" color="mutedFg" mb={3} spacing={1}>
                  <FiMapPin size={11} />
                  <Text noOfLines={1}>{prod.artesaoRegiao}</Text>
                </HStack>

                <Flex justify="space-between" align="center" mt="auto" pt={2} borderTop="1px solid" borderColor="border" gap={2}>
                  <Box>
                    <Text fontWeight={600} fontSize="0.95rem">
                      R$ {prod.preco.toFixed(2).replace(".", ",")}
                    </Text>
                    {quantidadeNoCarrinho > 0 && (
                      <Text fontSize="0.68rem" color="primary" fontWeight={600} mt={1}>
                        {quantidadeNoCarrinho} {quantidadeNoCarrinho === 1 ? "unidade" : "unidades"} no carrinho
                      </Text>
                    )}
                  </Box>
                  <Button
                    size="xs"
                    px={7}
                    py={2}
                    variant={quantidadeNoCarrinho > 0 ? "solid" : "outline"}
                    leftIcon={<FiShoppingCart size={12} />}
                    onClick={() => handleAdicionar(prod)}
                  >
                    {quantidadeNoCarrinho > 0 ? `Adicionar +1` : "Adicionar"}
                  </Button>
                </Flex>
              </Box>
            </Box>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
