// Ponto único de saída das chamadas do front para a API (PI4-132).
//
// NEXT_PUBLIC_API_URL define para onde o navegador chama:
//   - vazia (padrão): mesma origem, caminhos relativos "/api/...". Com API_URL definida,
//     o next.config.mjs repassa "/api/*" ao Express (proxy por rewrites). O cookie de sessão
//     fica na origem do site, então o middleware.ts do Next enxerga o mesmo JWT.
//   - URL do Express (ex.: http://localhost:4000): o navegador chama a API direto (outra
//     origem). Exige CORS_ORIGIN no backend e, entre domínios diferentes,
//     COOKIE_SAMESITE=none (cookie Secure). Atenção: nesse modo o cookie pertence ao domínio
//     da API e o middleware.ts não o recebe nas páginas protegidas (veja docs/arquitetura-backend.md).
// A variável é lida na hora do build (prefixo NEXT_PUBLIC_): mudou, rode o build de novo.
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

// "/api/produtos" → "/api/produtos" (mesma origem) ou "http://localhost:4000/api/produtos".
export function apiUrl(caminho: string): string {
  return `${BASE}${caminho}`;
}

// fetch para a API enviando o cookie de sessão também quando a API está em outra origem.
export function apiFetch(caminho: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(caminho), { credentials: "include", ...init });
}
