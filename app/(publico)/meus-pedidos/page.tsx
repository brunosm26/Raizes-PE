"use client";

import NextLink from "next/link";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  CloseButton,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import BarraNavegacao from "@/components/BarraNavegacao";
import LinhaPedido from "@/components/LinhaPedido";
import { usePedidos } from "@/lib/contextoPedidos";
import { useSessao } from "@/lib/contextoSessao";

export default function Pagina() {
  const { pedidosDoComprador, notificacoesDoComprador, marcarNotificacoesComoLidas } =
    usePedidos();
  const { usuario } = useSessao();
  const compradorId = usuario?.id ?? "";

  // O servidor já devolve só os pedidos do usuário logado; o filtro garante o mesmo aqui.
  // (O admin, que vê todos os pedidos no servidor, não tem pedidos próprios.)
  const pedidos = pedidosDoComprador(compradorId);
  const avisosNaoLidos = notificacoesDoComprador(compradorId).filter((n) => !n.lida);

  return (
    <>
      <BarraNavegacao />
      <Box maxW="900px" mx="auto" px={{ base: 5, md: 10 }} py={12}>
        <Heading fontSize="1.9rem" mb={2}>
          Meus Pedidos
        </Heading>
        <Text color="mutedFg" mb={8}>
          Acompanhe aqui o andamento das suas compras.
        </Text>

        {/* O aviso de envio fica na tela até o comprador fechar, em vez de sumir sozinho
            como um toast: quem entra depois do envio precisa continuar vendo. */}
        {avisosNaoLidos.length > 0 && (
          <Alert
            status="success"
            bg="accent"
            color="accentFg"
            borderRadius="10px"
            alignItems="flex-start"
            mb={6}
          >
            <AlertIcon color="accentFg" />
            <Box flex={1}>
              {avisosNaoLidos.map((aviso) => (
                <Text key={aviso.id} fontSize="0.9rem">
                  {aviso.mensagem}
                </Text>
              ))}
            </Box>
            <CloseButton
              aria-label="Fechar aviso de envio"
              onClick={() => marcarNotificacoesComoLidas(compradorId)}
            />
          </Alert>
        )}

        {pedidos.length === 0 ? (
          <VStack spacing={5} py={16} textAlign="center" color="mutedFg">
            <Text>Você ainda não fez nenhum pedido.</Text>
            <Button as={NextLink} href="/" variant="solid">
              Ver artesanatos
            </Button>
          </VStack>
        ) : (
          <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflow="hidden">
            {pedidos.map((pedido) => (
              <LinhaPedido key={pedido.id} pedido={pedido} />
            ))}
          </Box>
        )}
      </Box>
    </>
  );
}
