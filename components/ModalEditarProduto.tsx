"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftAddon,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Textarea,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiImage, FiUpload } from "react-icons/fi";
import type { ProdutoComArtesao } from "@/lib/tipos";
import { aplicarMascara, completarPreco, ehCaractereDePreco, formatarPreco } from "@/lib/mascaras";

type DadosEditados = Pick<ProdutoComArtesao, "nome" | "descricao" | "preco" | "estoqueQtd" | "imagemUrl">;

const TAMANHO_MAXIMO_IMAGEM = 2 * 1024 * 1024;

export default function ModalEditarProduto({
  produto,
  aberto,
  aoFechar,
  aoSalvar,
}: {
  produto: ProdutoComArtesao | null;
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (id: string, dados: DadosEditados) => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [estoqueQtd, setEstoqueQtd] = useState("0");
  const [imagemUrl, setImagemUrl] = useState<string | undefined>();
  const [erroImagem, setErroImagem] = useState("");
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!produto) return;
    setNome(produto.nome);
    setDescricao(produto.descricao);
    setPreco(produto.preco.toFixed(2).replace(".", ","));
    setEstoqueQtd(String(produto.estoqueQtd));
    setImagemUrl(produto.imagemUrl);
    setErroImagem("");
  }, [produto]);

  function escolherImagem(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setErroImagem("Escolha um arquivo de imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
      setErroImagem("A imagem precisa ter até 2MB.");
      return;
    }
    setErroImagem("");
    const leitor = new FileReader();
    leitor.onload = () => setImagemUrl(leitor.result as string);
    leitor.readAsDataURL(arquivo);
  }

  function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    if (!produto || !nome.trim() || !descricao.trim()) return;
    const valor = Number(preco.replace(",", "."));
    const estoque = Number(estoqueQtd);
    if (!Number.isFinite(valor) || valor <= 0 || !Number.isInteger(estoque) || estoque < 0) return;
    aoSalvar(produto.id, { nome: nome.trim(), descricao: descricao.trim(), preco: valor, estoqueQtd: estoque, imagemUrl });
    aoFechar();
  }

  return (
    <Modal isOpen={aberto} onClose={aoFechar} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={submeter} bg="bg" color="fg">
        <ModalHeader fontFamily="heading" fontWeight={600} borderBottom="1px solid" borderColor="border">
          Editar Produto
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={6}>
          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel fontSize="0.86rem">Foto do produto</FormLabel>
              <Box border="1px dashed" borderColor="border" borderRadius="10px" p={4} display="flex" alignItems="center" gap={4}>
                <Box w="88px" h="88px" borderRadius="8px" flexShrink={0} bg="secondary" display="flex" alignItems="center" justifyContent="center" overflow="hidden">
                  {imagemUrl ? <Image src={imagemUrl} alt="Pré-visualização do produto" boxSize="88px" objectFit="cover" /> : <FiImage size={28} color="var(--chakra-colors-mutedFg)" />}
                </Box>
                <Box flex={1}>
                  <Input ref={inputArquivoRef} type="file" accept="image/*" onChange={escolherImagem} display="none" />
                  <Button leftIcon={<FiUpload />} variant="outline" size="sm" borderColor="border" onClick={() => inputArquivoRef.current?.click()}>
                    {imagemUrl ? "Trocar imagem" : "Enviar imagem"}
                  </Button>
                  <Text fontSize="0.76rem" color="mutedFg" mt={2}>JPG, PNG ou WEBP, até 2MB.</Text>
                  {erroImagem && <Text fontSize="0.76rem" color="red.400" mt={1}>{erroImagem}</Text>}
                </Box>
              </Box>
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="0.86rem">Nome do produto</FormLabel>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="0.86rem">Descrição</FormLabel>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} />
            </FormControl>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <FormControl isRequired>
                <FormLabel fontSize="0.86rem">Valor</FormLabel>
                <InputGroup>
                  <InputLeftAddon>R$</InputLeftAddon>
                  <Input
                    value={preco}
                    onChange={(e) => setPreco(aplicarMascara(e, formatarPreco, ehCaractereDePreco))}
                    onBlur={() => setPreco(completarPreco(preco))}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </InputGroup>
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="0.86rem">Estoque</FormLabel>
                <NumberInput min={0} value={estoqueQtd} onChange={setEstoqueQtd}>
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
            </div>
          </VStack>
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor="border" gap={3}>
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button variant="solid" type="submit">Salvar alterações</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
