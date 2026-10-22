// Camada de acesso a dados: só os repositories falam com o banco.
// Os services chamam os repositories; controllers e rotas nunca acessam o banco direto.
// Ainda vazia: a conexão com o banco entra com o seu próprio card.
export {};
