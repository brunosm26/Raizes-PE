"use client";

import { useState, type FormEvent } from "react";
import { Button, HStack, Select, Text } from "@chakra-ui/react";
import { apiFetch } from "@/lib/apiUrl";

export default function FormularioAvaliacao({
  produtoId,
  produtoNome,
  aoAvaliar,
}: {
  produtoId: string;
  produtoNome: string;
  aoAvaliar: (produtoId: string) => void;
}) {
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nota || enviando) return;
    setErro("");
    setEnviando(true);
    try {
      const resposta = await apiFetch(`/api/produtos/${encodeURIComponent(produtoId)}/avaliacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: Number(nota) }),
      });
      if (resposta.ok || resposta.status === 409) {
        aoAvaliar(produtoId);
        return;
      }
      const corpo = await resposta.json().catch(() => null);
      setErro(corpo?.erro || "Não foi possível registrar a avaliação.");
    } catch {
      setErro("Não foi possível registrar a avaliação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <HStack spacing={2} wrap="wrap">
        <Select
          aria-label={`Nota para ${produtoNome}`}
          placeholder="Selecione uma nota"
          value={nota}
          onChange={(evento) => setNota(evento.target.value)}
          size="sm"
          w="auto"
          isDisabled={enviando}
        >
          {[1, 2, 3, 4, 5].map((valor) => (
            <option key={valor} value={valor}>{valor} de 5</option>
          ))}
        </Select>
        <Button type="submit" size="sm" isDisabled={!nota} isLoading={enviando} variant="outline">
          Avaliar produto
        </Button>
      </HStack>
      {erro && <Text role="alert" color="red.600" fontSize="sm" mt={1}>{erro}</Text>}
    </form>
  );
}
