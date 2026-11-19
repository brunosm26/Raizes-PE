// Cache em memória com TTL e invalidação explícita, sem dependência externa (nada de Redis).
// Vale por processo: cada instância da API tem o seu. Serve para leituras repetidas do catálogo,
// em que alguns segundos de atraso são aceitáveis e toda escrita apaga o cache na hora.

export type OrigemCache = "HIT" | "MISS";

export interface OpcoesCacheMemoria {
  /** Tempo de vida de cada entrada. 0 desliga o cache (toda leitura é MISS). */
  ttlMs: number;
  /** Teto de entradas. Ao passar, sai a mais antiga (a busca livre gera chaves sem fim). */
  maxEntradas?: number;
  /** Relógio injetável, para os testes de expiração não dependerem de espera real. */
  agora?: () => number;
}

interface Entrada<T> {
  valor: T;
  expiraEm: number;
}

const MAX_ENTRADAS_PADRAO = 500;

export class CacheMemoria<T = unknown> {
  readonly ttlMs: number;
  private readonly maxEntradas: number;
  private readonly agora: () => number;
  private readonly entradas = new Map<string, Entrada<T>>();
  // Sobe a cada invalidação. Uma leitura que começou antes dela não grava o resultado,
  // senão um dado de antes da escrita voltaria para o cache logo depois de ser apagado.
  private geracao = 0;

  // `() => Date.now()` e não `Date.now`: lê o relógio na hora, então o mock.timers dos testes vale.
  constructor({ ttlMs, maxEntradas = MAX_ENTRADAS_PADRAO, agora = () => Date.now() }: OpcoesCacheMemoria) {
    if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new Error(`ttlMs inválido: ${ttlMs}`);
    if (!Number.isInteger(maxEntradas) || maxEntradas < 1) throw new Error(`maxEntradas inválido: ${maxEntradas}`);
    this.ttlMs = ttlMs;
    this.maxEntradas = maxEntradas;
    this.agora = agora;
  }

  get tamanho(): number {
    return this.entradas.size;
  }

  obter(chave: string): T | undefined {
    const entrada = this.entradas.get(chave);
    if (!entrada) return undefined;
    if (entrada.expiraEm <= this.agora()) {
      this.entradas.delete(chave);
      return undefined;
    }
    return entrada.valor;
  }

  guardar(chave: string, valor: T): void {
    if (this.ttlMs === 0) return;
    this.entradas.delete(chave); // reinserir move a chave para o fim da fila de despejo
    this.entradas.set(chave, { valor, expiraEm: this.agora() + this.ttlMs });
    while (this.entradas.size > this.maxEntradas) {
      const maisAntiga = this.entradas.keys().next().value as string;
      this.entradas.delete(maisAntiga);
    }
  }

  // Devolve do cache (HIT) ou executa `calcular` e guarda o resultado (MISS).
  // Se `calcular` falhar, nada é guardado e o erro sobe para quem chamou.
  // O tipo do valor segue o de `calcular`: num cache compartilhado, cada prefixo de chave
  // (filtros, produtos:..., recomendacoes:...) guarda sempre o mesmo formato.
  async lerOuCalcular<V extends T>(chave: string, calcular: () => Promise<V>): Promise<{ valor: V; origem: OrigemCache }> {
    const emCache = this.obter(chave);
    if (emCache !== undefined) return { valor: emCache as V, origem: "HIT" };

    const geracaoNoInicio = this.geracao;
    const valor = await calcular();
    if (geracaoNoInicio === this.geracao) this.guardar(chave, valor);
    return { valor, origem: "MISS" };
  }

  invalidar(chave: string): void {
    this.geracao++;
    this.entradas.delete(chave);
  }

  limpar(): void {
    this.geracao++;
    this.entradas.clear();
  }
}
