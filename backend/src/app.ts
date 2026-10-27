import express from "express";
import { naoEncontrado, tratadorDeErros } from "./middlewares/erros";
import { rotas } from "./routes";

// Monta o app Express sem subir o servidor (o listen fica no server.ts),
// para que testes possam importar o app direto.
export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.use("/api", rotas);

app.use(naoEncontrado);
app.use(tratadorDeErros);
