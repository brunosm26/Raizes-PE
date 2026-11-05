import express from "express";
import swaggerUi from "swagger-ui-express";
import { especificacaoOpenApi } from "./config/openapi";
import { cors } from "./middlewares/cors";
import { naoEncontrado, tratadorDeErros } from "./middlewares/erros";
import { rotas } from "./routes";

// Monta o app Express sem subir o servidor (o listen fica no server.ts),
// para que testes possam importar o app direto.
export const app = express();

app.disable("x-powered-by");
// CORS com cookies para o front em outra origem (só liga com CORS_ORIGIN definida).
app.use(cors());
// Limite de 4 MB: o cadastro de produto aceita foto como data URL de até ~2,8 MB.
app.use(express.json({ limit: "4mb" }));

app.use("/api", rotas);

// Documentação da API: Swagger UI em /api-docs e a especificação crua em /api-docs.json.
app.get("/api-docs.json", (_req, res) => {
  res.json(especificacaoOpenApi);
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(especificacaoOpenApi, {
    customSiteTitle: "API Raízes PE",
    // Envia o cookie de sessão nas chamadas do "Try it out" (login primeiro, depois as rotas protegidas).
    swaggerOptions: { withCredentials: true, persistAuthorization: true },
  })
);

app.use(naoEncontrado);
app.use(tratadorDeErros);
