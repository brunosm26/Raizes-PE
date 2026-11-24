import { apiFetch } from "./apiUrl";
import type { TipoUsuario } from "./tipos";

export interface AtividadeAdmin {
  usuarios: { id: string; nome: string; tipo: TipoUsuario; ativo: boolean }[];
  produtos: { id: string; nome: string; artesaoNome: string; ativo: boolean }[];
}

export async function getAtividadeAdmin(): Promise<AtividadeAdmin> {
  const resposta = await apiFetch("/api/admin/atividade", { cache: "no-store" });
  if (!resposta.ok) throw new Error("Não foi possível consultar os cadastros.");
  return (await resposta.json()) as AtividadeAdmin;
}

export async function setAtividadeAdmin(tipo: keyof AtividadeAdmin, id: string, ativo: boolean): Promise<void> {
  const resposta = await apiFetch(`/api/admin/atividade/${tipo}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ativo }),
  });
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
    throw new Error(corpo?.erro ?? "Não foi possível atualizar o cadastro.");
  }
}
