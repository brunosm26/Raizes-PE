"use client";

import { useMemo } from "react";
import { Box, Heading, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import EtiquetaStatusPedido from "@/components/EtiquetaStatusPedido";
import { numeroPedido } from "@/lib/idsLegados";
import { usePedidos } from "@/lib/contextoPedidos";

// "2025-07-02" -> "02/07/2025". Feito na mão de propósito: passar a string por new Date()
// a interpreta como UTC e, no fuso do Brasil, a data volta um dia.
function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function PedidosGeraisPage() {
  const { todosOsPedidos } = usePedidos();

  const pedidos = useMemo(() => todosOsPedidos(), [todosOsPedidos]);

  // Um pedido pode misturar peças de vários artesãos, então a coluna "Artesão" lista
  // todos os envolvidos (o nome vem junto com cada item, direto do banco).
  function artesaosDoPedido(itens: { artesaoNome?: string }[]): string {
    const nomes = Array.from(new Set(itens.map((i) => i.artesaoNome ?? "Desconhecido")));
    return nomes.join(", ");
  }

  return (
    <Box>
      <Heading fontSize="1.9rem" mb={6}>
        Visão Geral de Pedidos
      </Heading>

      <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Data</Th>
              <Th>Artesão</Th>
              <Th>Comprador</Th>
              <Th isNumeric>Total</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {pedidos.map((pedido) => (
              <Tr key={pedido.id}>
                <Td fontWeight={600}>#{numeroPedido(pedido.id)}</Td>
                <Td>{formatarData(pedido.dataPedido)}</Td>
                <Td>{artesaosDoPedido(pedido.itens)}</Td>
                <Td>{pedido.compradorNome}</Td>
                <Td isNumeric>R$ {pedido.valorTotal.toFixed(2).replace(".", ",")}</Td>
                <Td>
                  <EtiquetaStatusPedido status={pedido.status} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {pedidos.length === 0 && (
          <Text px={5} py={8} color="mutedFg" textAlign="center">
            Nenhum pedido registrado ainda.
          </Text>
        )}
      </Box>
    </Box>
  );
}
