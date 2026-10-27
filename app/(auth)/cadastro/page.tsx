"use client";

import { FormEvent, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  useToast,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/contextoSessao";

export default function CadastroPage() {
  const router = useRouter();
  const toast = useToast();
  const { cadastrar } = useSessao();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Cria uma conta de COMPRADOR no banco e já entra com ela.
  async function handleCadastro(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await cadastrar(nome, email, senha);
      toast({ title: "Conta criada!", status: "success", duration: 3000, isClosable: true, position: "top" });
      router.push("/");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a conta. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Container maxW="md" py={20}>
      <Box bg="card" p={8} rounded="lg" shadow="md" borderWidth="1px" borderColor="border">
        <Heading fontFamily="heading" color="fg" mb={2} textAlign="center">
          Criar nova conta
        </Heading>
        <Text textAlign="center" color="mutedFg" mb={6}>
          Junte-se à nossa rede de Economia Criativa
        </Text>

        <VStack spacing={4} as="form" onSubmit={handleCadastro}>
          {erro && (
            <Alert status="error" borderRadius="8px" fontSize="0.86rem">
              <AlertIcon />
              {erro}
            </Alert>
          )}

          <FormControl isRequired>
            <FormLabel>Nome Completo</FormLabel>
            <Input type="text" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>E-mail</FormLabel>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Senha</FormLabel>
            <Input
              type="password"
              placeholder="********"
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <FormHelperText>Mínimo de 8 caracteres.</FormHelperText>
          </FormControl>

          <Button type="submit" variant="solid" w="full" mt={4} isLoading={enviando} loadingText="Criando...">
            Criar conta
          </Button>
        </VStack>

        <Text textAlign="center" mt={4} fontSize="sm" color="mutedFg">
          Já possui conta?{" "}
          <Text
            as={NextLink}
            href="/login"
            color="primary"
            fontWeight={500}
            _hover={{ textDecoration: "underline" }}
          >
            Faça Login
          </Text>
        </Text>
      </Box>

    </Container>
  );
}
