"use client";

import { Box, Button, Flex, HStack, Text, VStack } from "@chakra-ui/react";
import { FiTruck } from "react-icons/fi";
import EtiquetaStatusPedido from "@/components/EtiquetaStatusPedido";
import { numeroPedido } from "@/lib/idsLegados";
import type { PedidoComItens } from "@/lib/tipos";

// "2025-07-02" -> "02/07/2025". Feito na mão de propósito: passar a string por new Date()
// a interpreta como UTC e, no fuso do Brasil, a data volta um dia.
function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function LinhaPedido({
  pedido,
  mostrarComprador = false,
  aoEnviar,
}: {
  pedido: PedidoComItens;
  mostrarComprador?: boolean;
  aoEnviar?: (pedidoId: string) => void;
}) {
  const podeEnviar = pedido.status === "pendente" || pedido.status === "pago";
  const totalDePecas = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0);

  return (
    <Box px={5} py={4} borderBottom="1px solid" borderColor="border" _last={{ borderBottom: "none" }}>
      <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap" mb={3}>
        <Box>
          <HStack spacing={3} mb={1}>
            <Text fontFamily="heading" fontWeight={500}>
              Pedido {numeroPedido(pedido.id)}
            </Text>
            <EtiquetaStatusPedido status={pedido.status} />
          </HStack>
          <Text fontSize="0.82rem" color="mutedFg">
            {formatarData(pedido.dataPedido)}
            {mostrarComprador && ` · ${pedido.compradorNome}`}
            {` · ${totalDePecas} ${totalDePecas === 1 ? "peça" : "peças"}`}
          </Text>
        </Box>

        <Box textAlign="right">
          <Text fontWeight={600} fontSize="1.05rem">
            R$ {pedido.valorTotal.toFixed(2).replace(".", ",")}
          </Text>
        </Box>
      </Flex>

      <VStack align="stretch" spacing={1} mb={aoEnviar && podeEnviar ? 3 : 0}>
        {pedido.itens.map((item) => (
          <Text key={item.id} fontSize="0.86rem" color="mutedFg">
            {item.quantidade} × {item.produtoNome}
            <Text as="span" fontSize="0.78rem">
              {" "}
              ({item.produtoTecnica})
            </Text>
          </Text>
        ))}
      </VStack>

      {aoEnviar && podeEnviar && (
        <Button
          leftIcon={<FiTruck />}
          variant="outline"
          size="sm"
          borderColor="border"
          color="primary"
          onClick={() => aoEnviar(pedido.id)}
        >
          Marcar como enviado
        </Button>
      )}
    </Box>
  );
}
