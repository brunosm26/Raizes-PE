"use client";

import { useState } from "react";
import { Badge, Box, Flex, Heading, Select, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import MensagemErro from "@/components/MensagemErro";
import { useProdutos } from "@/lib/contextoProdutos";
import { useArtesaosAdmin } from "@/lib/useArtesaosAdmin";

const TODOS_OS_ARTESAOS = "";
const ROTULOS_STATUS = {
  pendente: "Em revisão",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

// "2026-11-15" -> "15/11/2026"
function formatarData(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

export default function ModeracaoProdutosPage() {
  const { produtos, carregandoProdutos, erroProdutos, recarregarProdutos } = useProdutos();
  const { artesaos, carregando: carregandoArtesaos, erro, tentarDeNovo } = useArtesaosAdmin();
  const [filtroArtesao, setFiltroArtesao] = useState(TODOS_OS_ARTESAOS);

  const visiveis = filtroArtesao === TODOS_OS_ARTESAOS
    ? produtos
    : produtos.filter((produto) => produto.artesaoId === filtroArtesao);
  const emRevisao = visiveis.filter((produto) => produto.statusCuradoria === "pendente").length;
  const carregando = carregandoProdutos || carregandoArtesaos;

  function recarregar() {
    tentarDeNovo();
    recarregarProdutos();
  }

  return (
    <Box>
      <Heading fontSize="1.9rem" mb={3}>
        Moderação de Produtos
      </Heading>
      <Flex gap={4} mb={4} align="flex-end" wrap="wrap">
        <Box>
          <Text as="label" htmlFor="filtro-artesao" display="block" fontSize="0.72rem" color="mutedFg" mb={1}>
            Artesão
          </Text>
          <Select
            id="filtro-artesao"
            size="sm"
            borderRadius="md"
            borderColor="border"
            bg="card"
            minW="220px"
            value={filtroArtesao}
            onChange={(e) => setFiltroArtesao(e.target.value)}
            isDisabled={carregandoArtesaos || erro}
          >
            <option value={TODOS_OS_ARTESAOS}>Todos os artesãos</option>
            {artesaos.map((artesao) => (
              <option key={artesao.id} value={artesao.id}>
                {artesao.nome} ({artesao.totalProdutos})
              </option>
            ))}
          </Select>
        </Box>
        {!carregando && !erro && !erroProdutos && (
          <Text fontSize="sm" color="mutedFg" mb={1}>
            {visiveis.length} {visiveis.length === 1 ? "produto" : "produtos"}, {emRevisao} em revisão
          </Text>
        )}
      </Flex>

      {erro || erroProdutos ? (
        <MensagemErro mensagem="Não foi possível carregar os artesãos e os produtos." aoTentarNovamente={recarregar} />
      ) : (
        <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Produto</Th>
                <Th>Artesão</Th>
                <Th>Categoria</Th>
                <Th>Cadastro</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {carregando && (
                <Tr>
                  <Td colSpan={5}>Carregando produtos...</Td>
                </Tr>
              )}
              {!carregando && visiveis.length === 0 && (
                <Tr>
                  <Td colSpan={5}>Nenhum produto para mostrar.</Td>
                </Tr>
              )}
              {!carregando && visiveis.map((produto) => (
                <Tr key={produto.id}>
                  <Td fontWeight={500}>{produto.nome}</Td>
                  <Td>{produto.artesaoNome}</Td>
                  <Td>{produto.categoria}</Td>
                  <Td>{formatarData(produto.dataCadastro)}</Td>
                  <Td>
                    <Badge
                      colorScheme={produto.statusCuradoria === "aprovado" ? "green" : "gray"}
                      borderRadius="full"
                      px={3}
                      textTransform="none"
                    >
                      {ROTULOS_STATUS[produto.statusCuradoria]}
                    </Badge>
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
