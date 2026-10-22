import express from "express";
import { naoEncontrado, tratadorDeErros } from "./middlewares/erros";
import { rotas } from "./routes";

// Monta o app Express sem subir o servidor (o listen fica no server.ts),
// para que testes possam importar o app direto.
export const app = express();

app.disable("x-powered-by");
// Limite de 4 MB: o cadastro de produto aceita foto como data URL de até ~2,8 MB.
app.use(express.json({ limit: "4mb" }));

app.use("/api", rotas);

app.use(naoEncontrado);
app.use(tratadorDeErros);
