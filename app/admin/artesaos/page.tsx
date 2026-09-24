"use client";

import { useEffect, useState } from "react";
import { Badge, Box, Button, Flex, Heading, Table, Tbody, Td, Th, Thead, Tr } from "@chakra-ui/react";
import NextLink from "next/link";
import { getArtesaos, getUsuarios } from "@/lib/apiFalsa";
import { Artesao, Usuario } from "@/lib/tipos";
import { useProdutos } from "@/lib/contextoProdutos";

export default function GestaoArtesaosPage() {
  const { produtosDoArtesao } = useProdutos();
  const [aprovado, setAprovado] = useState<boolean | null>(null);
  const [artesaos, setArtesaos] = useState<Artesao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setAprovado(localStorage.getItem("raizes-pe:artesao-aprovado") === "true");
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.all([getArtesaos(), getUsuarios()]).then(([todosArtesaos, todosUsuarios]) => {
      if (!ativo) return;
      setArtesaos(todosArtesaos);
      setUsuarios(todosUsuarios);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const aprovarArtesao = () => {
    localStorage.setItem("raizes-pe:artesao-aprovado", "true");
    setAprovado(true);
  };

  return (
    <Box>
      <Heading fontSize="1.9rem" mb={6}>
        Gestão de Artesãos
      </Heading>

      <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Artesão</Th>
              <Th>Região</Th>
              <Th>Técnicas</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {carregando && (
              <Tr>
                <Td colSpan={5}>Carregando artesãos...</Td>
              </Tr>
            )}
            {!carregando && artesaos.map((artesao, indice) => {
              const nome = usuarios.find((u) => u.id === artesao.usuarioId)?.nome ?? "Desconhecido";
              // Técnicas que o artesão de fato trabalha = técnicas dos produtos dele.
              const tecnicas = Array.from(
                new Set(produtosDoArtesao(artesao.usuarioId).map((p) => p.tecnica))
              );
              // Ainda não existe status de aprovação no modelo: o primeiro aparece como
              // pendente só para demonstrar o fluxo (igual à versão da branch mvp).
              const carregandoAprovacao = indice === 0 && aprovado === null;
              const pendente = indice === 0 && aprovado === false;

              return (
                <Tr key={artesao.id}>
                  <Td fontWeight={500}>{nome}</Td>
                  <Td>{artesao.regiaoOrigem}</Td>
                  <Td>
                    <Flex wrap="wrap" gap={1}>
                      {tecnicas.map((tecnica) => (
                        <Badge key={tecnica} bg="muted" color="mutedFg" textTransform="none">
                          {tecnica}
                        </Badge>
                      ))}
                    </Flex>
                  </Td>
                  <Td>
                    <Badge
                      bg={carregandoAprovacao ? "muted" : pendente ? "secondary" : "accent"}
                      color={carregandoAprovacao ? "mutedFg" : pendente ? "secondaryFg" : "accentFg"}
                      borderRadius="full"
                      px={3}
                      textTransform="none"
                    >
                      {carregandoAprovacao ? "Carregando..." : pendente ? "Pendente" : "Aprovado"}
                    </Badge>
                  </Td>
                  <Td>
                    <Flex gap={2}>
                      <Button as={NextLink} href={`/artesao/${artesao.id}`} size="sm" variant="outline">
                        Ver Perfil
                      </Button>
                      {pendente && (
                        <Button size="sm" variant="solid" onClick={aprovarArtesao}>
                          Aprovar
                        </Button>
                      )}
                    </Flex>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
