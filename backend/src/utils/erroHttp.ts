// Erro com status HTTP. Lance-o em qualquer camada (controller, service, repository)
// e o middleware de erros transforma em resposta JSON com o status certo.
export class ErroHttp extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ErroHttp";
  }
}
