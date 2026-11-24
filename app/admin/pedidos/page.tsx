"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Button, FormControl, FormLabel, Heading, Input, Stack, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import EtiquetaStatusPedido from "@/components/EtiquetaStatusPedido";
import { numeroPedido } from "@/lib/idsLegados";
import { usePedidos } from "@/lib/contextoPedidos";
import { apiFetch } from "@/lib/apiUrl";
import { lerPeriodoPedidos } from "@/lib/periodoPedidos";
import type { PedidoComItens } from "@/lib/tipos";

interface ResultadoConsulta {
  consulta: URLSearchParams;
  pedidos?: PedidoComItens[];
  erro?: string;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// "2025-07-02" -> "02/07/2025". Feito na mão de propósito: passar a string por new Date()
// a interpreta como UTC e, no fuso do Brasil, a data volta um dia.
function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function PedidosGeraisPage() {
  const { todosOsPedidos } = usePedidos();

  const todos = useMemo(() => todosOsPedidos(), [todosOsPedidos]);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [consulta, setConsulta] = useState<URLSearchParams | null>(null);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [erroPeriodo, setErroPeriodo] = useState("");
  const resultadoAtual = resultado?.consulta === consulta ? resultado : null;
  const pedidos = consulta ? resultadoAtual?.pedidos : todos;
  const erroConsulta = resultadoAtual?.erro;

  useEffect(() => {
    if (!consulta) return;
    const controller = new AbortController();
    apiFetch(`/api/pedidos?${consulta}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Falha ao consultar pedidos.");
        const dados: PedidoComItens[] = await res.json();
        if (!controller.signal.aborted) setResultado({ consulta, pedidos: dados });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResultado({ consulta, erro: "Não foi possível consultar os pedidos. Tente novamente." });
      });
    return () => controller.abort();
  }, [consulta]);

  function aplicarFiltro(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const periodo = lerPeriodoPedidos(inicio || undefined, fim || undefined);
    if (!periodo) {
      setErroPeriodo("Informe datas válidas e uma data final a partir da data inicial.");
      return;
    }
    setErroPeriodo("");
    const parametros = new URLSearchParams();
    if (periodo.inicio) parametros.set("inicio", periodo.inicio);
    if (periodo.fim) parametros.set("fim", periodo.fim);
    setConsulta(parametros.size ? parametros : null);
  }

  function limparFiltro() {
    setInicio("");
    setFim("");
    setConsulta(null);
    setErroPeriodo("");
  }

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

      <Box as="form" onSubmit={aplicarFiltro} mb={5}>
        <Stack direction={{ base: "column", md: "row" }} spacing={3} align={{ base: "stretch", md: "end" }}>
          <FormControl maxW={{ md: "12rem" }}>
            <FormLabel htmlFor="pedidos-inicio">Data inicial</FormLabel>
            <Input id="pedidos-inicio" type="date" value={inicio} onChange={(evento) => setInicio(evento.target.value)} />
          </FormControl>
          <FormControl maxW={{ md: "12rem" }}>
            <FormLabel htmlFor="pedidos-fim">Data final</FormLabel>
            <Input id="pedidos-fim" type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} />
          </FormControl>
          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="outline" onClick={limparFiltro}>Limpar</Button>
        </Stack>
        {erroPeriodo && <Text role="alert" mt={2} color="red.500">{erroPeriodo}</Text>}
      </Box>

      {consulta && erroConsulta && <Text role="alert" mb={4}>{erroConsulta}</Text>}
      {consulta && !pedidos && !erroConsulta && <Text role="status" mb={4}>Carregando pedidos…</Text>}
      {pedidos && (
        <Text role="status" mb={4}>
          {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} · Total dos pedidos:{" "}
          {moeda.format(pedidos.reduce((soma, pedido) => soma + pedido.valorTotal, 0))}
        </Text>
      )}
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
            {pedidos?.map((pedido) => (
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

        {pedidos?.length === 0 && (
          <Text px={5} py={8} color="mutedFg" textAlign="center">
            {consulta ? "Nenhum pedido encontrado no período." : "Nenhum pedido registrado ainda."}
          </Text>
        )}
      </Box>
    </Box>
  );
}
