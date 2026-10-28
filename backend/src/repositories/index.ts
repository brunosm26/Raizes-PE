// Camada de acesso a dados: só os repositories falam com o banco, pelo client de
// config/prisma.ts. Os services chamam os repositories; controllers e rotas nunca
// acessam o banco direto. Consultas pesadas (agregações, ranking, recomendação e a
// view de popularidade) usam $queryRaw aqui, com o tipo do resultado declarado.
export * from "./popularidadeRepository";
