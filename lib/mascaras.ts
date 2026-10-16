import type { ChangeEvent } from "react";

type Filtro = (caractere: string) => boolean;

const ehDigito: Filtro = (caractere) => caractere >= "0" && caractere <= "9";

// No preço a vírgula (e o ponto, que vira vírgula) faz parte do valor digitado,
// então conta na hora de reposicionar o cursor.
export const ehCaractereDePreco: Filtro = (caractere) =>
  ehDigito(caractere) || caractere === "," || caractere === ".";

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

// (81) 9999-0000 para fixo e (81) 99999-0000 para celular. O hífen só muda de lugar
// no 11º dígito, que é quando dá para saber que o número é de celular.
export function formatarTelefone(valor: string): string {
  let digitos = somenteDigitos(valor);
  // Número copiado do WhatsApp costuma vir como "+55 81 9...".
  if (valor.trim().startsWith("+55")) digitos = digitos.slice(2);
  digitos = digitos.slice(0, 11);

  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const tamanhoDoPrefixo = numero.length > 8 ? 5 : 4;
  if (numero.length <= tamanhoDoPrefixo) return `(${ddd}) ${numero}`;
  return `(${ddd}) ${numero.slice(0, tamanhoDoPrefixo)}-${numero.slice(tamanhoDoPrefixo)}`;
}

export function formatarCep(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

// Mantém o padrão de exibição do projeto ("1234,56", sem separador de milhar), que é
// exatamente o que o Number(preco.replace(",", ".")) dos modais já sabe converter.
// Durante a digitação só remove caracteres, nunca insere, para não brigar com o cursor.
export function formatarPreco(valor: string): string {
  // Em um valor monetário colado, "R$ 1.234" é um inteiro com separador de milhar.
  // Sem o prefixo, o ponto continua sendo tratado como separador decimal digitado.
  const milharMonetarioSemCentavos = /^\s*R\$\s*\d{1,3}(?:\.\d{3})+\s*$/.test(valor);
  const semMilhar = milharMonetarioSemCentavos || valor.includes(",") || (valor.match(/\./g) ?? []).length > 1;
  const normalizado = (semMilhar ? valor.replace(/\./g, "") : valor.replace(".", ","))
    .replace(/[^\d,]/g, "");

  const [inteiros, ...partesDecimais] = normalizado.split(",");
  const inteirosSemZeroAEsquerda = inteiros.replace(/^0+(?=\d)/, "");
  if (partesDecimais.length === 0) return inteirosSemZeroAEsquerda;

  return `${inteirosSemZeroAEsquerda},${partesDecimais.join("").slice(0, 2)}`;
}

// Ao voltar a um preço já completo e digitar no fim, substitui os centavos.
// Durante a digitação inicial, formatarPreco continua limitando a duas casas.
export function formatarPrecoAoRetomar(anterior: string, digitado: string): string {
  if (/^\d+,\d{2}$/.test(anterior) && digitado.startsWith(anterior)) {
    const acrescentado = digitado.slice(anterior.length);
    if (/^\d{1,2}$/.test(acrescentado)) return `${anterior.slice(0, -2)}${acrescentado}`;
    if (acrescentado === "," || acrescentado === ".") return anterior.slice(0, -2);
  }
  return formatarPreco(digitado);
}

// Chamado no blur: "12" vira "12,00", ",5" vira "0,50".
export function completarPreco(valor: string): string {
  if (valor === "") return "";
  const [inteiros, decimais = ""] = valor.split(",");
  return `${inteiros || "0"},${decimais.padEnd(2, "0")}`;
}

function contarSignificativos(texto: string, ehSignificativo: Filtro): number {
  return [...texto].filter(ehSignificativo).length;
}

function posicaoAposSignificativos(texto: string, quantidade: number, ehSignificativo: Filtro): number {
  if (quantidade === 0) return 0;
  let vistos = 0;
  for (let indice = 0; indice < texto.length; indice++) {
    if (ehSignificativo(texto[indice]) && ++vistos === quantidade) return indice + 1;
  }
  return texto.length;
}

// Formata o valor digitado e devolve o cursor para junto do mesmo caractere em que o
// usuário estava. O valor formatado é escrito direto no input, junto com o cursor, ainda
// dentro do onChange: quando o React renderiza, o DOM já está igual ao estado e ele não
// reescreve o value (que é o que jogaria o cursor para o fim do campo).
export function aplicarMascara(
  evento: ChangeEvent<HTMLInputElement>,
  formatar: (valor: string) => string,
  ehSignificativo: Filtro = ehDigito,
): string {
  const input = evento.target;
  const digitado = input.value;
  const formatado = formatar(digitado);
  if (formatado === digitado) return formatado;

  const cursor = input.selectionStart ?? digitado.length;
  const significativosAntesDoCursor = contarSignificativos(digitado.slice(0, cursor), ehSignificativo);

  input.value = formatado;
  if (document.activeElement === input) {
    const posicao = posicaoAposSignificativos(formatado, significativosAntesDoCursor, ehSignificativo);
    input.setSelectionRange(posicao, posicao);
  }

  return formatado;
}
