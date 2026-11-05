import "dotenv/config";

// Lê e valida as variáveis de ambiente uma única vez, na subida do servidor.
// O resto do código importa `env` daqui, em vez de ler process.env direto.

const PORTA_PADRAO = 4000;
const AMBIENTES = ["development", "production", "test"] as const;

export type Ambiente = (typeof AMBIENTES)[number];

const SAMESITES = ["lax", "strict", "none"] as const;
export type SameSite = (typeof SAMESITES)[number];

function lerPorta(valor: string | undefined): number {
  if (valor === undefined || valor.trim() === "") return PORTA_PADRAO;

  const porta = Number(valor);
  if (!/^\d+$/.test(valor.trim()) || porta < 1 || porta > 65535) {
    throw new Error(`PORT inválida: "${valor}". Use um número inteiro entre 1 e 65535.`);
  }
  return porta;
}

function lerAmbiente(valor: string | undefined): Ambiente {
  if (valor === undefined || valor.trim() === "") return "development";

  const ambiente = AMBIENTES.find((a) => a === valor.trim());
  if (!ambiente) {
    throw new Error(`NODE_ENV inválido: "${valor}". Use ${AMBIENTES.join(", ")}.`);
  }
  return ambiente;
}

function lerSameSite(valor: string | undefined): SameSite {
  if (valor === undefined || valor.trim() === "") return "lax";

  const sameSite = SAMESITES.find((v) => v === valor.trim().toLowerCase());
  if (!sameSite) {
    throw new Error(`COOKIE_SAMESITE inválido: "${valor}". Use ${SAMESITES.join(", ")}.`);
  }
  return sameSite;
}

// Origens do front liberadas por CORS: lista separada por vírgula, sem "/" no fim.
// Vazia = sem CORS (o front fala com a API pela mesma origem, via proxy do Next).
function lerOrigens(valor: string | undefined): readonly string[] {
  if (valor === undefined) return [];
  return valor
    .split(",")
    .map((origem) => origem.trim().replace(/\/+$/, ""))
    .filter((origem) => origem !== "");
}

// Opcionais: ausentes durante `npm install`, `prisma generate` e `npm run build`.
// Quem precisa do banco ou da sessão confere na hora de usar (veja config/prisma.ts).
function lerOpcional(valor: string | undefined): string | undefined {
  return valor === undefined || valor.trim() === "" ? undefined : valor.trim();
}

export const env = Object.freeze({
  PORT: lerPorta(process.env.PORT),
  NODE_ENV: lerAmbiente(process.env.NODE_ENV),
  // Connection string pooled do Neon, usada pelo app em runtime.
  DATABASE_URL: lerOpcional(process.env.DATABASE_URL),
  // Connection string direta do Neon, usada só pela CLI do Prisma (prisma.config.ts).
  DIRECT_URL: lerOpcional(process.env.DIRECT_URL),
  SESSION_SECRET: lerOpcional(process.env.SESSION_SECRET),
  // Origens do front aceitas por CORS (com cookies). Ex.: http://localhost:3000
  CORS_ORIGIN: lerOrigens(process.env.CORS_ORIGIN),
  // SameSite do cookie de sessão. "none" (só com HTTPS) é para front e API em domínios diferentes.
  COOKIE_SAMESITE: lerSameSite(process.env.COOKIE_SAMESITE),
});
