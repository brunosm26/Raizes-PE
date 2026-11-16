"use client";

import { useEffect, useState } from "react";
import { Badge, Box, Button, Flex, Heading, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import NextLink from "next/link";
import MensagemErro from "@/components/MensagemErro";
import {
  aprovarArtesao,
  lerAprovacoes,
  salvarAprovacoes,
  statusArtesao,
  type Aprovacoes,
  type StatusArtesao,
} from "@/lib/estadoAdmin";
import { useArtesaosAdmin } from "@/lib/useArtesaosAdmin";

const ROTULO_STATUS: Record<StatusArtesao, string> = {
  "com-login": "Aprovado (tem login)",
  "aprovado-navegador": "Aprovado neste navegador",
  pendente: "Pendente (sem login)",
};

const COR_STATUS: Record<StatusArtesao, { bg: string; color: string }> = {
  "com-login": { bg: "accent", color: "accentFg" },
  "aprovado-navegador": { bg: "muted", color: "fg" },
  pendente: { bg: "secondary", color: "secondaryFg" },
};

export default function GestaoArtesaosPage() {
  const { artesaos, carregando, erro, tentarDeNovo } = useArtesaosAdmin();
  // null até ler o localStorage (só existe no navegador).
  const [aprovacoes, setAprovacoes] = useState<Aprovacoes | null>(null);

  useEffect(() => {
    try {
      setAprovacoes(lerAprovacoes(window.localStorage));
    } catch {
      setAprovacoes({});
    }
  }, []);

  function aprovar(artesaoId: string) {
    setAprovacoes((atuais) => {
      const novas = aprovarArtesao(atuais ?? {}, artesaoId);
      try {
        salvarAprovacoes(window.localStorage, novas);
      } catch {
        // sem localStorage: vale só enquanto a tela está aberta
      }
      return novas;
    });
  }

  const pronto = !carregando && aprovacoes !== null;
  const pendentes = pronto ? artesaos.filter((artesao) => statusArtesao(artesao, aprovacoes) === "pendente").length : 0;

  return (
    <Box>
      <Heading fontSize="1.9rem" mb={3}>
        Gestão de Artesãos
      </Heading>
      <Text color="mutedFg" fontSize="sm" mb={1}>
        Lista do banco. <strong>Pendente</strong> é o artesão que ainda não tem login (sem senha cadastrada).
      </Text>
      <Text color="mutedFg" fontSize="sm" mb={4}>
        Aprovação de demonstração: fica só neste navegador e não altera o banco.
        {pronto && !erro && ` ${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}.`}
      </Text>

      {erro ? (
        <MensagemErro mensagem="Não foi possível carregar os artesãos." aoTentarNovamente={tentarDeNovo} />
      ) : (
        <Box bg="card" border="1px solid" borderColor="border" borderRadius="10px" overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Artesão</Th>
                <Th>Região</Th>
                <Th>Técnicas</Th>
                <Th isNumeric>Produtos</Th>
                <Th>Login</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {!pronto && (
                <Tr>
                  <Td colSpan={7}>Carregando artesãos...</Td>
                </Tr>
              )}
              {pronto && artesaos.length === 0 && (
                <Tr>
                  <Td colSpan={7}>Nenhum artesão cadastrado.</Td>
                </Tr>
              )}
              {pronto &&
                artesaos.map((artesao) => {
                  const status = statusArtesao(artesao, aprovacoes);
                  return (
                    <Tr key={artesao.id}>
                      <Td fontWeight={500}>{artesao.nome}</Td>
                      <Td>{artesao.regiaoOrigem || "—"}</Td>
                      <Td>
                        {artesao.tecnicas.length === 0 ? (
                          <Text as="span" color="mutedFg" fontSize="sm">
                            Sem produtos
                          </Text>
                        ) : (
                          <Flex wrap="wrap" gap={1}>
                            {artesao.tecnicas.map((tecnica) => (
                              <Badge key={tecnica} bg="muted" color="mutedFg" textTransform="none">
                                {tecnica}
                              </Badge>
                            ))}
                          </Flex>
                        )}
                      </Td>
                      <Td isNumeric>{artesao.totalProdutos}</Td>
                      <Td>{artesao.temLogin ? "Sim" : "Não"}</Td>
                      <Td>
                        <Badge
                          bg={COR_STATUS[status].bg}
                          color={COR_STATUS[status].color}
                          borderRadius="full"
                          px={3}
                          textTransform="none"
                        >
                          {ROTULO_STATUS[status]}
                        </Badge>
                      </Td>
                      <Td>
                        <Flex gap={2}>
                          <Button as={NextLink} href={`/artesao/${artesao.id}`} size="sm" variant="outline">
                            Ver Perfil
                          </Button>
                          {status === "pendente" && (
                            <Button size="sm" variant="solid" onClick={() => aprovar(artesao.id)}>
                              Aprovar
                            </Button>
                          )}
                        </Flex>
                      </Td>
                    </Tr>
                  );
                })}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
