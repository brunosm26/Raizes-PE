# Auditoria de Tipagem e Validação de Inputs — Raízes-PE (PI4-91)

Este documento registra o levantamento e auditoria completa de todos os formulários e campos de entrada da plataforma **Raízes-PE**, atendendo aos critérios de aceite da subtask **`PI4-91: Revisar o tipo dos inputs`** (vinculada à história **`PI4-88: W08 - Ajustes de entrega WEB U1`**).

---

## 1. Objetivo e Escopo da Auditoria

Garantir que todos os campos de formulários da aplicação utilizem o tipo, controle e máscara adequados, eliminando a aceitação indevida de texto livre ou caracteres alfabéticos em campos destinados a dados numéricos, monetários ou telefônicos/postais.

---

## 2. Matriz Geral de Formulários Auditados

| Formulário / Tela | Campo | Componente / Tipo | `inputMode` | Máscara / Validação | Restrição a Letras | Tipo Persistido |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Modal Adicionar Produto** (`/painel`) | Nome | `<Input>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | Descrição | `<Textarea>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | Técnica | `<Select>` | N/A | Enum `Tecnica` | N/A (seleção fechada) | `Tecnica` |
| | Categoria | `<Input>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | **Valor (Preço)** | `<Input>` + Addon `R$` | `decimal` | `aplicarMascara(formatarPreco, ehCaractereDePreco)` + `completarPreco` no blur | **Sim** (bloqueia letras e caracteres especiais no `onChange`) | `number` (Float) |
| | **Estoque** | `<NumberInput>` + Stepper | `numeric` | `min={0}`, `step={1}`, `precision={0}`, `clampValueOnBlur`, valida `Number.isInteger` | **Sim** (rejeita letras e números fracionários) | `number` (Integer) |
| **Modal Editar Produto** (`/painel`) | Nome | `<Input>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | Descrição | `<Textarea>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | **Valor (Preço)** | `<Input>` + Addon `R$` | `decimal` | `aplicarMascara(formatarPreco, ehCaractereDePreco)` + `completarPreco` no blur | **Sim** (bloqueia letras e caracteres especiais no `onChange`) | `number` (Float) |
| | **Estoque** | `<NumberInput>` + Stepper | `numeric` | `min={0}`, `step={1}`, `precision={0}`, `clampValueOnBlur`, valida `Number.isInteger` | **Sim** (rejeita letras e números fracionários) | `number` (Integer) |
| **Checkout — Etapa 1** (`/checkout`) | Nome completo | `<Input>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | **Telefone** | `<Input>` | `tel` | `aplicarMascara(formatarTelefone)` | **Sim** (aceita estritamente dígitos; formata DDD + número) | `string` |
| **Checkout — Etapa 2** (`/checkout`) | **CEP** | `<Input>` | `numeric` | `aplicarMascara(formatarCep)` | **Sim** (aceita estritamente 8 dígitos; formata `XXXXX-XXX`) | `string` |
| | Rua | `<Input>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | **Número** | `<Input>` | `text` | Deliberadamente alfanumérico para suportar "S/N", "120A", "Bloco 2" | Não (comportamento intencional de UX) | `string` |
| | Bairro | `<Input>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | Cidade | `<Input>` | `text` | Obrigatório (`trim()`) | N/A (texto permitido) | `string` |
| | Estado (UF) | `<Select>` | N/A | Lista fechada (PE, AL, BA, CE, PB, PI, RN, SE) | N/A (seleção fechada) | `string` |
| **Cadastro** (`/cadastro`) | Nome Completo | `<Input type="text">` | `text` | Simulação visual de criação de conta | N/A | N/A |
| | E-mail | `<Input type="email">` | `email` | Validação HTML5 de formato de e-mail | N/A | N/A |
| | Senha | `<Input type="password">` | `text` | Ocultação visual de caracteres | N/A | N/A |
| **Login** (`/login`) | E-mail | `<Input type="email">` | `email` | Validação contra credenciais demo | N/A | N/A |
| | Senha | `<Input type="password">` | `text` | Ocultação visual de caracteres | N/A | N/A |
| **Admin Categorias** (`/admin/categorias`) | Nome da Categoria | `<Input>` | `text` | Validação de unicidade e preenchimento | N/A | `string` |
| | Slug | `<Input isReadOnly>` | `text` | Gerado automaticamente via regex | N/A | `string` |
| **Busca Global** (`BarraNavegacao`) | Termo de busca | `<Input>` | `search` | Filtro textual na vitrine | N/A | `string` |

---

## 3. Detalhes das Correções e Refinamentos Aplicados

### 3.1 Campo Valor (Preço nos Modais Adicionar / Editar)
- **Bloqueio de Texto Livre:** A função `aplicarMascara` combinada com o predicado `ehCaractereDePreco` descarta qualquer caractere não numérico digitado ou colado no campo antes do commit de estado no React.
- **Formatação Monetária Dinâmica:** Suporta colagem com separador de milhar (`R$ 1.234`), vírgula como separador decimal e preenchimento automático de centavos (`completarPreco`) no evento `onBlur` (ex: `89` -> `89,00`).
- **Conversão Numérica Estrita:** Na submissão, o valor monetário formatado (`string` com vírgula) é normalizado e convertido via `Number(preco.replace(",", "."))`, garantindo que os dados salvos em memória / `localStorage` sejam do tipo primitivo `number` (ponto flutuante positivo).

### 3.2 Campo Estoque (Controle de Quantidade Inteira)
- **Controle Chakra `NumberInput`:**
  - `min={0}`: Impede valores negativos.
  - `step={1}`: Incremento/decremento unitário via stepper.
  - `precision={0}`: Impede casas decimais no controle visual.
  - `clampValueOnBlur`: Corrige automaticamente valores fora dos limites ao perder o foco.
  - `<NumberInputField inputMode="numeric" />`: Abre teclado numérico em dispositivos móveis.
- **Validação de Submissão:** Adicionada checagem com `!Number.isInteger(estoque)` e `estoque >= 0`, rejeitando frações (artesanatos e peças físicas são itens inteiros indivisíveis).

---

## 4. Cobertura de Testes Automatizados

Foram adicionados testes unitários em `tests/mascaras.test.mjs` executados nativamente via `node --test`:
1. Rejeição de strings puramente alfabéticas (`formatarPreco("abc") === ""`).
2. Rejeição de letras intercaladas (`formatarPreco("12a3b4") === "1234"`).
3. Rejeição de caracteres alfabéticos pelo predicado de filtro (`ehCaractereDePreco("a") === false`).
4. Validação de conversão para tipo `number` primitivo (`typeof valorNumerico === "number"` e `valorNumerico === 150.5`).
5. Higienização e rejeição de letras em máscaras de checkout (`formatarTelefone` e `formatarCep`).
