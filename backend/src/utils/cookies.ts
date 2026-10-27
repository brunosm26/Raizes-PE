// Lê um cookie do cabeçalho "Cookie" sem depender de cookie-parser.
export function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  if (!cabecalho) return undefined;
  for (const parte of cabecalho.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    if (parte.slice(0, i).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(i + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
