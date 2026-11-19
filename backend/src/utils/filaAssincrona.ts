// Fila de jobs em memória com worker não-bloqueante, sem dependência externa (nada de Redis ou
// BullMQ) e sem tabela no banco. Vale por processo: reiniciar a API apaga jobs e histórico.
// Quem enfileira recebe o job na hora (status "pendente"); o worker só começa no próximo giro do
// event loop (setImmediate), depois de a resposta HTTP já ter sido escrita. Falha volta para a
// fila com espera crescente até esgotar as tentativas, e aí o job fica em "erro".

export type StatusJob = "pendente" | "processando" | "concluido" | "erro";

export const STATUS_JOB: readonly StatusJob[] = ["pendente", "processando", "concluido", "erro"];

// O que sai para fora da fila (rota do admin, testes). O payload e os envolvidos ficam de fora:
// carregam dados do pedido e de quem comprou.
export interface JobPublico {
  id: string;
  tipo: string;
  referencia: string | null;
  status: StatusJob;
  tentativas: number;
  maxTentativas: number;
  criadoEm: string;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  ultimoErro: string | null;
}

export type ContagemPorStatus = Record<StatusJob, number>;

export interface ResumoFila {
  contagem: ContagemPorStatus;
  jobsRecentes: JobPublico[];
}

export type Processador<P> = (payload: P, job: JobPublico) => Promise<void>;

export interface OpcoesEnfileirar {
  /** Id do recurso que originou o job (ex.: o pedido), para achar o job no histórico. */
  referencia?: string;
  /** Usuários afetados pelo job; permite listar o histórico de um usuário. */
  envolvidos?: readonly string[];
}

export interface OpcoesFilaAssincrona {
  maxTentativas?: number;
  /** Espera antes da 2ª tentativa; dobra a cada nova falha. */
  atrasoBaseMs?: number;
  /** Quantos jobs terminados (concluido/erro) ficam no histórico. */
  maxHistorico?: number;
  agora?: () => number;
  gerarId?: () => string;
  /** Chamado quando um job esgota as tentativas. Padrão: console.error. */
  aoFalhar?: (job: JobPublico, erro: unknown) => void;
}

interface JobInterno extends JobPublico {
  payload: unknown;
  envolvidos: readonly string[];
}

const MAX_TENTATIVAS_PADRAO = 3;
const ATRASO_BASE_PADRAO_MS = 200;
const MAX_HISTORICO_PADRAO = 200;

function idAleatorio(): string {
  return globalThis.crypto.randomUUID();
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

export class FilaAssincrona {
  private readonly maxTentativas: number;
  private readonly atrasoBaseMs: number;
  private readonly maxHistorico: number;
  private readonly agora: () => number;
  private readonly gerarId: () => string;
  private readonly aoFalhar: (job: JobPublico, erro: unknown) => void;

  private readonly processadores = new Map<string, Processador<unknown>>();
  // Todos os jobs ainda vivos no histórico, na ordem em que foram criados.
  private readonly jobs = new Map<string, JobInterno>();
  private readonly prontos: JobInterno[] = [];
  private readonly esperas = new Set<ReturnType<typeof setTimeout>>();
  private cicloAgendado = false;
  private emExecucao = false;
  private aguardandoOcioso: (() => void)[] = [];

  constructor({
    maxTentativas = MAX_TENTATIVAS_PADRAO,
    atrasoBaseMs = ATRASO_BASE_PADRAO_MS,
    maxHistorico = MAX_HISTORICO_PADRAO,
    agora = () => Date.now(),
    gerarId = idAleatorio,
    aoFalhar = (job, erro) => console.error(`[fila] job ${job.tipo} ${job.id} falhou de vez:`, erro),
  }: OpcoesFilaAssincrona = {}) {
    if (!Number.isInteger(maxTentativas) || maxTentativas < 1) throw new Error(`maxTentativas inválido: ${maxTentativas}`);
    if (!Number.isFinite(atrasoBaseMs) || atrasoBaseMs < 0) throw new Error(`atrasoBaseMs inválido: ${atrasoBaseMs}`);
    if (!Number.isInteger(maxHistorico) || maxHistorico < 1) throw new Error(`maxHistorico inválido: ${maxHistorico}`);
    this.maxTentativas = maxTentativas;
    this.atrasoBaseMs = atrasoBaseMs;
    this.maxHistorico = maxHistorico;
    this.agora = agora;
    this.gerarId = gerarId;
    this.aoFalhar = aoFalhar;
  }

  registrar<P>(tipo: string, processador: Processador<P>): void {
    if (this.processadores.has(tipo)) throw new Error(`Já existe processador para "${tipo}".`);
    this.processadores.set(tipo, processador as Processador<unknown>);
  }

  // Síncrono de propósito: quem chama (o controller) nunca espera o processamento.
  enfileirar<P>(tipo: string, payload: P, { referencia, envolvidos = [] }: OpcoesEnfileirar = {}): JobPublico {
    const job: JobInterno = {
      id: this.gerarId(),
      tipo,
      referencia: referencia ?? null,
      status: "pendente",
      tentativas: 0,
      maxTentativas: this.maxTentativas,
      criadoEm: this.dataAgora(),
      iniciadoEm: null,
      concluidoEm: null,
      ultimoErro: null,
      payload,
      envolvidos: [...new Set(envolvidos)],
    };
    this.jobs.set(job.id, job);
    this.prontos.push(job);
    this.agendarCiclo();
    return publico(job);
  }

  buscar(id: string): JobPublico | undefined {
    const job = this.jobs.get(id);
    return job && publico(job);
  }

  // Mais recentes primeiro. Com usuarioId, só os jobs que envolvem aquele usuário.
  jobsRecentes(limite = 20, usuarioId?: string): JobPublico[] {
    const lista = [...this.jobs.values()].filter((j) => !usuarioId || j.envolvidos.includes(usuarioId));
    return lista.reverse().slice(0, Math.max(0, limite)).map(publico);
  }

  contagemPorStatus(): ContagemPorStatus {
    const contagem: ContagemPorStatus = { pendente: 0, processando: 0, concluido: 0, erro: 0 };
    for (const job of this.jobs.values()) contagem[job.status]++;
    return contagem;
  }

  resumo(limite = 20): ResumoFila {
    return { contagem: this.contagemPorStatus(), jobsRecentes: this.jobsRecentes(limite) };
  }

  get ociosa(): boolean {
    return !this.emExecucao && !this.cicloAgendado && this.prontos.length === 0 && this.esperas.size === 0;
  }

  // Resolve quando não há nada pendente, processando nem esperando nova tentativa.
  aguardarOcioso(): Promise<void> {
    if (this.ociosa) return Promise.resolve();
    return new Promise((ok) => this.aguardandoOcioso.push(ok));
  }

  // Para os testes: esquece jobs e cancela novas tentativas. Os processadores continuam registrados.
  limpar(): void {
    for (const espera of this.esperas) clearTimeout(espera);
    this.esperas.clear();
    this.prontos.length = 0;
    this.jobs.clear();
    this.avisarSeOciosa();
  }

  private dataAgora(): string {
    return new Date(this.agora()).toISOString();
  }

  private agendarCiclo(): void {
    if (this.cicloAgendado || this.emExecucao) return;
    this.cicloAgendado = true;
    setImmediate(() => {
      this.cicloAgendado = false;
      void this.processarProntos();
    });
  }

  // Um job por vez, na ordem de chegada: os jobs de um mesmo pedido não se atropelam.
  private async processarProntos(): Promise<void> {
    this.emExecucao = true;
    try {
      let job: JobInterno | undefined;
      while ((job = this.prontos.shift())) {
        if (this.jobs.get(job.id) !== job) continue; // limpo enquanto esperava
        await this.executar(job);
      }
    } finally {
      this.emExecucao = false;
      this.avisarSeOciosa();
    }
  }

  private async executar(job: JobInterno): Promise<void> {
    const processador = this.processadores.get(job.tipo);
    job.status = "processando";
    job.tentativas++;
    job.iniciadoEm ??= this.dataAgora();
    try {
      if (!processador) throw new Error(`Nenhum processador registrado para "${job.tipo}".`);
      await processador(job.payload, publico(job));
      job.status = "concluido";
      job.ultimoErro = null;
      job.concluidoEm = this.dataAgora();
      this.podarHistorico();
    } catch (erro) {
      job.ultimoErro = mensagemDoErro(erro);
      if (processador && job.tentativas < job.maxTentativas) {
        job.status = "pendente";
        this.tentarDeNovo(job);
        return;
      }
      job.status = "erro";
      job.concluidoEm = this.dataAgora();
      this.podarHistorico();
      try {
        this.aoFalhar(publico(job), erro);
      } catch {
        // log quebrado não pode derrubar o worker
      }
    }
  }

  private tentarDeNovo(job: JobInterno): void {
    const atraso = this.atrasoBaseMs * 2 ** (job.tentativas - 1);
    const espera = setTimeout(() => {
      this.esperas.delete(espera);
      if (this.jobs.get(job.id) !== job) return;
      this.prontos.push(job);
      this.agendarCiclo();
    }, atraso);
    this.esperas.add(espera);
  }

  // O histórico guarda só os últimos terminados; pendentes e em processamento nunca saem.
  private podarHistorico(): void {
    let terminados = 0;
    for (const job of this.jobs.values()) if (job.status === "concluido" || job.status === "erro") terminados++;
    for (const [id, job] of this.jobs) {
      if (terminados <= this.maxHistorico) break;
      if (job.status === "concluido" || job.status === "erro") {
        this.jobs.delete(id);
        terminados--;
      }
    }
  }

  private avisarSeOciosa(): void {
    if (!this.ociosa) return;
    const esperando = this.aguardandoOcioso;
    this.aguardandoOcioso = [];
    for (const ok of esperando) ok();
  }
}

function publico(job: JobInterno): JobPublico {
  return {
    id: job.id,
    tipo: job.tipo,
    referencia: job.referencia,
    status: job.status,
    tentativas: job.tentativas,
    maxTentativas: job.maxTentativas,
    criadoEm: job.criadoEm,
    iniciadoEm: job.iniciadoEm,
    concluidoEm: job.concluidoEm,
    ultimoErro: job.ultimoErro,
  };
}
