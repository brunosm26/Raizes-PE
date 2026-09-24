"use client";

import { useRef, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Image,
  Input,
  InputGroup,
  InputLeftAddon,
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
  Select,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { FiImage, FiUpload } from "react-icons/fi";
import { tecnicas } from "@/lib/apiFalsa";
import { aplicarMascara, completarPreco, ehCaractereDePreco, formatarPreco, formatarPrecoAoRetomar } from "@/lib/mascaras";
import type { Tecnica } from "@/lib/tipos";

// Tamanho máximo de imagem aceito no upload. Como não há backend, a foto vira um
// data URL guardado no localStorage junto do produto — um arquivo grande demais
// deixaria o armazenamento do navegador cheio rapidinho.
const TAMANHO_MAXIMO_IMAGEM = 2 * 1024 * 1024; // 2MB

interface CamposFormulario {
  nome: string;
  descricao: string;
  tecnica: Tecnica;
  categoria: string;
  preco: string;
  estoqueQtd: string;
}

const CAMPOS_VAZIOS: CamposFormulario = {
  nome: "",
  descricao: "",
  tecnica: tecnicas[0],
  categoria: "",
  preco: "",
  estoqueQtd: "1",
};

export interface DadosProdutoSubmetido {
  nome: string;
  descricao: string;
  tecnica: Tecnica;
  categoria: string;
  preco: number;
  estoqueQtd: number;
  imagemUrl?: string;
}

function lerArquivoComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

export default function ModalAdicionarProduto({
  aberto,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (dados: DadosProdutoSubmetido) => void;
}) {
  const [campos, setCampos] = useState<CamposFormulario>(CAMPOS_VAZIOS);
  const [imagemPreview, setImagemPreview] = useState<string | undefined>(undefined);
  const [erroImagem, setErroImagem] = useState<string | undefined>(undefined);
  const [erros, setErros] = useState<Partial<Record<keyof CamposFormulario, string>>>({});
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const precoRecemFocado = useRef(false);

  function limparEFechar() {
    setCampos(CAMPOS_VAZIOS);
    setImagemPreview(undefined);
    setErroImagem(undefined);
    setErros({});
    aoFechar();
  }

  async function aoEscolherImagem(evento: React.ChangeEvent<HTMLInputElement>) {
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

    setErroImagem(undefined);
    const dataUrl = await lerArquivoComoDataUrl(arquivo);
    setImagemPreview(dataUrl);
  }

  function validar(): boolean {
    const novosErros: Partial<Record<keyof CamposFormulario, string>> = {};

    if (!campos.nome.trim()) novosErros.nome = "Dê um nome para o produto.";
    if (!campos.descricao.trim()) novosErros.descricao = "Descreva o produto.";
    if (!campos.categoria.trim()) novosErros.categoria = "Informe a categoria.";

    const preco = Number(campos.preco.replace(",", "."));
    if (!campos.preco || Number.isNaN(preco) || preco <= 0) {
      novosErros.preco = "Informe um valor válido.";
    }

    const estoque = Number(campos.estoqueQtd);
    if (campos.estoqueQtd === "" || Number.isNaN(estoque) || estoque < 0) {
      novosErros.estoqueQtd = "Informe a quantidade em estoque.";
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  function aoSubmeter(evento: React.FormEvent) {
    evento.preventDefault();
    if (!validar()) return;

    aoSalvar({
      nome: campos.nome.trim(),
      descricao: campos.descricao.trim(),
      tecnica: campos.tecnica,
      categoria: campos.categoria.trim(),
      preco: Number(campos.preco.replace(",", ".")),
      estoqueQtd: Number(campos.estoqueQtd),
      imagemUrl: imagemPreview,
    });

    limparEFechar();
  }

  return (
    <Modal isOpen={aberto} onClose={limparEFechar} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent
        as="form"
        onSubmit={aoSubmeter}
        bg="bg"
        color="fg"
        maxH="calc(100vh - 2rem)"
      >
        <ModalHeader
          flexShrink={0}
          fontFamily="heading"
          fontWeight={600}
          borderBottom="1px solid"
          borderColor="border"
        >
          Adicionar Produto
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody overflowY="auto" py={{ base: 4, md: 5 }}>
          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel fontSize="0.86rem">Foto do produto</FormLabel>
              <Box
                border="1px dashed"
                borderColor="border"
                borderRadius="10px"
                p={4}
                display="flex"
                alignItems="center"
                gap={4}
              >
                <Box
                  w="88px"
                  h="88px"
                  borderRadius="8px"
                  flexShrink={0}
                  bg="secondary"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                >
                  {imagemPreview ? (
                    <Image src={imagemPreview} alt="Pré-visualização do produto" boxSize="88px" objectFit="cover" />
                  ) : (
                    <FiImage size={28} color="var(--chakra-colors-mutedFg)" />
                  )}
                </Box>
                <Box flex={1}>
                  <Input
                    ref={inputArquivoRef}
                    type="file"
                    accept="image/*"
                    onChange={aoEscolherImagem}
                    display="none"
                  />
                  <Button
                    leftIcon={<FiUpload />}
                    variant="outline"
                    size="sm"
                    borderColor="border"
                    onClick={() => inputArquivoRef.current?.click()}
                  >
                    {imagemPreview ? "Trocar imagem" : "Enviar imagem"}
                  </Button>
                  <Text fontSize="0.76rem" color="mutedFg" mt={2}>
                    JPG, PNG ou WEBP, até 2MB.
                  </Text>
                  {erroImagem && (
                    <Text fontSize="0.76rem" color="red.400" mt={1}>
                      {erroImagem}
                    </Text>
                  )}
                </Box>
              </Box>
            </FormControl>

            <FormControl isInvalid={!!erros.nome} isRequired>
              <FormLabel fontSize="0.86rem">Nome do produto</FormLabel>
              <Input
                value={campos.nome}
                onChange={(e) => setCampos({ ...campos, nome: e.target.value })}
                placeholder="Ex.: Vaso de Cerâmica Maragogi"
              />
              <FormErrorMessage>{erros.nome}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!erros.descricao} isRequired>
              <FormLabel fontSize="0.86rem">Descrição</FormLabel>
              <Textarea
                value={campos.descricao}
                onChange={(e) => setCampos({ ...campos, descricao: e.target.value })}
                placeholder="Conte como a peça é feita, os materiais e o que a torna única."
                rows={4}
              />
              <FormErrorMessage>{erros.descricao}</FormErrorMessage>
            </FormControl>

            <Box display="grid" gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={4}>
              <FormControl isRequired>
                <FormLabel fontSize="0.86rem">Técnica</FormLabel>
                <Select
                  value={campos.tecnica}
                  onChange={(e) => setCampos({ ...campos, tecnica: e.target.value as Tecnica })}
                >
                  {tecnicas.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isInvalid={!!erros.categoria} isRequired>
                <FormLabel fontSize="0.86rem">Categoria</FormLabel>
                <Input
                  value={campos.categoria}
                  onChange={(e) => setCampos({ ...campos, categoria: e.target.value })}
                  placeholder="Ex.: Decoração, Casa, Vestuário"
                />
                <FormErrorMessage>{erros.categoria}</FormErrorMessage>
              </FormControl>
            </Box>

            <Box display="grid" gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={4}>
              <FormControl isInvalid={!!erros.preco} isRequired>
                <FormLabel fontSize="0.86rem">Valor</FormLabel>
                <InputGroup>
                  <InputLeftAddon>R$</InputLeftAddon>
                  <Input
                    value={campos.preco}
                    onFocus={() => {
                      precoRecemFocado.current = true;
                    }}
                    onChange={(e) => {
                      const valor = aplicarMascara(
                        e,
                        (digitado) =>
                          precoRecemFocado.current
                            ? formatarPrecoAoRetomar(campos.preco, digitado)
                            : formatarPreco(digitado),
                        ehCaractereDePreco,
                      );
                      precoRecemFocado.current = false;
                      setCampos({ ...campos, preco: valor });
                    }}
                    onBlur={() => setCampos({ ...campos, preco: completarPreco(campos.preco) })}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </InputGroup>
                <FormErrorMessage>{erros.preco}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!erros.estoqueQtd} isRequired>
                <FormLabel fontSize="0.86rem">Estoque</FormLabel>
                <NumberInput
                  value={campos.estoqueQtd}
                  min={0}
                  onChange={(valor) => setCampos({ ...campos, estoqueQtd: valor })}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <FormErrorMessage>{erros.estoqueQtd}</FormErrorMessage>
              </FormControl>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter flexShrink={0} borderTop="1px solid" borderColor="border" gap={3}>
          <Button variant="ghost" onClick={limparEFechar}>
            Cancelar
          </Button>
          <Button variant="solid" type="submit">
            Salvar produto
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
