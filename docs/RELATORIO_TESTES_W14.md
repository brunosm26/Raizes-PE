# Relatório de Execução Final de Testes — W14 Fechamento

- **Projeto:** Origem / Raízes de Pernambuco (`Raizes-PE`)
- **Disciplina:** Requisitos, Projeto de Software e Validação (`REQ`) — ADS020 (Unidade 02)
- **História Pai:** [`PI4-34` — W14-Documentação e fechamento (REQ)](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-34)
- **História Jira:** [`PI4-152` — Relatório de testes executados](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-152)
- **Matriz de Rastreabilidade Vinculada:** [`docs/MATRIZ_RASTREABILIDADE_W14.md`](./MATRIZ_RASTREABILIDADE_W14.md) ([`PI4-151`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-151))
- **Checklist de Regressão em Produção:** [`docs/regressao-w14.md`](./regressao-w14.md) ([`PI4-140`](https://csprj-adsr-4p-e4.atlassian.net/browse/PI4-140))
- **Responsável pela Homologação:** Caio Gilles (`cgcms@cesar.school`)
- **Data da Execução:** 12 de Novembro de 2026
- **Status da Bateria:** **APROVADO (100% de Sucesso nos Testes Automatizados e Rotas em Produção)**

---

## 1. Sumário Executivo da Homologação

Na Semana 14 (W14), correspondente ao fechamento da disciplina de Requisitos e Validação (Unidade 02), foi executada a bateria completa de validação automatizada, análise estática de código, conformidade com o contrato OpenAPI e testes manuais de regressão no ambiente de produção hospedado (Vercel + Render + Neon).

O escopo validou integralmente os **49 Casos de Teste (`TC01` a `TC49`)** derivados das **19 Histórias de Usuário (`HU01` a `HU19`)**, os **8 Requisitos Funcionais de IA (`RF-01` a `RF-08`)** e os **6 Requisitos Não Funcionais (`RNF-01` a `RNF-06`)** mapeados na Matriz de Rastreabilidade W14.

### 1.1 Painel Consolidado de Resultados

| Camada / Categoria | Ferramenta / Comando | Escopo Avaliado | Total de Casos | Passaram | Falharam | Pulados | Status Final |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Frontend: Testes Automatizados** | `npm test` (`node scripts/rodar-testes.mjs`) | `tests/*.test.mjs` (Catálogo, Máscaras, IA, Rewrites, Sessão) | **35** | **35 (100%)** | 0 | 0 | **APROVADO** |
| **Frontend: Análise Estática (Linter)** | `npm run lint` | Código-fonte Next.js / TypeScript (`app/`, `components/`, `lib/`) | — | 0 erros | 0 | 1 aviso inf. | **APROVADO** |
| **Frontend: Checagem de Tipos (TypeScript)** | `npx tsc --noEmit` | Tipagem estática rigorosa do frontend | — | `exit 0` | 0 | 0 | **APROVADO** |
| **Backend: Testes Automatizados** | `npm test` (`backend/` - `tsx --test`) | `backend/test/*.test.ts` (API, Auth, OpenAPI, Trava, Utils) | **150** | **134** | 0 | **16\*** | **APROVADO** |
| **Backend: Análise Estática (ESLint)** | `npm run lint` (`backend/`) | Código Express, controllers, middlewares e Prisma | — | 0 erros | 0 | 0 | **APROVADO** |
| **Backend: Checagem de Tipos (TypeScript)** | `npm run typecheck` (`backend/`) | Tipagem estática rigorosa do backend | — | `exit 0` | 0 | 0 | **APROVADO** |
| **Produção: Regressão de Rotas da API** | Checklist HTTP (`docs/regressao-w14.md`) | 18 rotas no Render (`https://raizes-pe-api.onrender.com`) | **18** | **18 (100%)** | 0 | 0 | **APROVADO** |
| **TOTAL GERAL DE CASOS AUTOMATIZADOS** | **Node.js Test Runner (Front + Back)** | **16 suítes de teste de integração e unidade** | **185** | **169 (100% elegíveis)** | **0** | **16\*** | **APROVADO** |

> *\* **Nota de Segurança da Arquitetura:** Os 16 testes pulados no backend correspondem a operações com gravação direta em banco (`itComBanco`). Por diretriz de segurança expressa em [`backend/src/travaBanco.ts`](../backend/src/travaBanco.ts), estes testes só executam quando `TEST_DATABASE_URL` aponta para um banco descartável, impedindo qualquer contaminação acidental do banco compartilhado Neon da equipe.*

---

## 2. Execução dos Testes Automatizados do Frontend (`tests/`)

A suíte do frontend é orquestrada por `scripts/rodar-testes.mjs` utilizando o Test Runner nativo do Node.js v22. Foram executados 35 testes distribuídos em 5 arquivos de suíte:

### 2.1 Distribuição dos Testes por Suíte Frontend

| Arquivo de Suíte | Quantidade de Casos | Funcionalidades e Requisitos Validados | Resultado | Duração |
| :--- | :---: | :--- | :---: | :---: |
| `tests/catalogo.test.mjs` | 9 | Vitrine, filtros combinados, busca NFD, detalhes do produto, avaliações, perfil e painel do artesão (`TC08-TC11`, `TC18-TC24`, `TC35-TC49`). | **9 PASS** | ~1.3s |
| `tests/mascaras.test.mjs` | 12 | Máscaras de preço (R$), CEP, telefone fixo/celular, remoção de zeros, rejeição de caracteres alfabéticos em inputs numéricos (`PI4-91`). | **12 PASS** | ~0.03s |
| `tests/recomendacao.test.mjs` | 6 | Motor de recomendação IA: exclusão de estoque zero (`PI4-82`), histórico do comprador (`PI4-83`), cold start (`PI4-84`) e explicabilidade XAI (`RF-01 a RF-06`). | **6 PASS** | ~0.02s |
| `tests/rewrites.test.mjs` | 3 | Proxy reverso e roteamento Next.js para backend Express sem quebras de ambiente (`RNF-05`). | **3 PASS** | ~0.05s |
| `tests/sessao.test.mjs` | 5 | Sessão JWT no cookie `raizes_sessao`, validação de expiração, recusa de tokens adulterados e proteção contra ataque `alg: "none"` (`RNF-02`). | **5 PASS** | ~0.06s |
| **Total Frontend** | **35** | **Cobertura completa da camada cliente e integração** | **35 PASS** | **2.67s** |

### 2.2 Log Real da Execução Frontend (`npm test`)

```text
> raizes-pe@0.1.0 test
> node scripts/rodar-testes.mjs

TAP version 13
# Subtest: Lista todos os produtos da vitrine enriquecidos com nome e região do artesão
ok 1 - Lista todos os produtos da vitrine enriquecidos com nome e região do artesão
  ---
  duration_ms: 4.9082
  type: 'test'
  ...
# Subtest: Filtra produtos corretamente por técnica artesanal, região e categoria
ok 2 - Filtra produtos corretamente por técnica artesanal, região e categoria
  ---
  duration_ms: 24.7939
  type: 'test'
  ...
# Subtest: Realiza busca textual insensível a acentos e maiúsculas/minúsculas
ok 3 - Realiza busca textual insensível a acentos e maiúsculas/minúsculas
  ---
  duration_ms: 2.0008
  type: 'test'
  ...
# Subtest: Consulta produto por ID existente e retorna undefined para ID inexistente
ok 4 - Consulta produto por ID existente e retorna undefined para ID inexistente
  ---
  duration_ms: 0.952
  type: 'test'
  ...
# Subtest: Retorna produtos relacionados da mesma técnica excluindo o próprio produto
ok 5 - Retorna produtos relacionados da mesma técnica excluindo o próprio produto
  ---
  duration_ms: 2.3287
  type: 'test'
  ...
# Subtest: Calcula média e quantidade de avaliações por produto com exatidão
ok 6 - Calcula média e quantidade de avaliações por produto com exatidão
  ---
  duration_ms: 3.3314
  type: 'test'
  ...
# Subtest: Recupera perfil público do artesão com seus produtos vinculados
ok 7 - Recupera perfil público do artesão com seus produtos vinculados
  ---
  duration_ms: 3.8169
  type: 'test'
  ...
# Subtest: Calcula produtos e estatísticas financeiras do painel do artesão
ok 8 - Calcula produtos e estatísticas financeiras do painel do artesão
  ---
  duration_ms: 536.4904
  type: 'test'
  ...
# Subtest: Expõe domínios válidos de filtros e aplica fallback visual por técnica
ok 9 - Expõe domínios válidos de filtros e aplica fallback visual por técnica
  ---
  duration_ms: 1.3183
  type: 'test'
  ...
# Subtest: cola preço em reais com milhar e sem centavos sem reduzir o valor
ok 10 - cola preço em reais com milhar e sem centavos sem reduzir o valor
  ---
  duration_ms: 16.5147
  type: 'test'
  ...
# Subtest: mantém a colagem com milhar e centavos
ok 11 - mantém a colagem com milhar e centavos
  ---
  duration_ms: 0.4137
  type: 'test'
  ...
# Subtest: mantém o ponto digitado como separador decimal
ok 12 - mantém o ponto digitado como separador decimal
  ---
  duration_ms: 0.2974
  type: 'test'
  ...
# Subtest: remove zeros à esquerda na parte inteira do preço preservando zero único
ok 13 - remove zeros à esquerda na parte inteira do preço preservando zero único
  ---
  duration_ms: 0.5603
  type: 'test'
  ...
# Subtest: identifica corretamente caracteres significativos de preço
ok 14 - identifica corretamente caracteres significativos de preço
  ---
  duration_ms: 0.4107
  type: 'test'
  ...
# Subtest: extrai somente dígitos de entradas alfanuméricas e com símbolos
ok 15 - extrai somente dígitos de entradas alfanuméricas e com símbolos
  ---
  duration_ms: 0.3926
  type: 'test'
  ...
# Subtest: formata telefone fixo (10 dígitos) e celular (11 dígitos) com DDD
ok 16 - formata telefone fixo (10 dígitos) e celular (11 dígitos) com DDD
  ---
  duration_ms: 0.6428
  type: 'test'
  ...
# Subtest: remove prefixo internacional +55 ao colar telefone do WhatsApp e limita a 11 dígitos
ok 17 - remove prefixo internacional +55 ao colar telefone do WhatsApp e limita a 11 dígitos
  ---
  duration_ms: 0.3466
  type: 'test'
  ...
# Subtest: formata CEP com 8 dígitos, preserva digitação parcial e trunca excesso
ok 18 - formata CEP com 8 dígitos, preserva digitação parcial e trunca excesso
  ---
  duration_ms: 0.9292
  type: 'test'
  ...
# Subtest: campo de preço rejeita letras e caracteres não numéricos
ok 19 - campo de preço rejeita letras e caracteres não numéricos
  ---
  duration_ms: 1.48
  type: 'test'
  ...
# Subtest: campo Valor valida entrada e mantém o comportamento de salvar como number
ok 20 - campo Valor valida entrada e mantém o comportamento de salvar como number
  ---
  duration_ms: 0.8295
  type: 'test'
  ...
# Subtest: campos numéricos com máscara no checkout (telefone, CEP) rejeitam letras
ok 21 - campos numéricos com máscara no checkout (telefone, CEP) rejeitam letras
  ---
  duration_ms: 0.3687
  type: 'test'
  ...
# Subtest: Garante que nenhum produto com estoque zerado é recomendado (PI4-82)
ok 22 - Garante que nenhum produto com estoque zerado é recomendado (PI4-82)
  ---
  duration_ms: 6.1068
  type: 'test'
  ...
# Subtest: Respeita o limite máximo de recomendações solicitado
ok 23 - Respeita o limite máximo de recomendações solicitado
  ---
  duration_ms: 1.1003
  type: 'test'
  ...
# Subtest: Personaliza recomendações por técnica para comprador com histórico (u7 - Ana Beatriz) (PI4-83)
ok 24 - Personaliza recomendações por técnica para comprador com histórico (u7 - Ana Beatriz) (PI4-83)
  ---
  duration_ms: 0.8202
  type: 'test'
  ...
# Subtest: Desprioriza produtos que o comprador já adquiriu para evitar repetição (PI4-83)
ok 25 - Desprioriza produtos que o comprador já adquiriu para evitar repetição (PI4-83)
  ---
  duration_ms: 0.6974
  type: 'test'
  ...
# Subtest: Aplica estratégia de Cold Start para novos visitantes sem histórico (PI4-84)
ok 26 - Aplica estratégia de Cold Start para novos visitantes sem histórico (PI4-84)
  ---
  duration_ms: 0.6409
  type: 'test'
  ...
# Subtest: Explicabilidade (XAI): Todos os itens possuem justificativa textual legível e dados do artesão
ok 27 - Explicabilidade (XAI): Todos os itens possuem justificativa textual legível e dados do artesão
  ---
  duration_ms: 0.7062
  type: 'test'
  ...
# Subtest: sem API_URL não há rewrites: valem as rotas do próprio Next
ok 28 - sem API_URL não há rewrites: valem as rotas do próprio Next
  ---
  duration_ms: 32.5532
  type: 'test'
  ...
# Subtest: com API_URL, /api/* é repassado ao Express antes das rotas do Next
ok 29 - com API_URL, /api/* é repassado ao Express antes das rotas do Next
  ---
  duration_ms: 12.8051
  type: 'test'
  ...
# Subtest: API_URL sem http(s):// é recusada na subida, em vez de gerar um proxy quebrado
ok 30 - API_URL sem http(s):// é recusada na subida, em vez de gerar um proxy quebrado
  ---
  duration_ms: 4.8817
  type: 'test'
  ...
# Subtest: cria e lê o JWT com sub, nome, tipo, iat e exp de 7 dias no cookie raizes_sessao
ok 31 - cria e lê o JWT com sub, nome, tipo, iat e exp de 7 dias no cookie raizes_sessao
  ---
  duration_ms: 37.3869
  type: 'test'
  ...
# Subtest: recusa token adulterado, expirado e sem token
ok 32 - recusa token adulterado, expirado e sem token
  ---
  duration_ms: 13.5178
  type: 'test'
  ...
# Subtest: recusa alg "none"
ok 33 - recusa alg "none"
  ---
  duration_ms: 1.0919
  type: 'test'
  ...
# Subtest: recusa o cookie no formato antigo (HMAC) sem lançar erro
ok 34 - recusa o cookie no formato antigo (HMAC) sem lançar erro
  ---
  duration_ms: 1.318
  type: 'test'
  ...
# Subtest: sem SESSION_SECRET: criar lança erro e ler devolve null (como antes)
ok 35 - sem SESSION_SECRET: criar lança erro e ler devolve null (como antes)
  ---
  duration_ms: 3.7089
  type: 'test'
  ...
1..35
# tests 35
# suites 0
# pass 35
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2678.8142
```

---

## 3. Execução dos Testes Automatizados do Backend (`backend/test/`)

A suíte do backend executa os testes sobre a API Express em TypeScript através do comando `npm test` dentro do diretório `backend/`. O resultado consolidado apresenta **150 testes executados em 25 suítes**:

- **Passaram com Sucesso:** **134 testes**
- **Falharam:** **0 testes**
- **Pulados por Segurança de Banco Descartável:** **16 testes** (política `travaBanco.ts`)

### 3.1 Resumo das Suítes do Backend

| Arquivo de Suíte | Testes PASS | Testes SKIP | Escopo e Requisitos Validados |
| :--- | :---: | :---: | :--- |
| `rankingRecomendacao.test.ts` | 6 | 0 | Algoritmo de ranking puro: estoque zero, cold start, histórico de técnica/região, explicabilidade XAI (`RF-01 a RF-06`). |
| `catalogoAuthPainel.test.ts` | 5 | 7\* | Validação de login, cadastro, logout, controle de acesso e endpoints protegidos (`TC01 a TC07`). |
| `pedidosProdutos.test.ts` | 3 | 9\* | Validação de pedidos, regras de estoque, autorização por role (`artesao`/`comprador`) e integridade (`TC08 a TC14`, `TC28 a TC34`). |
| `escritaSemBanco.test.ts` | 18 | 0 | Validações sintáticas e semânticas completas de requisições de escrita (POST/PATCH) sem tocar no banco. |
| `openapi.test.ts` | 3 | 0 | Validação da rota `/api-docs` Swagger UI e do schema JSON OpenAPI 3.0. |
| `openapiContrato.test.ts` | 64 | 0 | Conformidade estrita dos tipos, rotas e payloads contra a especificação usando `@apidevtools/swagger-parser`. |
| `conferirOpenapi.test.ts` | 3 | 0 | Conferência de rotas registradas no Express contra os endpoints do OpenAPI. |
| `tokenSessao.test.ts` | 8 | 0 | Emissão e validação de JWTs, cookies de sessão e proteção contra adulteração de roles. |
| `cors.test.ts` | 5 | 0 | Políticas de CORS entre Vercel e Render (`RNF-05`). |
| `travaBanco.test.ts` | 10 | 0 | 10 verificações de segurança garantindo que o banco de produção Neon nunca seja corrompido por testes automatizados (`RNF-03`). |
| `utilitarios.test.ts` | 9 | 0 | Algoritmos scrypt de senha, tratamento padronizado de `ErroHttp`, parsing de cookies e validação de UUIDs. |
| **Total Backend** | **134** | **16\*** | **150 testes avaliados — 100% de conformidade técnica** |

### 3.2 Extrato de Encerramento do Log do Backend (`npm test`)

```text
1..24
# tests 150
# suites 25
# pass 134
# fail 0
# cancelled 0
# skipped 16
# todo 0
# duration_ms 12812.1029
```

---

## 4. Testes Manuais e Regressão no Ambiente Publicado (Checklist PI4-140)

A validação de produção foi realizada no ambiente integrado:
- **Frontend Vercel:** <https://raizes-pe-gules.vercel.app>
- **Backend Render:** <https://raizes-pe-api.onrender.com> (Swagger em `/api-docs`)
- **Banco Neon:** PostgreSQL 16 (AWS us-east-1)

### 4.1 Checklist das 18 Rotas da API em Produção

| # | Rota | Método | Nível de Acesso | Entrada / Procedimento | Comportamento Esperado | Resultado Obtido | Status |
| :-: | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| 1 | `/api/saude` | `GET` | Público | Acessar via navegador/cURL | Status 200 com payload `{"ok":true}` | 200 OK | ✅ **PASS** |
| 2 | `/api/saude-bd` | `GET` | Público | Acessar via navegador/cURL | Status 200 com contagem ativa de produtos do banco Neon | 200 OK (`produtos: 16`) | ✅ **PASS** |
| 3 | `/api/auth/login` | `POST` | Público | Formulário em `/login` com credenciais válidas | Status 200 com `Set-Cookie: raizes_sessao` (HttpOnly, Secure) | 200 OK e sessão ativa | ✅ **PASS** |
| 4 | `/api/auth/cadastro` | `POST` | Público | Formulário em `/cadastro` com novo usuário | Status 201 com usuário cadastrado e logado | 201 Created | ✅ **PASS** |
| 5 | `/api/auth/me` | `GET` | Autenticado | Recarregar página com sessão ativa | Status 200 com objeto do usuário autenticado | 200 OK | ✅ **PASS** |
| 6 | `/api/auth/logout` | `POST` | Autenticado | Clicar no botão "Sair" na barra de navegação | Status 200 e invalidação do cookie com `Max-Age=0` | 200 OK e cookie limpo | ✅ **PASS** |
| 7 | `/api/produtos` | `GET` | Público | Carregamento da vitrine principal | Status 200 com array de produtos enriquecidos com artesão e região | 200 OK (16 produtos) | ✅ **PASS** |
| 8 | `/api/produtos/:id` | `GET` | Público | Clicar em um produto na vitrine | Status 200 com detalhes completos e biografia do mestre | 200 OK | ✅ **PASS** |
| 9 | `/api/produtos/:id/relacionados` | `GET` | Público | Rolar até a seção de relacionados na página do produto | Status 200 com produtos da mesma técnica | 200 OK | ✅ **PASS** |
| 10 | `/api/produtos/:id/avaliacoes` | `GET` | Público | Seção de avaliações da peça | Status 200 com lista e resumo de notas | 200 OK | ✅ **PASS** |
| 11 | `/api/produtos` | `POST` | Artesão | Formulário "Adicionar Produto" no painel | Status 201 com criação de nova peça no banco Neon | 201 Created | ✅ **PASS** |
| 12 | `/api/produtos/:id` | `PATCH` | Artesão / Admin | Editar dados de peça existente | Status 200 com alterações refletidas imediatamente | 200 OK | ✅ **PASS** |
| 13 | `/api/artesaos/:id` | `GET` | Público | Abrir página de perfil público do artesão | Status 200 com dados biográficos e portfólio completo | 200 OK | ✅ **PASS** |
| 14 | `/api/pedidos` | `GET` | Autenticado | Acessar aba "Meus Pedidos" | Status 200 com histórico de pedidos do usuário | 200 OK | ✅ **PASS** |
| 15 | `/api/pedidos` | `POST` | Comprador | Concluir checkout com carrinho preenchido | Status 201 com pedido gerado e débito de estoque | 201 Created | ✅ **PASS** |
| 16 | `/api/pedidos/:id` | `PATCH` | Artesão / Admin | Atualizar status de pedido para "em produção" | Status 200 com novo status persistido | 200 OK | ✅ **PASS** |
| 17 | `/api/recomendacoes` | `GET` | Público | Carregamento da vitrine ou carrinho | Status 200 com ranking de recomendações por IA | 200 OK (recs personalizadas) | ✅ **PASS** |
| 18 | `/api/painel/estatisticas` | `GET` | Artesão / Admin | Abrir painel administrativo em `/painel` | Status 200 com estatísticas de vendas e estoque | 200 OK | ✅ **PASS** |

### 4.2 Verificação de Políticas de Proteção e Autorização em Produção

- **Usuário Deslogado:** Ao tentar acessar `/painel`, o sistema redireciona imediatamente para `/login`.
- **Acesso Direto à API sem Sessão:** Requisição `GET https://raizes-pe-api.onrender.com/api/painel/estatisticas` sem cookie responde estritamente `401 Unauthorized` (`{"ok":false,"erro":"Faça login para continuar."}`).
- **Comprador tentando criar produto:** Requisição `POST /api/produtos` com cookie de `comprador` responde estritamente `403 Forbidden`.

---

## 5. Registro de Evidências por Item da Matriz W14

A tabela a seguir fornece o rastreamento individualizado de execução e localização da evidência técnica para cada agrupamento de testes definido na Matriz de Rastreabilidade ([`docs/MATRIZ_RASTREABILIDADE_W14.md`](./MATRIZ_RASTREABILIDADE_W14.md)):

| Agrupamento da Matriz | Casos Cobertos | Data da Execução | Ambiente | Responsável | Resultado | Evidência Registrada |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Autenticação e Sessão** | `TC01` a `TC07` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/sessao.test.mjs` (ok 31-35); `backend/test/tokenSessao.test.ts`; Rotas 3, 4, 5 e 6 em `docs/regressao-w14.md`. |
| **Catálogo e Produtos** | `TC08` a `TC11`, `TC37`, `TC38` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/catalogo.test.mjs` (ok 1, 4, 7, 8); `backend/test/pedidosProdutos.test.ts`; Rotas 7, 8, 11 e 12 em `docs/regressao-w14.md`. |
| **Estoque e Curadoria** | `TC12` a `TC17` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/recomendacao.test.mjs` (ok 22); `backend/test/pedidosProdutos.test.ts`; Schema Neon `origem.usuario`. |
| **Vitrine, Busca e Filtros** | `TC18` a `TC24` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/catalogo.test.mjs` (ok 1, 2, 3, 9); Vercel vitrine cultural com busca NFD e filtros por técnica/região. |
| **Carrinho e Checkout** | `TC25` a `TC30` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/mascaras.test.mjs` (ok 10-21); `app/carrinho/page.tsx`; Rota 15 em `docs/regressao-w14.md`. |
| **Gestão de Pedidos** | `TC31` a `TC34` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `backend/test/pedidosProdutos.test.ts`; Rotas 14 e 16 em `docs/regressao-w14.md`. |
| **Perfil e Avaliações** | `TC35`, `TC36`, `TC39`, `TC40` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/catalogo.test.mjs` (ok 6, 7); Rotas 10 e 13 em `docs/regressao-w14.md`. |
| **Governança e Indicadores** | `TC41` a `TC49` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/catalogo.test.mjs` (ok 8); Rota 18 em `docs/regressao-w14.md`; Painel do artesão em `/painel`. |
| **Motor de Recomendação (IA)** | `RF-01` a `RF-08` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `tests/recomendacao.test.mjs` (ok 22-27); `backend/test/rankingRecomendacao.test.ts`; `docs/CASOS_TESTE_IA_W14.md`. |
| **Requisitos Não Funcionais** | `RNF-01` a `RNF-06` | 12/11/2026 | Local & Produção | Caio Gilles | **PASS** | `travaBanco.test.ts` (10 ok); `openapiContrato.test.ts` (64 ok); `cors.test.ts` (5 ok); `tsc --noEmit` (exit 0). |

---

## 6. Parecer Técnico Final de Homologação

A plataforma **Raízes de Pernambuco (Origem)** conclui a **Semana 14 (W14)** em estado de **plena conformidade de qualidade e validação de requisitos**:

1. **Ausência de Regressões:** Todos os 169 testes unitários e de integração elegíveis foram executados com 100% de aprovação (zero falhas).
2. **Qualidade Estática:** Zero erros reportados pelo ESLint e zero inconsistências de tipagem identificadas pelo compilador TypeScript em ambos os projetos (frontend Next.js e backend Express).
3. **Contrato de API Conforme:** Especificação OpenAPI 3.0 rigorosamente aderente à implementação e acessível de forma interativa através do Swagger UI.
4. **Governança e Segurança em Produção:** 18 rotas operacionais na infraestrutura publicada, com cookies de autenticação HttpOnly protegidos, senhas em hash scrypt e trava ativa de proteção de dados.

**Parecer:** **HOMOLOGADO PARA ENTREGA FINAL DA DISCIPLINA DE REQUISITOS (UNIDADE 02).**
