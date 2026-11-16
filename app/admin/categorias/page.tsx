"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Box, Flex, Heading, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import MensagemErro from "@/components/MensagemErro";
import { getOpcoesFiltros } from "@/lib/apiAdminFiltros";
import { contarPorCategoria } from "@/lib/contagemCategorias";
import { useProdutos } from "@/lib/contextoProdutos";
import { apagarCategoriasAntigas } from "@/lib/estadoAdmin";
import { TECNICAS } from "@/lib/tipos";

// D1 da PI4-143: não há tabela de categorias. A lista é a das categorias dos produtos
// (GET /api/filtros), só para leitura; a contagem usa os produtos já carregados no contexto.
export default function GestaoCategoriasPage() {
  const { produtos } = useProdutos();
  const [categorias, setCategorias] = useState<string[] | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  // A lista editável antiga ficava no localStorage; agora não é mais usada.
  useEffect(() => {
    try {
      apagarCategoriasAntigas(window.localStorage);
    } catch {
      // sem localStorage: nada a apagar
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    setErro(false);
    setCategorias(null);
    getOpcoesFiltros()
      .then((opcoes) => {
        if (ativo) setCategorias(opcoes.categorias);
      })
      .catch(() => {
        if (ativo) setErro(true);
      });
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  const contagem = useMemo(() => contarPorCategoria(categorias ?? [], produtos), [categorias, produtos]);

  return (
    <Box>
      <Heading fontSize="1.9rem" mb={3}>
        Categorias e Técnicas
      </Heading>
      <Text color="mutedFg" fontSize="sm" mb={4}>
        As categorias vêm dos produtos cadastrados: não há tabela de categorias, então esta lista é só de leitura.
        Uma categoria nova aparece aqui quando um produto é cadastrado com ela.
      </Text>

      {erro ? (
        <MensagemErro mensagem="Não foi possível carregar as categorias." aoTentarNovamente={() => setTentativa((t) => t + 1)} />
      ) : (
        <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Categoria</Th>
                <Th isNumeric>Produtos</Th>
              </Tr>
            </Thead>
            <Tbody>
              {categorias === null && (
                <Tr>
                  <Td colSpan={2}>Carregando categorias...</Td>
                </Tr>
              )}
              {categorias !== null && contagem.length === 0 && (
                <Tr>
                  <Td colSpan={2}>Nenhuma categoria: ainda não há produtos cadastrados.</Td>
                </Tr>
              )}
              {contagem.map(({ categoria, totalProdutos }) => (
                <Tr key={categoria}>
                  <Td fontWeight={500}>{categoria}</Td>
                  <Td isNumeric>{totalProdutos}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <Box mt={8}>
        <Heading as="h3" fontSize="1.05rem" fontWeight={500} mb={2}>
          Técnicas
        </Heading>
        <Text color="mutedFg" fontSize="sm" mb={3}>
          Lista fixa da plataforma (a mesma regra do banco para a técnica do produto).
        </Text>
        <Flex wrap="wrap" gap={2}>
          {TECNICAS.map((tecnica) => (
            <Badge key={tecnica} bg="muted" color="mutedFg" textTransform="none" px={3} py={1} borderRadius="full">
              {tecnica}
            </Badge>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
