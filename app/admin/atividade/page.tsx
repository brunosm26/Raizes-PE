"use client";

import { Badge, Box, Button, Heading, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getAtividadeAdmin, setAtividadeAdmin, type AtividadeAdmin } from "@/lib/apiAtividadeAdmin";
import DialogoConfirmacao from "@/components/DialogoConfirmacao";

type Tipo = keyof AtividadeAdmin;
type Selecao = { tipo: Tipo; id: string; nome: string; ativo: boolean };
type Linha = { id: string; nome: string; detalhe: string; ativo: boolean; alteravel: boolean };

const ROTULO_PERFIL = { admin: "Administrador", comprador: "Comprador", artesao: "Artesão" };

function TabelaAtividade({
  titulo, detalhe, linhas, salvando, aoSelecionar,
}: {
  titulo: string;
  detalhe: string;
  linhas: Linha[];
  salvando: boolean;
  aoSelecionar: (linha: Linha) => void;
}) {
  return (
    <Box mt={8} overflowX="auto">
      <Heading as="h2" size="md" mb={3}>{titulo}</Heading>
      {linhas.length === 0 ? <Text>Nenhum cadastro encontrado.</Text> : (
        <Table size="sm">
          <Thead><Tr><Th>Nome</Th><Th>{detalhe}</Th><Th>Atividade</Th><Th>Ações</Th></Tr></Thead>
          <Tbody>
            {linhas.map((linha) => (
              <Tr key={linha.id}>
                <Td>{linha.nome}</Td>
                <Td>{linha.detalhe}</Td>
                <Td><Badge colorScheme={linha.ativo ? "green" : "gray"}>{linha.ativo ? "Ativo" : "Inativo"}</Badge></Td>
                <Td>
                  {linha.alteravel && (
                    <Button
                      size="sm"
                      variant="outline"
                      isDisabled={salvando}
                      aria-label={`${linha.ativo ? "Inativar" : "Reativar"} ${linha.nome}`}
                      onClick={() => aoSelecionar(linha)}
                    >
                      {linha.ativo ? "Inativar" : "Reativar"}
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
}

export default function AtividadePage() {
  const [dados, setDados] = useState<AtividadeAdmin | null>(null);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let atual = true;
    getAtividadeAdmin()
      .then((cadastros) => { if (atual) setDados(cadastros); })
      .catch((falha: Error) => { if (atual) setErro(falha.message); });
    return () => { atual = false; };
  }, [tentativa]);

  async function confirmar() {
    if (!selecao || salvando) return;
    const { tipo, id, ativo } = selecao;
    setSelecao(null);
    setSalvando(true);
    setErro("");
    try {
      await setAtividadeAdmin(tipo, id, !ativo);
      setDados((atuais) => atuais && {
        ...atuais,
        [tipo]: atuais[tipo].map((cadastro) => cadastro.id === id ? { ...cadastro, ativo: !ativo } : cadastro),
      });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível atualizar o cadastro.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Box maxW="1180px" mx="auto" px={{ base: 5, lg: 6 }} py={8}>
      <Heading as="h2" size="lg">Atividade de cadastros</Heading>
      {erro && <Text role="alert" mt={4}>{erro}</Text>}
      {!dados && (erro ? (
        <Button mt={4} onClick={() => { setErro(""); setTentativa((n) => n + 1); }}>Tentar novamente</Button>
      ) : <Spinner mt={4} aria-label="Carregando cadastros" />)}
      {dados && (
        <>
          <TabelaAtividade
            titulo="Usuários"
            detalhe="Perfil"
            linhas={dados.usuarios.map((u) => ({ ...u, detalhe: ROTULO_PERFIL[u.tipo], alteravel: u.tipo !== "admin" }))}
            salvando={salvando}
            aoSelecionar={(linha) => setSelecao({ ...linha, tipo: "usuarios" })}
          />
          <TabelaAtividade
            titulo="Produtos"
            detalhe="Artesão"
            linhas={dados.produtos.map((p) => ({ ...p, detalhe: p.artesaoNome, alteravel: true }))}
            salvando={salvando}
            aoSelecionar={(linha) => setSelecao({ ...linha, tipo: "produtos" })}
          />
        </>
      )}
      {selecao && (
        <DialogoConfirmacao
          aberto
          titulo={selecao.ativo ? "Inativar cadastro" : "Reativar cadastro"}
          mensagem={`Deseja ${selecao.ativo ? "inativar" : "reativar"} ${selecao.nome}?`}
          rotuloConfirmar={selecao.ativo ? "Inativar" : "Reativar"}
          aoCancelar={() => setSelecao(null)}
          aoConfirmar={confirmar}
        />
      )}
    </Box>
  );
}
