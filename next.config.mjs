// Com API_URL definida (ex.: http://localhost:4000), todo /api/* do front é repassado ao
// backend Express. O navegador continua falando só com o domínio do Next, então o cookie
// de sessão fica first-party (SameSite=Lax) e não precisa de CORS.
// Sem API_URL, as rotas app/api do próprio Next continuam respondendo (fallback).
const urlApi = process.env.API_URL?.trim().replace(/\/+$/, "");

if (urlApi && !/^https?:\/\//.test(urlApi)) {
  throw new Error(`API_URL inválida: "${urlApi}". Use a URL completa, ex.: http://localhost:4000`);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@chakra-ui/react", "@emotion/react", "@emotion/styled", "framer-motion"],

  async rewrites() {
    if (!urlApi) return [];
    // beforeFiles: o proxy tem prioridade sobre as rotas app/api, que têm os mesmos caminhos.
    return {
      beforeFiles: [{ source: "/api/:caminho*", destination: `${urlApi}/api/:caminho*` }],
    };
  },
};

export default nextConfig;
