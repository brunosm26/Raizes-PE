"use client";

import { useState } from "react";
import { Badge, Box, Button, Flex, Heading, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import NextLink from "next/link";
import MensagemErro from "@/components/MensagemErro";
import { aprovarArtesaoAdmin } from "@/lib/apiAdminFiltros";
import { useArtesaosAdmin } from "@/lib/useArtesaosAdmin";

export default function GestaoArtesaosPage() {
  const { artesaos, carregando, erro, tentarDeNovo } = useArtesaosAdmin();
  const [aprovando, setAprovando] = useState<string | null>(null);
  const toast = useToast();

  async function aprovar(id: string) {
    setAprovando(id);
    try {
      await aprovarArtesaoAdmin(id);
      tentarDeNovo();
    } catch (erro) {
      toast({
        title: erro instanceof Error ? erro.message : "Não foi possível aprovar o artesão.",
        status: "error",
        isClosable: true,
      });
    } finally {
      setAprovando(null);
    }
  }

  const pronto = !carregando;
  const pendentes = artesaos.filter((artesao) => !artesao.aprovado).length;

  return (
    <Box>
      <Heading fontSize="1.9rem" mb={3}>
        Gestão de Artesãos
      </Heading>
      {pronto && !erro && (
        <Text color="mutedFg" fontSize="sm" mb={4}>
          {pendentes} {pendentes === 1 ? "cadastro aguarda" : "cadastros aguardam"} aprovação.
        </Text>
      )}

      {erro ? (
        <MensagemErro mensagem="Não foi possível carregar os artesãos." aoTentarNovamente={tentarDeNovo} />
      ) : (
        <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Artesão</Th>
                <Th>Região</Th>
                <Th>Técnicas</Th>
                <Th isNumeric>Produtos</Th>
                <Th>Login</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {!pronto && (
                <Tr>
                  <Td colSpan={7}>Carregando artesãos...</Td>
                </Tr>
              )}
              {pronto && artesaos.length === 0 && (
                <Tr>
                  <Td colSpan={7}>Nenhum artesão cadastrado.</Td>
                </Tr>
              )}
              {pronto &&
                artesaos.map((artesao) => (
                  <Tr key={artesao.id}>
                    <Td fontWeight={500}>{artesao.nome}</Td>
                    <Td>{artesao.regiaoOrigem || "—"}</Td>
                    <Td>
                      {artesao.tecnicas.length === 0 ? (
                        <Text as="span" color="mutedFg" fontSize="sm">
                          Sem produtos
                        </Text>
                      ) : (
                        <Flex wrap="wrap" gap={1}>
                          {artesao.tecnicas.map((tecnica) => (
                            <Badge key={tecnica} bg="muted" color="mutedFg" textTransform="none">
                              {tecnica}
                            </Badge>
                          ))}
                        </Flex>
                      )}
                    </Td>
                    <Td isNumeric>{artesao.totalProdutos}</Td>
                    <Td>{artesao.temLogin ? "Sim" : "Não"}</Td>
                    <Td>
                      <Badge
                        bg={artesao.aprovado ? "accent" : "secondary"}
                        color={artesao.aprovado ? "accentFg" : "secondaryFg"}
                        borderRadius="full"
                        px={3}
                        textTransform="none"
                      >
                        {artesao.aprovado ? "Aprovado" : "Pendente"}
                      </Badge>
                    </Td>
                    <Td>
                      <Flex gap={2}>
                        <Button as={NextLink} href={`/artesao/${artesao.id}`} size="sm" variant="outline">
                          Ver Perfil
                        </Button>
                        {!artesao.aprovado && (
                          <Button
                            size="sm"
                            variant="solid"
                            onClick={() => aprovar(artesao.id)}
                            isLoading={aprovando === artesao.id}
                            isDisabled={aprovando !== null}
                          >
                            Aprovar
                          </Button>
                        )}
                      </Flex>
                    </Td>
                  </Tr>
                ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
