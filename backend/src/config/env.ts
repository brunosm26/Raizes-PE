import "dotenv/config";

// Lê e valida as variáveis de ambiente uma única vez, na subida do servidor.
// O resto do código importa `env` daqui, em vez de ler process.env direto.

const PORTA_PADRAO = 4000;
const AMBIENTES = ["development", "production", "test"] as const;

export type Ambiente = (typeof AMBIENTES)[number];

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

export const env = Object.freeze({
  PORT: lerPorta(process.env.PORT),
  NODE_ENV: lerAmbiente(process.env.NODE_ENV),
});
