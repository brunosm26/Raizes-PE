"use client";

import { FormEvent, useState } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Alert,
  AlertIcon,
  Code,
  useToast,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/contextoSessao";
import type { TipoUsuario } from "@/lib/tipos";

// Contas de demonstração, gravadas no banco pelo script db/07_autenticacao.sql (senha demo123).
// Ficam à mostra para o professor conseguir testar cada perfil.
const CREDENCIAL_COMPRADOR = { email: "ana.beatriz@raizespe.dev", senha: "demo123" };
const CREDENCIAL_ARTESAO = { email: "tacaratu@raizespe.dev", senha: "demo123" };
const CREDENCIAL_ADMIN = { email: "admin@raizespe.dev", senha: "demo123" };

// Só aceita caminhos do próprio site como destino pós-login (evita redirecionar para fora).
function destinoSeguro(proxima: string | null, padrao: string): string {
  if (proxima && proxima.startsWith("/") && !proxima.startsWith("//") && !proxima.includes("\\")) {
    return proxima;
  }
  return padrao;
}

// Um form de login por aba (Comprador/Artesão/Admin): mesmos campos e erro, muda o perfil
// esperado, o texto do botão e a página padrão de destino. Quem confere e-mail, senha e
// perfil é o servidor (/api/auth/login).
function FormularioLogin({
  rotuloEmail,
  textoBotao,
  perfil,
  destino,
}: {
  rotuloEmail: string;
  textoBotao: string;
  perfil: TipoUsuario;
  destino: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { entrar } = useSessao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email, senha, perfil);
      toast({ title: "Login realizado", status: "success", duration: 2000, isClosable: true, position: "top" });
      const proxima = new URLSearchParams(window.location.search).get("proxima");
      router.push(destinoSeguro(proxima, destino));
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <VStack spacing={4}>
        {erro && (
          <Alert status="error" borderRadius="8px" fontSize="0.86rem">
            <AlertIcon />
            {erro}
          </Alert>
        )}
        <FormControl>
          <FormLabel>{rotuloEmail}</FormLabel>
          <Input
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormControl>
        <FormControl>
          <FormLabel>Senha</FormLabel>
          <Input
            type="password"
            placeholder="********"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </FormControl>
        <Button type="submit" variant="solid" w="full" isLoading={enviando} loadingText="Entrando...">
          {textoBotao}
        </Button>
      </VStack>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Container maxW="md" py={20}>
      <Box bg="card" p={8} rounded="lg" shadow="md" borderWidth="1px" borderColor="border">
        <Heading fontFamily="heading" color="fg" mb={2} textAlign="center">
          Acesse sua conta
        </Heading>
        <Text textAlign="center" color="mutedFg" mb={6}>
          Entre com o perfil da sua conta
        </Text>

        <Box bg="muted" border="1px solid" borderColor="border" borderRadius="8px" p={3} mb={6} fontSize="0.82rem">
          <Text fontWeight={600} mb={1}>
            Contas de demonstração
          </Text>
          <Text color="mutedFg">
            Comprador: <Code fontSize="0.8em">{CREDENCIAL_COMPRADOR.email}</Code> /{" "}
            <Code fontSize="0.8em">{CREDENCIAL_COMPRADOR.senha}</Code>
          </Text>
          <Text color="mutedFg">
            Artesão: <Code fontSize="0.8em">{CREDENCIAL_ARTESAO.email}</Code> /{" "}
            <Code fontSize="0.8em">{CREDENCIAL_ARTESAO.senha}</Code>
          </Text>
          <Text color="mutedFg">
            Admin: <Code fontSize="0.8em">{CREDENCIAL_ADMIN.email}</Code> /{" "}
            <Code fontSize="0.8em">{CREDENCIAL_ADMIN.senha}</Code>
          </Text>
        </Box>

        <Tabs isFitted variant="enclosed" colorScheme="terracota">
          <TabList mb="1em">
            <Tab>Comprador</Tab>
            <Tab>Artesão</Tab>
            <Tab>Admin</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <FormularioLogin
                rotuloEmail="E-mail"
                textoBotao="Entrar"
                perfil="comprador"
                destino="/"
              />
            </TabPanel>
            <TabPanel>
              <FormularioLogin
                rotuloEmail="E-mail (Artesão)"
                textoBotao="Entrar no Painel do Artesão"
                perfil="artesao"
                // Painel do artesão já existe em /painel — não em /painel-artesao.
                destino="/painel"
              />
            </TabPanel>
            <TabPanel>
              <FormularioLogin
                rotuloEmail="E-mail (Admin)"
                textoBotao="Entrar na Administração"
                perfil="admin"
                destino="/admin"
              />
            </TabPanel>
          </TabPanels>
        </Tabs>

        <Text textAlign="center" mt={4} fontSize="sm" color="mutedFg">
          Ainda não tem conta?{" "}
          <Text
            as={NextLink}
            href="/cadastro"
            color="primary"
            fontWeight={500}
            _hover={{ textDecoration: "underline" }}
          >
            Cadastre-se
          </Text>
        </Text>
      </Box>
    </Container>
  );
}
