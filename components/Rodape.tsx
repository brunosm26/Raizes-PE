import { Box, Flex, Text, VStack, Link as ChakraLink } from "@chakra-ui/react";
import NextLink from "next/link";
import { TECNICAS } from "@/lib/tipos";

export default function Rodape() {
  return (
    <Box as="footer" borderTop="1px solid" borderColor="border" mt={16}>
      <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} py={10}>
        <Flex direction={{ base: "column", md: "row" }} justify="space-between" gap={10}>
          <Box maxW="340px">
            <Text fontFamily="heading" fontSize="lg" fontWeight={600} color="primary" mb={2}>
              Raízes PE
            </Text>
            <Text fontSize="0.85rem" color="mutedFg" lineHeight={1.6}>
              Marketplace da economia criativa e do artesanato de Pernambuco. Feito à mão,
              direto de quem faz.
            </Text>
          </Box>

          <Box>
            <Text fontSize="0.78rem" fontWeight={600} mb={3}>
              Navegação
            </Text>
            <VStack align="start" spacing={2} fontSize="0.85rem" color="mutedFg">
              <ChakraLink as={NextLink} href="/" _hover={{ color: "primary" }}>
                Vitrine
              </ChakraLink>
              <ChakraLink as={NextLink} href="/painel" _hover={{ color: "primary" }}>
                Painel do Artesão
              </ChakraLink>
            </VStack>
          </Box>

          <Box>
            <Text fontSize="0.78rem" fontWeight={600} mb={3}>
              Técnicas
            </Text>
            <VStack align="start" spacing={2} fontSize="0.85rem" color="mutedFg">
              {TECNICAS.map((tecnica) => (
                <ChakraLink
                  key={tecnica}
                  as={NextLink}
                  href={`/?tecnica=${encodeURIComponent(tecnica)}`}
                  _hover={{ color: "primary" }}
                >
                  {tecnica}
                </ChakraLink>
              ))}
            </VStack>
          </Box>
        </Flex>

        <Text fontSize="0.75rem" color="mutedFg" mt={10} pt={6} borderTop="1px solid" borderColor="border">
          © {new Date().getFullYear()} Raízes PE — projeto acadêmico, dados representativos.
        </Text>
      </Box>
    </Box>
  );
}
