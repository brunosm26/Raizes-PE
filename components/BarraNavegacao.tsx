"use client";

import { useState } from "react";
import {
  Box,
  Input,
  InputGroup,
  InputLeftElement,
  HStack,
  Link as ChakraLink,
  IconButton,
  Text,
  useColorMode,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiSearch, FiSun, FiMoon, FiShoppingBag } from "react-icons/fi";
import { useCarrinho } from "@/lib/contextoCarrinho";
import { useSessao } from "@/lib/contextoSessao";
import { PERFIS_POR_AREA } from "@/lib/sessao";

interface PropsBarraNavegacao {
  valorBusca?: string;
  aoMudarBusca?: (valor: string) => void;
}

export default function BarraNavegacao({ valorBusca, aoMudarBusca }: PropsBarraNavegacao) {
  const caminho = usePathname();
  const roteador = useRouter();
  const { colorMode, toggleColorMode } = useColorMode();
  const { quantidadeTotal, abrirGaveta } = useCarrinho();
  const { usuario, carregando, sair } = useSessao();

  // Cada perfil só vê os links das áreas que pode abrir: comprador → Meus Pedidos,
  // artesão → Painel do Artesão, admin → tudo. Visitante só vê a vitrine.
  const tipo = usuario?.tipo;
  const veMeusPedidos = !!tipo && (PERFIS_POR_AREA.pedidos as readonly string[]).includes(tipo);
  const vePainel = !!tipo && (PERFIS_POR_AREA.painel as readonly string[]).includes(tipo);
  const veAdmin = tipo === "admin";

  const naVitrine = caminho === "/";
  const noPainel = caminho === "/painel";
  const nosPedidos = caminho === "/meus-pedidos";
  const naAdmin = caminho.startsWith("/admin");
  const controlado = valorBusca !== undefined && aoMudarBusca !== undefined;

  const [termoLocal, setTermoLocal] = useState("");
  const termo = controlado ? valorBusca! : termoLocal;

  function aoDigitar(e: React.ChangeEvent<HTMLInputElement>) {
    if (controlado) aoMudarBusca!(e.target.value);
    else setTermoLocal(e.target.value);
  }

  function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!controlado) {
      roteador.push(`/?q=${encodeURIComponent(termo)}`);
    }
  }

  const campoDeBusca = (
    <Box as="form" onSubmit={aoEnviar} flex={1} maxW={{ base: "100%", md: "480px" }}>
      <InputGroup bg="muted" borderRadius="md">
        <InputLeftElement pointerEvents="none" color="mutedFg">
          <FiSearch />
        </InputLeftElement>
        <Input
          variant="unstyled"
          pl={10}
          h="40px"
          placeholder="Buscar artesanato, mestre ou técnica..."
          color="fg"
          _placeholder={{ color: "mutedFg" }}
          value={termo}
          onChange={aoDigitar}
        />
      </InputGroup>
    </Box>
  );

  // Com três links, spacing fixo estourava a linha em telas estreitas.
  const linksDeNavegacao = (
    <HStack spacing={{ base: 4, lg: 6 }} fontSize="sm" flexShrink={0} flexWrap="wrap">
      <ChakraLink
        as={NextLink}
        href="/"
        color={naVitrine ? "fg" : "mutedFg"}
        borderBottom="2px solid"
        borderColor={naVitrine ? "primary" : "transparent"}
        pb={1}
        fontWeight={naVitrine ? 500 : 400}
        _hover={{ textDecoration: "none" }}
      >
        Vitrine
      </ChakraLink>
      {veMeusPedidos && (
      <ChakraLink
        as={NextLink}
        href="/meus-pedidos"
        color={nosPedidos ? "fg" : "mutedFg"}
        borderBottom="2px solid"
        borderColor={nosPedidos ? "primary" : "transparent"}
        pb={1}
        fontWeight={nosPedidos ? 500 : 400}
        _hover={{ textDecoration: "none" }}
        whiteSpace="nowrap"
      >
        Meus Pedidos
      </ChakraLink>
      )}
      {vePainel && (
      <ChakraLink
        as={NextLink}
        href="/painel"
        color={noPainel ? "fg" : "mutedFg"}
        borderBottom="2px solid"
        borderColor={noPainel ? "primary" : "transparent"}
        pb={1}
        fontWeight={noPainel ? 500 : 400}
        _hover={{ textDecoration: "none" }}
        whiteSpace="nowrap"
      >
        Painel do Artesão
      </ChakraLink>
      )}
      {veAdmin && (
        <ChakraLink
          as={NextLink}
          href="/admin"
          color={naAdmin ? "fg" : "mutedFg"}
          borderBottom="2px solid"
          borderColor={naAdmin ? "primary" : "transparent"}
          pb={1}
          fontWeight={naAdmin ? 500 : 400}
          _hover={{ textDecoration: "none" }}
          whiteSpace="nowrap"
        >
          Administração
        </ChakraLink>
      )}
    </HStack>
  );

  return (
    <Box as="nav" borderBottom="1px solid" borderColor="border" px={{ base: 4, md: 10 }} py={4}>
      {/* Linha principal: sempre visível */}
      <HStack spacing={5} align="center">
        <Text
          as={NextLink}
          href="/"
          fontFamily="heading"
          fontSize="xl"
          fontWeight={600}
          color="primary"
          whiteSpace="nowrap"
        >
          Raízes PE
        </Text>

        {/* Busca some daqui no mobile e volta como linha própria abaixo */}
        <Box display={{ base: "none", md: "block" }} flex={1}>
          {campoDeBusca}
        </Box>

        <Box display={{ base: "none", md: "block" }} ml="auto">
          {linksDeNavegacao}
        </Box>

        <HStack spacing={1} ml={{ base: "auto", md: 0 }}>
          {!carregando && usuario && (
            <HStack spacing={1} display={{ base: "none", sm: "flex" }}>
              <Text fontSize="sm" color="mutedFg" px={2} noOfLines={1} maxW="140px">
                Olá, {usuario.nome.split(" ")[0]}
              </Text>
              <ChakraLink
                as="button"
                type="button"
                fontSize="sm"
                color="mutedFg"
                fontWeight={500}
                px={2}
                onClick={async () => {
                  await sair();
                  roteador.push("/");
                  roteador.refresh();
                }}
                _hover={{ color: "primary", textDecoration: "none" }}
              >
                Sair
              </ChakraLink>
            </HStack>
          )}
          {!carregando && !usuario && (
            <ChakraLink
              as={NextLink}
              href="/login"
              fontSize="sm"
              color="mutedFg"
              fontWeight={500}
              px={2}
              display={{ base: "none", sm: "block" }}
              _hover={{ color: "primary", textDecoration: "none" }}
            >
              Entrar
            </ChakraLink>
          )}
          <IconButton
            aria-label="Alternar tema"
            icon={colorMode === "dark" ? <FiSun /> : <FiMoon />}
            variant="ghost"
            onClick={toggleColorMode}
          />
          <Box position="relative">
            <IconButton
              aria-label={
                quantidadeTotal > 0
                  ? `Meu carrinho, ${quantidadeTotal} ${quantidadeTotal === 1 ? "peça" : "peças"}`
                  : "Meu carrinho, vazio"
              }
              icon={<FiShoppingBag />}
              variant="ghost"
              onClick={abrirGaveta}
            />
            {quantidadeTotal > 0 && (
              <Box
                position="absolute"
                top="-2px"
                right="-2px"
                bg="primary"
                color="primaryFg"
                fontSize="0.6rem"
                px="5px"
                borderRadius="full"
                fontWeight={600}
                pointerEvents="none"
              >
                {quantidadeTotal}
              </Box>
            )}
          </Box>
        </HStack>
      </HStack>

      {/* Linha extra só no mobile: busca em largura total + links de navegação */}
      <Box display={{ base: "block", md: "none" }} mt={3}>
        {campoDeBusca}
        <Box mt={3}>{linksDeNavegacao}</Box>
      </Box>
    </Box>
  );
}
