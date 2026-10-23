import type { DadosSessao } from "./dominio";

// Sessão anexada à requisição pelo middleware de sessão (null = visitante).
declare global {
  namespace Express {
    interface Request {
      sessao?: DadosSessao | null;
    }
  }
}

export {};
