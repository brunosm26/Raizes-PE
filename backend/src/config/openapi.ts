import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

// Especificação OpenAPI lida de backend/openapi.yaml na subida. O caminho vale tanto
// para src/config (npm run dev) quanto para dist/config (npm start).
export const especificacaoOpenApi = parse(
  readFileSync(join(__dirname, "..", "..", "openapi.yaml"), "utf8")
) as Record<string, unknown>;
