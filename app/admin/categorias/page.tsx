"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from "@chakra-ui/react";
import { FiEdit, FiPlus, FiTrash2 } from "react-icons/fi";
import { categorias } from "@/lib/apiFalsa";
import DialogoConfirmacao from "@/components/DialogoConfirmacao";

const CHAVE_CATEGORIAS = "raizes-pe:categorias";

// "Renda e Bordado" -> "renda-e-bordado"
function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function GestaoCategoriasPage() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [lista, setLista] = useState<string[] | null>(null);
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<string | null>(null);

  useEffect(() => {
    try {
      const salvo: unknown = JSON.parse(localStorage.getItem(CHAVE_CATEGORIAS) ?? "null");
      setLista(Array.isArray(salvo) && salvo.every((item) => typeof item === "string") ? salvo : categorias);
    } catch {
      setLista(categorias);
    }
  }, []);

  useEffect(() => {
    if (lista === null) return;
    try {
      localStorage.setItem(CHAVE_CATEGORIAS, JSON.stringify(lista));
    } catch {
      // A lista continua editável nesta sessão.
    }
  }, [lista]);

  function abrirFormulario(categoria?: string) {
    setNome(categoria ?? "");
    setEditando(categoria ?? null);
    setErro("");
    onOpen();
  }

  function salvar() {
    const novoNome = nome.trim();
    if (!novoNome) {
      setErro("Informe o nome da categoria.");
      return;
    }
    if (lista?.some((item) => item.toLocaleLowerCase() === novoNome.toLocaleLowerCase() && item !== editando)) {
      setErro("Essa categoria já existe.");
      return;
    }
    setLista((atual) => [...new Set([...(atual ?? []).filter((item) => item !== editando), novoNome])]);
    onClose();
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
        <Heading fontSize="1.9rem">Categorias e Técnicas</Heading>
        <Button variant="solid" leftIcon={<FiPlus />} onClick={() => abrirFormulario()} isDisabled={lista === null}>
          Nova Categoria
        </Button>
      </Flex>
      <Text color="mutedFg" fontSize="sm" mb={4}>Categorias de demonstração: mudanças nesta lista não alteram produtos já cadastrados.</Text>

      <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Nome</Th>
              <Th>Slug</Th>
              <Th>Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {lista === null && <Tr><Td colSpan={4}>Carregando categorias...</Td></Tr>}
            {(lista ?? []).map((nome, indice) => (
              <Tr key={nome}>
                <Td fontWeight={500}>{indice + 1}</Td>
                <Td>{nome}</Td>
                <Td>{gerarSlug(nome)}</Td>
                <Td>
                  <Flex gap={2}>
                    <Button size="sm" variant="ghost" aria-label={`Editar ${nome}`} onClick={() => abrirFormulario(nome)}>
                      <FiEdit />
                    </Button>
                    <Button size="sm" variant="ghost" color="red.600" aria-label={`Excluir ${nome}`} onClick={() => setCategoriaParaExcluir(nome)}>
                      <FiTrash2 />
                    </Button>
                  </Flex>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent bg="card">
          <ModalHeader>{editando ? "Editar Categoria" : "Adicionar Categoria"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired>
              <FormLabel>Nome da Categoria</FormLabel>
              <Input placeholder="Ex: Renda" value={nome} onChange={(evento) => setNome(evento.target.value)} />
            </FormControl>
            <FormControl mt={4} isRequired>
              <FormLabel>Slug</FormLabel>
              <Input value={gerarSlug(nome)} isReadOnly />
            </FormControl>
            {erro && <Text color="red.500" mt={3}>{erro}</Text>}
          </ModalBody>

          <ModalFooter>
            <Button variant="solid" mr={3} onClick={salvar}>
              Salvar
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <DialogoConfirmacao
        aberto={categoriaParaExcluir !== null}
        titulo="Excluir categoria?"
        mensagem={`"${categoriaParaExcluir ?? ""}" será removida desta lista de demonstração.`}
        rotuloConfirmar="Excluir"
        aoCancelar={() => setCategoriaParaExcluir(null)}
        aoConfirmar={() => {
          setLista((atual) => (atual ?? []).filter((item) => item !== categoriaParaExcluir));
          setCategoriaParaExcluir(null);
        }}
      />
    </Box>
  );
}
