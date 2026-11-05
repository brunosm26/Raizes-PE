// Lint da API (PI4-133): regras recomendadas do ESLint e do typescript-eslint, sem regras
// de formatação. Cobre src/, test/, scripts/ e prisma.config.ts; o client do Prisma
// (src/generated) é gerado e fica de fora.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "node_modules/", "src/generated/"] },
  {
    files: ["src/**/*.ts", "test/**/*.ts", "scripts/**/*.ts", "prisma.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  }
);
