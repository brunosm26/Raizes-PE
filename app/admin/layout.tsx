"use client";

import { Box, Heading, HStack, Link as ChakraLink } from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";

const linksAdmin = [
  { nome: "Dashboard", href: "/admin" },
  { nome: "Gestão de Artesãos", href: "/admin/artesaos" },
  { nome: "Produtos e Moderação", href: "/admin/produtos" },
  { nome: "Visão de Pedidos", href: "/admin/pedidos" },
  { nome: "Atividade de Cadastros", href: "/admin/atividade" },
  { nome: "Categorias e Técnicas", href: "/admin/categorias" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const caminho = usePathname();

  // "/admin" só é ativo na raiz; as demais rotas casam por prefixo.
  const ativo = (href: string) =>
    href === "/admin" ? caminho === "/admin" : caminho.startsWith(href);

  return (
    <Box as="section" minH="70vh">
      <Box
        as="header"
        borderBottom="1px solid"
        borderColor="border"
        px={{ base: 5, md: 10 }}
        pt={6}
        pb={4}
      >
        <Box maxW="1180px" mx="auto">
          <Heading as="h1" fontSize="1.5rem" color="primary">
            Administração — Raízes PE
          </Heading>

          <HStack as="nav" aria-label="Navegação do admin" spacing={{ base: 4, lg: 6 }} mt={4} fontSize="sm" flexWrap="wrap">
            {linksAdmin.map((link) => (
              <ChakraLink
                key={link.href}
                as={NextLink}
                href={link.href}
                aria-current={ativo(link.href) ? "page" : undefined}
                color={ativo(link.href) ? "fg" : "mutedFg"}
                fontWeight={ativo(link.href) ? 500 : 400}
                borderBottom="2px solid"
                borderColor={ativo(link.href) ? "primary" : "transparent"}
                pb={1}
                whiteSpace="nowrap"
                _hover={{ textDecoration: "none", color: "fg" }}
              >
                {link.nome}
              </ChakraLink>
            ))}
          </HStack>
        </Box>
      </Box>

      <Box as="main" maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={10}>
        {children}
      </Box>
    </Box>
  );
}
