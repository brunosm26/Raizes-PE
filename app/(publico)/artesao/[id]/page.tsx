"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import NextLink from "next/link";
import { Box, Heading, Text, HStack, Button, Link as ChakraLink } from "@chakra-ui/react";
import { FiArrowLeft, FiMapPin } from "react-icons/fi";
import BarraNavegacao from "@/components/BarraNavegacao";
import GradeProdutos from "@/components/GradeProdutos";
import MensagemErro from "@/components/MensagemErro";
import { getPerfilArtesao } from "@/lib/apiCatalogo";
import type { PerfilArtesao } from "@/lib/tipos";

export default function Pagina() {
  const parametros = useParams<{ id: string }>();
  const [perfil, setPerfil] = useState<PerfilArtesao | null | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setErro(false);
    setPerfil(undefined);
    getPerfilArtesao(parametros.id)
      .then((p) => {
        if (!ativo) return;
        setPerfil(p ?? null);
      })
      .catch(() => {
        if (ativo) setErro(true);
      });
    return () => {
      ativo = false;
    };
  }, [parametros.id, tentativa]);

  if (erro) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={20}>
          <MensagemErro mensagem="Não foi possível carregar o perfil do artesão." aoTentarNovamente={() => setTentativa((atual) => atual + 1)} />
        </Box>
      </>
    );
  }

  if (perfil === undefined) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={20} textAlign="center">
          <Text color="mutedFg">Carregando perfil...</Text>
        </Box>
      </>
    );
  }

  if (perfil === null) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={20} textAlign="center">
          <Heading fontSize="1.5rem" mb={3}>
            Artesão não encontrado
          </Heading>
          <Text color="mutedFg" mb={6}>
            Esse perfil pode ter sido removido ou o endereço está incorreto.
          </Text>
          <Button as={NextLink} href="/" variant="solid">
            Voltar à vitrine
          </Button>
        </Box>
      </>
    );
  }

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

        <Box
          h="140px"
          borderRadius="12px"
          mb={-12}
          backgroundImage="linear-gradient(135deg, #d9b48f 0%, #b75c40 65%, #8a4530 100%)"
        />

        <Box
          bg="card"
          border="1px solid"
          borderColor="border"
          borderRadius="12px"
          p={7}
          mx={{ base: 4, md: 8 }}
          mb={12}
          position="relative"
        >
          <Heading fontSize="1.6rem" mb={2}>
            {perfil.nome}
          </Heading>
          <HStack fontSize="0.9rem" color="mutedFg" mb={4} spacing={1}>
            <FiMapPin size={14} />
            <Text>{perfil.regiaoOrigem}</Text>
          </HStack>
          <Text color="mutedFg" lineHeight={1.7} maxW="65ch">
            {perfil.biografia}
          </Text>
        </Box>

        <Heading fontSize="1.3rem" mb={6}>
          Peças de {perfil.nome}
        </Heading>
        <Box pb={10}>
          <GradeProdutos
            produtos={perfil.produtos}
            mensagemVazia="Esse artesão ainda não tem peças publicadas."
          />
        </Box>
      </Box>
    </>
  );
}
