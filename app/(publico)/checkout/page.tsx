"use client";

import { useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Step,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiArrowLeft, FiCheck } from "react-icons/fi";
import BarraNavegacao from "@/components/BarraNavegacao";
import { useCarrinho } from "@/lib/contextoCarrinho";
import { usePedidos, ID_COMPRADOR_DEMO } from "@/lib/contextoPedidos";
import type { DadosEntrega } from "@/lib/tipos";
import { aplicarMascara, formatarCep, formatarTelefone, somenteDigitos } from "@/lib/mascaras";

// Wizard curto de propósito: uma pergunta por vez, como decidido no foco de inclusão
// digital do projeto. A etapa 3 (sucesso) fica fora do Stepper porque não é editável.
const ETAPAS = [
  { titulo: "Seus dados", instrucao: "Primeiro, quem vai receber a encomenda?" },
  { titulo: "Endereço", instrucao: "Agora, onde devemos entregar?" },
  { titulo: "Revisão", instrucao: "Confira se está tudo certo antes de confirmar." },
];

const CAMPOS_OBRIGATORIOS: Record<number, (keyof DadosEntrega)[]> = {
  0: ["nome", "telefone"],
  1: ["cep", "rua", "numero", "bairro", "cidade", "uf"],
};

const ROTULOS: Record<keyof DadosEntrega, string> = {
  nome: "Nome completo",
  telefone: "Telefone com WhatsApp",
  cep: "CEP",
  rua: "Rua",
  numero: "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "Estado",
};

// Campos com formato fixo: a máscara formata enquanto digita e a validação passa a
// recusar valor incompleto, não só vazio. "numero" fica de fora de propósito, porque
// aceita "S/N", "120A" etc.
const MASCARAS: Partial<
  Record<keyof DadosEntrega, { formatar: (valor: string) => string; inputMode: "tel" | "numeric"; digitosMinimos: number }>
> = {
  telefone: { formatar: formatarTelefone, inputMode: "tel", digitosMinimos: 10 },
  cep: { formatar: formatarCep, inputMode: "numeric", digitosMinimos: 8 },
};

const ESTADOS = ["PE", "AL", "BA", "CE", "PB", "PI", "RN", "SE"];

const DADOS_VAZIOS: DadosEntrega = {
  nome: "",
  telefone: "",
  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
};

interface PedidoConfirmado {
  numero: string;
  total: number;
  quantidadeDePecas: number;
}

export default function Pagina() {
  const { itens, valorTotal, quantidadeTotal, limparCarrinho } = useCarrinho();
  const { criarPedido } = usePedidos();
  const [etapa, setEtapa] = useState(0);
  const [dados, setDados] = useState<DadosEntrega>(DADOS_VAZIOS);
  const [errosVisiveis, setErrosVisiveis] = useState(false);
  const [pedido, setPedido] = useState<PedidoConfirmado | null>(null);

  function preencher(campo: keyof DadosEntrega, valor: string) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
  }

  function campoInvalido(campo: keyof DadosEntrega): boolean {
    const valor = dados[campo].trim();
    if (valor === "") return true;
    const mascara = MASCARAS[campo];
    return mascara ? somenteDigitos(valor).length < mascara.digitosMinimos : false;
  }

  function camposFaltando(indiceDaEtapa: number): (keyof DadosEntrega)[] {
    const obrigatorios = CAMPOS_OBRIGATORIOS[indiceDaEtapa] ?? [];
    return obrigatorios.filter(campoInvalido);
  }

  function avancar() {
    if (camposFaltando(etapa).length > 0) {
      setErrosVisiveis(true);
      return;
    }
    setErrosVisiveis(false);
    setEtapa((atual) => atual + 1);
  }

  function voltar() {
    setErrosVisiveis(false);
    setEtapa((atual) => Math.max(0, atual - 1));
  }

  // Cada etapa é um <form>, então dar Enter em qualquer campo avança — é o reflexo de
  // quem preenche formulário, e esperar que só o clique funcione trava o usuário.
  function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (etapa < 2) avancar();
    else confirmarPedido();
  }

  // Compra simulada: nenhum pagamento é processado. Mas o pedido passa a existir no
  // histórico do comprador, senão o número mostrado aqui não levaria a lugar nenhum.
  // Guardamos um resumo antes de limpar o carrinho, que é a fonte dos itens.
  function confirmarPedido() {
    const novoPedido = criarPedido(ID_COMPRADOR_DEMO, itens);
    setPedido({
      numero: novoPedido.id,
      total: novoPedido.valorTotal,
      quantidadeDePecas: quantidadeTotal,
    });
    limparCarrinho();
    setEtapa(3);
  }

  function campoDeTexto(campo: keyof DadosEntrega, placeholder?: string) {
    const invalido = errosVisiveis && campoInvalido(campo);
    const mascara = MASCARAS[campo];
    return (
      <FormControl isInvalid={invalido} isRequired>
        <FormLabel fontSize="0.9rem">{ROTULOS[campo]}</FormLabel>
        <Input
          size="lg"
          bg="card"
          borderColor="border"
          placeholder={placeholder}
          value={dados[campo]}
          inputMode={mascara?.inputMode}
          onChange={(e) => preencher(campo, mascara ? aplicarMascara(e, mascara.formatar) : e.target.value)}
        />
        <FormErrorMessage>
          {mascara && dados[campo].trim() !== ""
            ? `${ROTULOS[campo]} incompleto.`
            : `Preencha ${ROTULOS[campo].toLowerCase()}.`}
        </FormErrorMessage>
      </FormControl>
    );
  }

  if (pedido) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="640px" mx="auto" px={{ base: 5, md: 10 }} py={20} textAlign="center">
          <Flex
            w="72px"
            h="72px"
            mx="auto"
            mb={6}
            borderRadius="full"
            bg="accent"
            color="accentFg"
            align="center"
            justify="center"
          >
            <FiCheck size={34} />
          </Flex>

          <Heading fontSize="1.9rem" mb={3}>
            Pedido enviado!
          </Heading>
          <Text color="mutedFg" mb={8} lineHeight={1.7}>
            Seu pedido <strong>{pedido.numero}</strong> foi registrado com {pedido.quantidadeDePecas}{" "}
            {pedido.quantidadeDePecas === 1 ? "peça" : "peças"}, no total de{" "}
            <strong>R$ {pedido.total.toFixed(2).replace(".", ",")}</strong>. O artesão vai falar com
            você pelo WhatsApp para combinar o pagamento e a entrega.
          </Text>

          <Box bg="muted" borderRadius="10px" p={4} mb={8}>
            <Text fontSize="0.85rem" color="mutedFg">
              Esta é uma compra simulada do MVP: nenhum pagamento foi cobrado.
            </Text>
          </Box>

          <HStack spacing={3} justify="center">
            <Button as={NextLink} href="/meus-pedidos" variant="solid" size="lg">
              Ver meus pedidos
            </Button>
            <Button as={NextLink} href="/" variant="outline" size="lg">
              Voltar à vitrine
            </Button>
          </HStack>
        </Box>
      </>
    );
  }

  if (itens.length === 0) {
    return (
      <>
        <BarraNavegacao />
        <Box maxW="640px" mx="auto" px={{ base: 5, md: 10 }} py={20} textAlign="center">
          <Heading fontSize="1.5rem" mb={3}>
            Seu carrinho está vazio
          </Heading>
          <Text color="mutedFg" mb={7}>
            Escolha alguma peça na vitrine para conseguir finalizar a compra.
          </Text>
          <Button as={NextLink} href="/" variant="solid">
            Ver artesanatos
          </Button>
        </Box>
      </>
    );
  }

  return (
    <>
      <BarraNavegacao />
      <Box maxW="820px" mx="auto" px={{ base: 5, md: 10 }} py={10}>
        <Heading fontSize="1.9rem" mb={8}>
          Finalizar compra
        </Heading>

        <Stepper index={etapa} size="sm" colorScheme="terracota" mb={10}>
          {ETAPAS.map((passo) => (
            <Step key={passo.titulo}>
              <StepIndicator>
                <StepStatus
                  complete={<StepIcon />}
                  incomplete={<StepNumber />}
                  active={<StepNumber />}
                />
              </StepIndicator>
              <Box flexShrink={0} display={{ base: "none", sm: "block" }}>
                <StepTitle>{passo.titulo}</StepTitle>
              </Box>
              <StepSeparator />
            </Step>
          ))}
        </Stepper>

        <Text fontFamily="heading" fontSize="1.2rem" mb={6}>
          {ETAPAS[etapa].instrucao}
        </Text>

        {/* noValidate: a validação por etapa é a nossa, com mensagens em FormErrorMessage.
            Sem isso o navegador bloqueia o submit antes e mostra o balão dele. */}
        <Box as="form" onSubmit={aoEnviar} noValidate>
          <Box bg="card" border="1px solid" borderColor="border" borderRadius="12px" p={{ base: 5, md: 7 }}>
            {etapa === 0 && (
              <VStack spacing={5} align="stretch">
                {campoDeTexto("nome", "Ex: Maria da Silva")}
                {campoDeTexto("telefone", "Ex: (81) 99999-0000")}
              </VStack>
            )}

            {etapa === 1 && (
              <VStack spacing={5} align="stretch">
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  {campoDeTexto("cep", "Ex: 50000-000")}
                  {campoDeTexto("bairro")}
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5}>
                  <Box gridColumn={{ sm: "span 2" }}>{campoDeTexto("rua")}</Box>
                  {campoDeTexto("numero")}
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  {campoDeTexto("cidade")}
                  <FormControl isInvalid={errosVisiveis && dados.uf === ""} isRequired>
                    <FormLabel fontSize="0.9rem">{ROTULOS.uf}</FormLabel>
                    <Select
                      size="lg"
                      bg="card"
                      borderColor="border"
                      placeholder="Escolha o estado"
                      value={dados.uf}
                      onChange={(e) => preencher("uf", e.target.value)}
                    >
                      {ESTADOS.map((sigla) => (
                        <option key={sigla} value={sigla}>
                          {sigla}
                        </option>
                      ))}
                    </Select>
                    <FormErrorMessage>Escolha o estado.</FormErrorMessage>
                  </FormControl>
                </SimpleGrid>
              </VStack>
            )}

            {etapa === 2 && (
              <VStack spacing={5} align="stretch">
                <Box>
                  <Text fontSize="0.85rem" color="mutedFg" mb={2}>
                    Entregar para
                  </Text>
                  <Text fontWeight={500}>{dados.nome}</Text>
                  <Text color="mutedFg" fontSize="0.9rem">
                    {dados.telefone}
                  </Text>
                  <Text color="mutedFg" fontSize="0.9rem">
                    {dados.rua}, {dados.numero} — {dados.bairro}, {dados.cidade}/{dados.uf}, CEP{" "}
                    {dados.cep}
                  </Text>
                </Box>

                <Divider borderColor="border" />

                <Box>
                  <Text fontSize="0.85rem" color="mutedFg" mb={3}>
                    Peças do pedido
                  </Text>
                  <VStack spacing={3} align="stretch">
                    {itens.map((item) => (
                      <Flex key={item.id} justify="space-between" gap={4}>
                        <Box>
                          <Text fontSize="0.95rem">{item.produto.nome}</Text>
                          <Text fontSize="0.8rem" color="mutedFg">
                            {item.quantidade} × R$ {item.produto.preco.toFixed(2).replace(".", ",")} ·
                            por {item.produto.artesaoNome}
                          </Text>
                        </Box>
                        <Text fontWeight={600} whiteSpace="nowrap">
                          R$ {(item.produto.preco * item.quantidade).toFixed(2).replace(".", ",")}
                        </Text>
                      </Flex>
                    ))}
                  </VStack>
                </Box>

                <Divider borderColor="border" />

                <Flex justify="space-between" align="baseline">
                  <Text color="mutedFg">Total</Text>
                  <Text fontSize="1.35rem" fontWeight={600}>
                    R$ {valorTotal.toFixed(2).replace(".", ",")}
                  </Text>
                </Flex>

                <Box bg="muted" borderRadius="10px" p={4}>
                  <Text fontSize="0.85rem" color="mutedFg">
                    Compra simulada: nada será cobrado agora. O artesão entra em contato pelo WhatsApp
                    para combinar pagamento e entrega.
                  </Text>
                </Box>
              </VStack>
            )}
          </Box>

          <HStack justify="space-between" mt={7}>
            {etapa === 0 ? (
              <Button as={NextLink} href="/" leftIcon={<FiArrowLeft />} variant="ghost" color="mutedFg">
                Voltar à vitrine
              </Button>
            ) : (
              // type="button" para o "Voltar" não disparar o submit do formulário
              <Button
                type="button"
                leftIcon={<FiArrowLeft />}
                variant="ghost"
                color="mutedFg"
                onClick={voltar}
              >
                Voltar
              </Button>
            )}

            <Button type="submit" variant="solid" size="lg">
              {etapa < 2 ? "Continuar" : "Confirmar pedido"}
            </Button>
          </HStack>
        </Box>
      </Box>
    </>
  );
}
