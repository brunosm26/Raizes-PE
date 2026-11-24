"use client";

import { useState } from "react";
import {
  Badge, Box, Button, Flex, FormControl, FormLabel, Heading, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, Select, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr, useToast,
} from "@chakra-ui/react";
import MensagemErro from "@/components/MensagemErro";
import { useProdutos } from "@/lib/contextoProdutos";
import { useArtesaosAdmin } from "@/lib/useArtesaosAdmin";
import type { ProdutoComArtesao } from "@/lib/tipos";

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
  const { produtos, carregandoProdutos, erroProdutos, recarregarProdutos, moderarProduto } = useProdutos();
  const { artesaos, carregando: carregandoArtesaos, erro, tentarDeNovo } = useArtesaosAdmin();
  const toast = useToast();
  const [aprovando, setAprovando] = useState<string>();
  const [produtoParaRejeitar, setProdutoParaRejeitar] = useState<ProdutoComArtesao>();
  const [justificativa, setJustificativa] = useState("");
  const [rejeitando, setRejeitando] = useState(false);
  const [filtroArtesao, setFiltroArtesao] = useState(TODOS_OS_ARTESAOS);

  const visiveis = filtroArtesao === TODOS_OS_ARTESAOS
    ? produtos
    : produtos.filter((produto) => produto.artesaoId === filtroArtesao);
  const emRevisao = visiveis.filter((produto) => produto.statusCuradoria === "pendente").length;
  const carregando = carregandoProdutos || carregandoArtesaos;

  async function aprovar(id: string) {
    setAprovando(id);
    try {
      await moderarProduto(id, { status: "aprovado" });
      toast({ title: "Produto aprovado", status: "success" });
    } catch (erro) {
      toast({
        title: "Não foi possível aprovar o produto",
        description: erro instanceof Error ? erro.message : undefined,
        status: "error",
      });
    } finally {
      setAprovando(undefined);
    }
  }

  function abrirRejeicao(produto: ProdutoComArtesao) {
    setJustificativa("");
    setProdutoParaRejeitar(produto);
  }

  function fecharRejeicao() {
    if (!rejeitando) setProdutoParaRejeitar(undefined);
  }

  async function rejeitar() {
    const motivo = justificativa.trim();
    if (!produtoParaRejeitar || !motivo || rejeitando) return;
    setRejeitando(true);
    try {
      await moderarProduto(produtoParaRejeitar.id, { status: "rejeitado", justificativa: motivo });
      toast({ title: "Produto rejeitado", status: "success" });
      setProdutoParaRejeitar(undefined);
    } catch (erro) {
      toast({
        title: "Não foi possível rejeitar o produto",
        description: erro instanceof Error ? erro.message : undefined,
        status: "error",
      });
    } finally {
      setRejeitando(false);
    }
  }

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
                <Th>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {carregando && (
                <Tr>
                  <Td colSpan={6}>Carregando produtos...</Td>
                </Tr>
              )}
              {!carregando && visiveis.length === 0 && (
                <Tr>
                  <Td colSpan={6}>Nenhum produto para mostrar.</Td>
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
                      colorScheme={{ aprovado: "green", pendente: "gray", rejeitado: "red" }[produto.statusCuradoria]}
                      borderRadius="full"
                      px={3}
                      textTransform="none"
                    >
                      {ROTULOS_STATUS[produto.statusCuradoria]}
                    </Badge>
                    {produto.rejeicaoCuradoria && (
                      <Text fontSize="sm" mt={1} maxW="280px" whiteSpace="pre-wrap" overflowWrap="anywhere">
                        {produto.rejeicaoCuradoria.justificativa}
                      </Text>
                    )}
                  </Td>
                  <Td>
                    {produto.statusCuradoria === "pendente" && (
                      <Flex gap={2} wrap="wrap">
                        <Button
                          size="sm"
                          isLoading={aprovando === produto.id}
                          isDisabled={aprovando !== undefined}
                          onClick={() => void aprovar(produto.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="red"
                          isDisabled={aprovando !== undefined}
                          onClick={() => abrirRejeicao(produto)}
                        >
                          Rejeitar
                        </Button>
                      </Flex>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <Modal isOpen={Boolean(produtoParaRejeitar)} onClose={fecharRejeicao} isCentered>
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={(evento) => { evento.preventDefault(); void rejeitar(); }}>
            <ModalHeader>Rejeitar produto</ModalHeader>
            <ModalCloseButton isDisabled={rejeitando} />
            <ModalBody>
              <Text mb={4}>{produtoParaRejeitar?.nome}</Text>
              <FormControl isRequired>
                <FormLabel>Justificativa</FormLabel>
                <Textarea
                  value={justificativa}
                  onChange={(evento) => setJustificativa(evento.target.value)}
                  maxLength={500}
                  isDisabled={rejeitando}
                />
              </FormControl>
            </ModalBody>
            <ModalFooter gap={2}>
              <Button variant="ghost" onClick={fecharRejeicao} isDisabled={rejeitando}>Cancelar</Button>
              <Button type="submit" colorScheme="red" isLoading={rejeitando} isDisabled={!justificativa.trim()}>
                Rejeitar produto
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </Box>
  );
}
