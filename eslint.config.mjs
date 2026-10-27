import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// O eslint-config-next 15 ainda é publicado no formato antigo (.eslintrc), então o
// FlatCompat faz a ponte para o flat config do ESLint 9. Quando o projeto subir para o
// Next 16, dá para importar "eslint-config-next/core-web-vitals" direto, sem esta ponte.
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "backend/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
