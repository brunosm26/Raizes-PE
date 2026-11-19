import { Router } from "express";
import * as notificacaoController from "../controllers/notificacaoController";
import { exigirSessao } from "../middlewares/sessao";

export const notificacaoRoutes = Router();

// Qualquer perfil logado; cada um vê e marca só as próprias
notificacaoRoutes.get("/", exigirSessao(), notificacaoController.listar);
notificacaoRoutes.post("/ler", exigirSessao(), notificacaoController.marcarComoLidas);
