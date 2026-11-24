"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Avatar, Button, FormControl, FormLabel, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Stack, Text, Textarea, useToast,
} from "@chakra-ui/react";
import { apiFetch } from "@/lib/apiUrl";
import type { DadosPublicosArtesao } from "@/lib/tipos";

const ROTA_PERFIL = "/api/artesaos/me";

export default function ModalEditarPerfilArtesao({ aoFechar }: { aoFechar: () => void }) {
  const [perfil, setPerfil] = useState<DadosPublicosArtesao | null>(null);
  const [fotoAlterada, setFotoAlterada] = useState(false);
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const toast = useToast();

  useEffect(() => {
    const controle = new AbortController();
    apiFetch(ROTA_PERFIL, { cache: "no-store", signal: controle.signal })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error();
        setPerfil(await resposta.json());
      })
      .catch(() => {
        if (!controle.signal.aborted) setErro("Não foi possível carregar o perfil.");
      });
    return () => controle.abort();
  }, []);

  function escolherFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type) || arquivo.size > 2 * 1024 * 1024) {
      setErro("Use uma foto JPG, PNG ou WEBP de até 2 MB.");
      return;
    }
    setErro("");
    setCarregandoFoto(true);
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === "string") {
        const fotoUrl = leitor.result;
        setPerfil((atual) => atual && { ...atual, fotoUrl });
        setFotoAlterada(true);
      }
    };
    leitor.onerror = () => setErro("Não foi possível ler a foto.");
    leitor.onloadend = () => setCarregandoFoto(false);
    leitor.readAsDataURL(arquivo);
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!perfil || salvando || carregandoFoto) return;
    setErro("");
    setSalvando(true);
    try {
      const resposta = await apiFetch(ROTA_PERFIL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biografia: perfil.biografia,
          regiaoOrigem: perfil.regiaoOrigem,
          ...(fotoAlterada && { fotoUrl: perfil.fotoUrl }),
        }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new Error(corpo?.erro ?? "Não foi possível salvar o perfil.");
      }
      toast({ title: "Perfil atualizado", status: "success", isClosable: true });
      aoFechar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar o perfil.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal isOpen onClose={aoFechar} closeOnOverlayClick={!salvando} closeOnEsc={!salvando}>
      <ModalOverlay />
      <ModalContent as="form" onSubmit={salvar}>
        <ModalHeader>Editar perfil</ModalHeader>
        <ModalCloseButton isDisabled={salvando} />
        <ModalBody>
          {perfil ? (
            <Stack spacing={4}>
              <FormControl isDisabled={salvando || carregandoFoto}>
                <FormLabel>Foto do perfil</FormLabel>
                <Stack align="start">
                  <Avatar name={perfil.nome} src={perfil.fotoUrl ?? undefined} size="lg" />
                  <Input type="file" accept="image/jpeg,image/png,image/webp" pt={1} onChange={escolherFoto} />
                  {perfil.fotoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPerfil({ ...perfil, fotoUrl: null });
                        setFotoAlterada(true);
                        setErro("");
                      }}
                    >
                      Remover foto
                    </Button>
                  )}
                </Stack>
              </FormControl>
              <FormControl isDisabled={salvando}>
                <FormLabel>Localidade</FormLabel>
                <Input
                  value={perfil.regiaoOrigem}
                  maxLength={100}
                  onChange={(evento) => setPerfil({ ...perfil, regiaoOrigem: evento.target.value })}
                />
              </FormControl>
              <FormControl isDisabled={salvando}>
                <FormLabel>Biografia</FormLabel>
                <Textarea
                  value={perfil.biografia}
                  maxLength={3000}
                  rows={5}
                  onChange={(evento) => setPerfil({ ...perfil, biografia: evento.target.value })}
                />
              </FormControl>
            </Stack>
          ) : !erro && <Text role="status">Carregando perfil…</Text>}
          {erro && <Text role="alert" color="red.500" mt={3}>{erro}</Text>}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="outline" onClick={aoFechar} isDisabled={salvando}>Cancelar</Button>
          <Button type="submit" variant="solid" isLoading={salvando} isDisabled={!perfil || carregandoFoto}>
            Salvar alterações
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
