import { Flex, Box, Text, Button, Image } from "@chakra-ui/react";
import { estiloFundoProduto } from "@/lib/arteProduto";
import type { ProdutoComArtesao } from "@/lib/tipos";

export default function LinhaProduto({ produto, aoEditar }: { produto: ProdutoComArtesao; aoEditar: (produto: ProdutoComArtesao) => void }) {
  const statusCuradoria = {
    pendente: "Aguardando aprovação",
    aprovado: "Aprovado",
    rejeitado: "Rejeitado",
  }[produto.statusCuradoria];

  return (
    <Flex
      align="center"
      gap={4}
      px={5}
      py={4}
      borderBottom="1px solid"
      borderColor="border"
      _last={{ borderBottom: "none" }}
    >
      {produto.imagemUrl ? (
        <Image
          src={produto.imagemUrl}
          alt={produto.nome}
          boxSize="56px"
          borderRadius="8px"
          flexShrink={0}
          objectFit="cover"
        />
      ) : (
        <Box
          w="56px"
          h="56px"
          borderRadius="8px"
          flexShrink={0}
          {...estiloFundoProduto(produto)}
        />
      )}
      <Box flex={1}>
        <Text fontWeight={500}>{produto.nome}</Text>
        <Text fontSize="0.82rem" color="mutedFg">
          {produto.tecnica}
        </Text>
        <Text fontSize="0.82rem" color="mutedFg">
          {statusCuradoria}
        </Text>
      </Box>
      <Box textAlign="right" mr={2}>
        <Text fontSize="0.82rem" color="mutedFg">
          {produto.estoqueQtd} em estoque
        </Text>
        <Text fontWeight={500}>R$ {produto.preco.toFixed(2).replace(".", ",")}</Text>
      </Box>
      <Button variant="outline" size="sm" borderColor="border" color="primary" onClick={() => aoEditar(produto)}>
        Editar
      </Button>
    </Flex>
  );
}
