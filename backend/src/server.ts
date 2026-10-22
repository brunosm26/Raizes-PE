import { app } from "./app";
import { env } from "./config/env";

const servidor = app.listen(env.PORT, (erro?: Error) => {
  if (erro) {
    console.error(`Não foi possível subir o servidor na porta ${env.PORT}:`, erro.message);
    process.exit(1);
  }
  console.log(`API Raízes PE em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Encerra com calma ao receber Ctrl+C ou o sinal de parada do host.
for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    servidor.close(() => process.exit(0));
  });
}
