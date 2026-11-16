"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Flex, Heading, Select, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import DialogoConfirmacao from "@/components/DialogoConfirmacao";
import MensagemErro from "@/components/MensagemErro";
import { useProdutos } from "@/lib/contextoProdutos";
import {
  DIAS_EM_REVISAO,
  estaEmRevisao,
  estaOculto,
  lerModeracao,
  moderarProduto,
  motivoRevisao,
  reexibirOcultos,
  salvarModeracao,
  type AcaoModeracao,
  type Moderacao,
} from "@/lib/estadoAdmin";
import { useArtesaosAdmin } from "@/lib/useArtesaosAdmin";

const TODOS_OS_ARTESAOS = "";

// "2026-11-15" -> "15/11/2026"
function formatarData(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

export default function ModeracaoProdutosPage() {
  const { produtosDoArtesao } = useProdutos();
  const { artesaos, carregando: carregandoArtesaos, erro, tentarDeNovo } = useArtesaosAdmin();
  // null até ler o localStorage (só existe no navegador).
  const [moderacao, setModeracao] = useState<Moderacao | null>(null);
  const [filtroArtesao, setFiltroArtesao] = useState(TODOS_OS_ARTESAOS);
  const [produtoParaOcultar, setProdutoParaOcultar] = useState<{ id: string; nome: string } | null>(null);
  // Data de referência do critério "cadastrado nos últimos 7 dias", fixa enquanto a tela está aberta.
  const [hoje] = useState(() => new Date());

  useEffect(() => {
    try {
      setModeracao(lerModeracao(window.localStorage));
    } catch {
      setModeracao({});
    }
  }, []);

  function atualizarModeracao(mudar: (atual: Moderacao) => Moderacao) {
    setModeracao((atual) => {
      const nova = mudar(atual ?? {});
      try {
        salvarModeracao(window.localStorage, nova);
      } catch {
        // sem localStorage: vale só enquanto a tela está aberta
      }
      return nova;
    });
  }

  function mudarStatus(id: string, acao: AcaoModeracao) {
    atualizarModeracao((atual) => moderarProduto(atual, id, acao));
  }

  // Todos os produtos da plataforma, agrupados pelos artesãos do banco (GET /api/artesaos).
  const produtos = useMemo(
    () =>
      artesaos
        .filter((a) => filtroArtesao === TODOS_OS_ARTESAOS || a.id === filtroArtesao)
        .flatMap((a) => produtosDoArtesao(a.usuarioId)),
    [artesaos, filtroArtesao, produtosDoArtesao]
  );

  const carregando = moderacao === null || carregandoArtesaos;
  const visiveis = moderacao ? produtos.filter((p) => !estaOculto(p, moderacao)) : [];
  const ocultos = produtos.length - visiveis.length;
  const emRevisao = moderacao ? visiveis.filter((p) => estaEmRevisao(p, moderacao, hoje)).length : 0;

  return (
    <Box>
      <Heading fontSize="1.9rem" mb={3}>
        Moderação de Produtos
      </Heading>
      <Text color="mutedFg" fontSize="sm" mb={1}>
        <strong>Em revisão</strong>: produtos sem foto ou cadastrados nos últimos {DIAS_EM_REVISAO} dias (contando
        hoje), até o admin aprovar.
      </Text>
      <Text color="mutedFg" fontSize="sm" mb={4}>
        Moderação de demonstração: aprovar e ocultar ficam só neste navegador e não alteram o banco nem a vitrine.
      </Text>

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
        {!carregando && !erro && (
          <Text fontSize="sm" color="mutedFg" mb={1}>
            {visiveis.length} {visiveis.length === 1 ? "produto" : "produtos"}, {emRevisao} em revisão
            {ocultos > 0 && `, ${ocultos} ${ocultos === 1 ? "oculto" : "ocultos"}`}
          </Text>
        )}
        {!carregando && ocultos > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => atualizarModeracao((atual) => reexibirOcultos(atual, produtos.map((p) => p.id)))}
          >
            Mostrar os ocultos de novo
          </Button>
        )}
      </Flex>

      {erro ? (
        <MensagemErro mensagem="Não foi possível carregar os artesãos e os produtos." aoTentarNovamente={tentarDeNovo} />
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
              {!carregando &&
                moderacao &&
                visiveis.map((produto) => {
                  const revisao = estaEmRevisao(produto, moderacao, hoje);
                  const motivo = revisao ? motivoRevisao(produto, hoje) : null;

                  return (
                    <Tr key={produto.id}>
                      <Td fontWeight={500}>{produto.nome}</Td>
                      <Td>{produto.artesaoNome}</Td>
                      <Td>{produto.categoria}</Td>
                      <Td>{formatarData(produto.dataCadastro)}</Td>
                      <Td>
                        <Badge
                          bg={revisao ? "secondary" : "accent"}
                          color={revisao ? "secondaryFg" : "accentFg"}
                          borderRadius="full"
                          px={3}
                          textTransform="none"
                        >
                          {revisao ? "Em Revisão" : "Aprovado"}
                        </Badge>
                        {motivo && (
                          <Text fontSize="0.75rem" color="mutedFg" mt={1}>
                            {motivo === "sem-foto" ? "sem foto" : "cadastro recente"}
                          </Text>
                        )}
                      </Td>
                      <Td>
                        <Flex gap={2} wrap="wrap">
                          {revisao && (
                            <Button size="sm" variant="solid" onClick={() => mudarStatus(produto.id, "aprovado")}>
                              Aprovar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            color="red.600"
                            borderColor="red.200"
                            onClick={() => setProdutoParaOcultar({ id: produto.id, nome: produto.nome })}
                          >
                            Ocultar da lista do admin (demonstração)
                          </Button>
                        </Flex>
                      </Td>
                    </Tr>
                  );
                })}
            </Tbody>
          </Table>
        </Box>
      )}
      <DialogoConfirmacao
        aberto={produtoParaOcultar !== null}
        titulo="Ocultar da lista do admin?"
        mensagem={`"${produtoParaOcultar?.nome ?? ""}" deixa de aparecer nesta lista, só neste navegador. O produto continua no banco e na vitrine.`}
        rotuloConfirmar="Ocultar"
        aoCancelar={() => setProdutoParaOcultar(null)}
        aoConfirmar={() => {
          if (produtoParaOcultar) mudarStatus(produtoParaOcultar.id, "oculto");
          setProdutoParaOcultar(null);
        }}
      />
    </Box>
  );
}
