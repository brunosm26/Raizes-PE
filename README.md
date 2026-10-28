# Raízes PE - Marketplace da Economia Criativa

Este é o **Raízes PE**, desenvolvido para dar visibilidade a artesãos locais e conectá-los diretamente a potenciais compradores, promovendo a inclusão digital e a facilidade de vendas online.

## Módulo de IA: mockup executável do serviço de recomendação (AV2)

Este repositório também traz o módulo de recomendação especificado na AV1, em forma de mockup executável (Trilha A, serviço em BentoML). Ele mostra o caminho feliz: alguém instala, sobe o serviço e vê a entrada virar saída conforme o contrato da AV1. O código fica na pasta `ia/`, trabalha só com dados sintéticos (RNF-02) e roda separado do app Next.js, como serviço próprio (RNF-05).

O app Next.js tem o seu próprio baseline em TypeScript (`lib/motorRecomendacao.ts`, descrito em `docs/BASELINE_IA.md`), que recomenda por histórico do comprador. O serviço desta seção é o módulo da AV1, que recomenda a partir de um produto de referência ou de um filtro de técnica e região.

### Instalação

Pré-requisitos: Python 3.10 ou superior (testado com 3.11 e 3.13), `pip` e `curl`.

```bash
git clone https://github.com/brunosm26/Raizes-PE.git
cd Raizes-PE
python -m venv .venv
source .venv/bin/activate        # no Windows: .venv\Scripts\activate
pip install -r ia/requirements.txt
```

### Como subir

```bash
cd ia
bentoml serve servico:Recomendador --port 3001
```

Espere a linha `Service Recomendador initialized`. Deixe esse terminal aberto e rode os testes em outro. A porta é a 3001 para não colidir com o `npm run dev`, que usa a 3000.

Documentação interativa (Swagger) do contrato `GET`: http://127.0.0.1:3001/api/docs

### Contrato do serviço (entrada e saída)

`GET /api/recomendacoes`, com os parâmetros na query string:

| Campo | Obrigatório | Descrição |
|---|---|---|
| `produto_id` | Sim, se não houver `tecnica` nem `regiao` | Produto que o comprador está vendo (ex.: `p1`). Se vier junto com os filtros, ele tem prioridade |
| `tecnica` | Não | Filtro explícito de técnica, sem diferenciar maiúsculas e acentos (ex.: `Palha`) |
| `regiao` | Não | Filtro explícito de região, basta um trecho do nome (ex.: `Pilar`) |
| `limite` | Não | Quantidade de itens, de 1 a 20. Padrão: 5 |

Resposta 200: `produto_referencia_id`, `filtro_aplicado`, `estrategia_aplicada` (`tecnica_regiao_popularidade` ou `cold_start`) e a lista `recomendacoes`, em que cada item tem `produto_id`, `nome`, `tecnica`, `preco` e `criterio` (`mesma_tecnica`, `mesma_regiao`, `popularidade` ou `diversificacao`).

Erros: 400 (`parametros_insuficientes` ou `limite_invalido`), 404 (`produto_nao_encontrado`) e 500 (`erro_interno`), sempre com o corpo `{"erro": "...", "mensagem": "..."}`.

O BentoML também expõe a mesma recomendação como `POST /recomendar`, com os campos acima em um corpo JSON. Ela aparece no Swagger da raiz (http://127.0.0.1:3001/), mas os testes abaixo usam o `GET`.

### Tabela RF da AV1 para endpoint ou ferramenta

| RF (AV1) | O que o mockup faz | Onde | Teste |
|---|---|---|---|
| RF-01 | Recomenda produtos da mesma técnica, a partir de um produto ou do filtro `tecnica` | `GET /api/recomendacoes` | 1 e 2 |
| RF-02 | Recomenda produtos da mesma região, a partir de um produto ou do filtro `regiao` | `GET /api/recomendacoes` | 1 e 2 |
| RF-03 | Ordena os candidatos por popularidade (unidades vendidas + nota média) | `GET /api/recomendacoes` | 1, 2 e 3 |
| RF-04 | Expõe o endpoint em JSON; produto inexistente responde 404 | `GET /api/recomendacoes` | 1, 4 e 5 |
| RF-05 | Cold start: quando técnica e região não preenchem a lista, completa com os mais populares da base | `GET /api/recomendacoes` (`estrategia_aplicada: cold_start`) | 3 |
| RF-06 | Diversificação: 30% da lista (arredondado para cima) vai para os produtos menos populares | `GET /api/recomendacoes` (`criterio: diversificacao`) | 1, 2 e 3 |
| RF-07 | Calcula e registra as métricas do baseline | `python ia/avaliar_baseline.py` | 6 |
| RF-08 | Peças relacionadas no perfil do artesão: o mesmo endpoint, com o `produto_id` de uma peça do artesão (não há rota dedicada) | `GET /api/recomendacoes` | 1 |

Outros requisitos da AV1 que o mockup atende: RNF-01 (a resposta sai em poucos milissegundos, e o tempo de cada chamada vai para o log), RNF-02 (catálogo sintético), RNF-03 (código versionado neste repositório, com estas instruções), RNF-04 (campo `criterio` em cada item) e RNF-06 (uma técnica ou região nova entra como linha nova em `ia/dados/catalogo_sintetico.json`, sem mexer no código). Regra adicional, que a AV1 não numera: só produtos com estoque são recomendados (o `p10` está sem estoque de propósito).

### Testes para copiar e colar

Com o serviço no ar, abra outro terminal. No PowerShell, use `curl.exe` no lugar de `curl` (ou cole a URL no navegador, já que é um `GET`). Os resultados abaixo são a saída exata do serviço. O catálogo tem 12 produtos (ver a seção seguinte); `p1` é o Vaso de Cerâmica Maragogi e `p3` é a Escultura em Madeira, a única peça dessa técnica.

#### Teste 1: recomendação a partir de um produto (RF-01, 02, 03, 04, 06, 08)

```bash
curl "http://127.0.0.1:3001/api/recomendacoes?produto_id=p1&limite=3"
```

Resultado esperado (HTTP 200): duas peças de cerâmica, mais populares primeiro (`p8` é do mesmo artesão de `p1`), e uma vaga de diversificação com o produto menos popular da base.

```json
{
  "produto_referencia_id": "p1",
  "filtro_aplicado": null,
  "estrategia_aplicada": "tecnica_regiao_popularidade",
  "recomendacoes": [
    {
      "produto_id": "p8",
      "nome": "Boneca de Barro Figurativa",
      "tecnica": "Cerâmica",
      "preco": 140.0,
      "criterio": "mesma_tecnica"
    },
    {
      "produto_id": "p6",
      "nome": "Jarro de Cerâmica Fosco",
      "tecnica": "Cerâmica",
      "preco": 210.0,
      "criterio": "mesma_tecnica"
    },
    {
      "produto_id": "p4",
      "nome": "Renda de Bilro Flor do Agreste",
      "tecnica": "Renda e Bordado",
      "preco": 95.0,
      "criterio": "diversificacao"
    }
  ]
}
```

#### Teste 2: filtro explícito de técnica e região, sem produto de referência (RF-01, 02, 03)

```bash
curl "http://127.0.0.1:3001/api/recomendacoes?tecnica=Palha&regiao=Comunidade%20do%20Pilar&limite=3"
```

Resultado esperado (HTTP 200): `produto_referencia_id` vem nulo e `filtro_aplicado` ecoa o filtro. O `p5` entra pela técnica e o `p9` pela região. O `p10` (também de palha e do Pilar) não aparece porque está sem estoque.

```json
{
  "produto_referencia_id": null,
  "filtro_aplicado": {
    "tecnica": "Palha",
    "regiao": "Comunidade do Pilar"
  },
  "estrategia_aplicada": "tecnica_regiao_popularidade",
  "recomendacoes": [
    {
      "produto_id": "p5",
      "nome": "Cesto de Palha Trançada",
      "tecnica": "Palha",
      "preco": 68.0,
      "criterio": "mesma_tecnica"
    },
    {
      "produto_id": "p9",
      "nome": "Xilogravura Cordel Pernambucano",
      "tecnica": "Xilogravura",
      "preco": 120.0,
      "criterio": "mesma_regiao"
    },
    {
      "produto_id": "p4",
      "nome": "Renda de Bilro Flor do Agreste",
      "tecnica": "Renda e Bordado",
      "preco": 95.0,
      "criterio": "diversificacao"
    }
  ]
}
```

#### Teste 3: cold start (RF-05)

```bash
curl "http://127.0.0.1:3001/api/recomendacoes?produto_id=p3&limite=3"
```

Resultado esperado (HTTP 200): não existe outra peça de madeira nem outro artesão de Garanhuns, então a lista é completada com os mais populares da base e `estrategia_aplicada` vira `cold_start`.

```json
{
  "produto_referencia_id": "p3",
  "filtro_aplicado": null,
  "estrategia_aplicada": "cold_start",
  "recomendacoes": [
    {
      "produto_id": "p1",
      "nome": "Vaso de Cerâmica Maragogi",
      "tecnica": "Cerâmica",
      "preco": 185.0,
      "criterio": "popularidade"
    },
    {
      "produto_id": "p5",
      "nome": "Cesto de Palha Trançada",
      "tecnica": "Palha",
      "preco": 68.0,
      "criterio": "popularidade"
    },
    {
      "produto_id": "p4",
      "nome": "Renda de Bilro Flor do Agreste",
      "tecnica": "Renda e Bordado",
      "preco": 95.0,
      "criterio": "diversificacao"
    }
  ]
}
```

#### Teste 4: produto que não existe (RF-04, erro 404)

```bash
curl -i "http://127.0.0.1:3001/api/recomendacoes?produto_id=p999"
```

Resultado esperado: a primeira linha da resposta é `HTTP/1.1 404 Not Found` e o corpo é:

```json
{
  "erro": "produto_nao_encontrado",
  "mensagem": "Nenhum produto com o id informado foi encontrado no catálogo."
}
```

#### Teste 5: requisição sem parâmetros (erro 400)

```bash
curl -i "http://127.0.0.1:3001/api/recomendacoes"
```

Resultado esperado: a primeira linha da resposta é `HTTP/1.1 400 Bad Request` e o corpo é:

```json
{
  "erro": "parametros_insuficientes",
  "mensagem": "Informe produto_id, ou ao menos um dos campos tecnica/regiao."
}
```

#### Teste 6: métricas do baseline (RF-07)

Este não precisa do serviço no ar. Rode na raiz do repositório, com o ambiente virtual ativo:

```bash
python ia/avaliar_baseline.py
```

Resultado esperado: o script simula uma recomendação para cada um dos 12 produtos, imprime as três métricas do `design.md` da AV1 e grava o mesmo conteúdo em `ia/resultados/metricas_baseline.json`.

```text
Métricas do baseline (lote simulado sobre o catálogo sintético)
  chamadas simuladas           12
  itens recomendados           60
  taxa de cold start           66.7%
  cobertura do catálogo        90.9%
  diversificação efetiva       40.0%
Registrado em resultados/metricas_baseline.json
```

### Catálogo sintético e regras do baseline

O catálogo está em `ia/dados/catalogo_sintetico.json`, com a estrutura das tabelas do Modelo Lógico usadas pelo módulo: 12 produtos, 7 artesãos, 20 linhas de `item_pedido` e 18 avaliações. Os produtos `p1` a `p7` vêm do app (`lib/dadosFalsos.ts`); `p8` a `p12` foram criados para o mockup, porque o app tem só 7 produtos. Vendas e avaliações são inventadas.

Regras do motor (`ia/motor_recomendacao.py`):

1. O pool de candidatos reúne os produtos com estoque que têm a mesma técnica ou a mesma região do alvo (o produto de referência ou o filtro).
2. A popularidade de um produto é a soma das unidades vendidas com a nota média. O pool é ordenado por ela, e o empate vai para o cadastro mais recente.
3. Se o pool não preenche as vagas de popularidade, o restante vem dos produtos mais populares da base inteira (cold start).
4. A diversificação reserva 30% da lista, arredondado para cima (limite 3 usa 1 vaga, limite 5 usa 2), para os produtos menos populares que ainda não entraram na lista.

Limites do mockup: o serviço é somente leitura, lê o JSON na subida e não usa banco de dados nem autenticação. Filtragem colaborativa, classificação de produtos e análise de sentimento ficam para a Unidade 2.

### Estrutura da pasta `ia/`

```text
ia/
├── servico.py                    # Serviço BentoML (GET /api/recomendacoes e POST /recomendar)
├── motor_recomendacao.py         # Lógica do baseline, sem HTTP
├── avaliar_baseline.py           # Métricas do baseline (RF-07)
├── dados/
│   └── catalogo_sintetico.json   # Catálogo sintético (12 produtos)
├── resultados/
│   └── metricas_baseline.json    # Saída do avaliar_baseline.py
└── requirements.txt              # Dependências Python
```

## 🚀 Tecnologias Utilizadas

O projeto foi construído utilizando um ecossistema moderno focado em alta performance e escalabilidade:

- **Next.js (App Router)**: Framework React para renderização de páginas, roteamento avançado, rotas de API e SSR/SSG.
- **TypeScript**: Superset de JavaScript que adiciona tipagem estática, garantindo um código mais seguro.
- **Chakra UI (v2) & Emotion**: Biblioteca robusta de componentes para a criação de um *Design System* acessível, responsivo e consistente.
- **Recharts**: Visualização de dados analíticos no painel do artesão (gráficos de área gradiente e rosca).
- **Framer Motion**: Utilizado (internamente pelo Chakra UI) para transições e micro-animações.
- **React Icons**: Coleção de ícones para identificação visual clara e intuitiva.
- **ESLint**: Padronização do código (`npm run lint`), configurado em `eslint.config.mjs`.
- **Express 5 + TypeScript** (`backend/`): API REST em camadas (routes, controllers, services, repositories). Os repositories das rotas acessam o PostgreSQL via `pg`.
- **Prisma 7** (`backend/prisma/`, com `@prisma/adapter-pg`): configurado e conectado ao Neon (esquema `origem`, PI4-128). Hoje nenhuma rota usa o Prisma: as rotas continuam no `pg`, e a troca é decisão pendente do time (ver `docs/plano-migracao-api.md`).
- **OpenAPI 3 + Swagger UI**: documentação da API versionada em `backend/openapi.yaml` e navegável em `/api-docs`.
- **PostgreSQL no Neon**: o banco oficial do projeto (scripts em `db/`).

## 💡 Principais Funcionalidades

- **Vitrine Pública (Compradores)**: 
  - Catálogo de artesãos e seus respectivos produtos.
  - **Recomendações Inteligentes (Baseline de IA - PI4-20 / PI4-27)**:
    - Seção de curadoria com motor de pontuação baseado em histórico de compras (afinidade por técnica e região).
    - Filtragem estrita de disponibilidade (peças sem estoque não são recomendadas).
    - Mecanismo explicável com *badges* de motivo (ex: *"Inspirado no seu apreço por Cerâmica"*, *"Alta recomendação da comunidade"*).
    - Tratamento para *Cold Start* com exibição de peças populares e bem avaliadas para visitantes anônimos.
    - Seletor interativo para alternar entre perfil com histórico (*Ana Beatriz*) e *Novo Visitante* em demonstrações.
    - Endpoint App Router dedicado (`GET /api/recomendacoes`).
  - Página de detalhes de produtos com fluxo de Carrinho e botão de "Compra via WhatsApp".
  - Checkout inteligente no formato *Wizard* passo-a-passo (pensado em UX de baixo letramento digital).
  - Busca por termo e filtros combinados de técnica, região e categoria.

- **Área do Comprador (`/meus-pedidos`)**:
  - Acompanhamento dos pedidos feitos, com etiqueta de status (pendente, pago, enviado, entregue).
  - Aviso de envio persistente na tela até ser fechado, em vez de sumir sozinho como um toast.

- **Painel do Artesão (`/painel`)**:
  - Resumo da loja em cartões: vendas, pedidos pendentes e visualizações.
  - **Gráficos Gerenciais de Vendas (Recharts)**:
    - *Evolução de Faturamento*: gráfico de área com preenchimento em gradiente terracota, eixos formatados em R$ e tooltips monetários.
    - *Vendas por Técnica Artesanal*: gráfico rosca (Donut) com distribuição percentual por especialidade cultural.
  - Listagem do catálogo com a quantidade em estoque de cada peça.
  - Gestão dos pedidos recebidos, com a ação "marcar como enviado" que notifica o comprador em tempo real.

> **Aviso:** o catálogo, os pedidos, os produtos do painel, o login e as recomendações já leem e gravam no PostgreSQL pelas rotas do Next (`app/api/*`), veja "Como Rodar o Projeto Localmente". Ainda usam dados mockados de `lib/dadosFalsos.ts`:
> - a lista de artesãos do admin (`getArtesaos`/`getUsuarios`, usada em `/admin`, `/admin/artesaos` e `/admin/produtos`);
> - as opções de região e categoria dos filtros da vitrine e de `/admin/categorias`.
>
> A aprovação de artesãos, a moderação de produtos e as categorias do admin ficam só no `localStorage` do navegador. O backend Express (`backend/`) já tem as mesmas rotas, mas **o front ainda não o chama** (PI4-132). O plano de migração está em `docs/plano-migracao-api.md`.
>
> Os pedidos, as mudanças de status e os produtos do painel ficam gravados no banco e dependem do usuário logado (veja "Login de Demonstração").

### 🔜 Próximos Passos

- Alerta de baixo estoque no painel do artesão.
- Painel administrativo de moderação: aprovação e bloqueio de artesãos, edição de categorias e técnicas.
- Migrar as telas de administração de artesãos e categorias para o banco (fase 7 de `docs/plano-migracao-api.md`).
- Tela do admin para criar contas de artesão.
- Evolução do modelo de recomendação com técnicas colaborativas e embeddings.

## 🎨 Foco em Inclusão Digital (UX)

- **Legendas em Ícones**: Evitamos metáforas visuais isoladas. Botões importantes possuem descrições literais (ex: "Meu Carrinho").
- **Fluxo Via WhatsApp**: Para mitigar a resistência de compras digitais, implementamos botões com links "wa.me" parametrizados para os artesãos.
- **Checkout Wizard**: Telas de formulário curtas, contendo apenas uma instrução clara de cada vez para o preenchimento da compra.
- **Micro-interações e Contraste**: Botões e áreas de clique (*tap targets*) foram aumentados visando usabilidade em telas mobile pequenas.

---

## 💻 Como Rodar o Projeto Localmente

A aplicação roda **conectada a um banco PostgreSQL hospedado no [Neon](https://neon.tech)**, o banco oficial do projeto. O banco já está criado e carregado; para rodar o app você só precisa da connection string.

**Pré-requisitos:**
- [Node.js](https://nodejs.org/en/) **22 LTS** (recomendado) e `npm`. O app Next aceita Node 18.18+, mas o backend exige `^20.19 || ^22.12 || >=24` por causa do Prisma 7. Com o Node 22, os dois rodam, e o `npm test` funciona também no Windows (veja "Problemas comuns").
- As connection strings do banco no Neon (peça ao responsável pelo banco, por um canal privado; veja "Variáveis de ambiente").

**Passo 1:** Clone o repositório e entre na pasta.
```bash
git clone https://github.com/brunosm26/Raizes-PE.git
cd Raizes-PE
```

**Passo 2:** Instale as dependências.
```bash
npm install
```

**Passo 3:** Crie o seu `.env.local` a partir do modelo (o arquivo não vai para o GitHub).
```bash
# Windows (cmd)
copy .env.example .env.local
# Mac/Linux
cp .env.example .env.local
```
Abra o `.env.local` e preencha:
- `DATABASE_URL`: a connection string **pooled** do Neon.
- `SESSION_SECRET`: um valor gerado por você, com
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Passo 4:** Inicie a aplicação.
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000). Para testar a conexão com o banco, abra [http://localhost:3000/api/saude-bd](http://localhost:3000/api/saude-bd): deve responder com sucesso. Se mudar o `.env.local` com o servidor rodando, reinicie o `npm run dev`.

Só isso já roda o site completo: hoje o front usa as rotas do próprio Next. O backend Express é opcional até a PI4-132 ligar o front a ele.

### Front e backend juntos

Use dois terminais, um para cada porta:

| Terminal | Pasta | Comando | Endereço |
|---|---|---|---|
| 1. App Next (front + `app/api`) | raiz do projeto | `npm run dev` | <http://localhost:3000> |
| 2. API Express | `backend/` | `npm install` (só na primeira vez) e depois `npm run dev` | <http://localhost:4000/api/saude> e <http://localhost:4000/api-docs> |

### Variáveis de ambiente

Cada projeto tem o seu arquivo, e nenhum dos dois vai para o GitHub:

| Arquivo | Quem lê | Variáveis | Modelo |
|---|---|---|---|
| `.env.local` (raiz) | App Next | `DATABASE_URL`, `SESSION_SECRET` | `.env.example` |
| `backend/.env` | API Express e CLI do Prisma | `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `PORT` (padrão 4000), `NODE_ENV`; `TEST_DATABASE_URL` só para testes | `backend/.env.example` |

- O `SESSION_SECRET` deve ser **o mesmo** nos dois arquivos, para o front e a API aceitarem o mesmo cookie de sessão.
- No painel do Neon, ambas as strings ficam em **Connect** e terminam em `?sslmode=require`:
  - **pooled** (com *Connection pooling* ligado; o host tem `-pooler`): vai na `DATABASE_URL` dos dois arquivos. É a usada pelos apps em execução.
  - **direta** (com o pooling desligado; o host não tem `-pooler`): vai na `DIRECT_URL` do `backend/.env`. É a usada só pela CLI do Prisma (`npm run prisma:pull`).

### Scripts úteis

| Onde | Comando | Faz |
|---|---|---|
| raiz | `npm run dev` / `npm run build` | Sobe / compila o app Next |
| raiz | `npm test`, `npm run lint`, `npx tsc --noEmit` | Testes, lint e typecheck do front |
| `backend/` | `npm run dev` / `npm run build` / `npm start` | Sobe a API em modo de desenvolvimento / compila / roda a versão compilada |
| `backend/` | `npm run typecheck`, `npm test` | Typecheck e testes da API (incluem a conferência do `openapi.yaml`) |
| `backend/` | `npm run prisma:generate` | Regera o client do Prisma (o `npm install` já faz isso) |
| `backend/` | `npm run prisma:verificar` | **Só leitura:** conta as linhas das 8 tabelas e da view no Neon |

Detalhes do Prisma, incluindo `prisma:pull`, estão em [`backend/README.md`](backend/README.md).

### Banco de dados (Neon)

Os scripts SQL ficam na pasta `db/`. Para montar um banco do zero (por exemplo, um projeto novo no Neon), abra o **SQL Editor** do Neon e execute os arquivos **um por vez, nesta ordem**:

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `01_ddl_origem.sql` | Cria o esquema `origem`: 8 tabelas, gatilhos, índices, view de popularidade e perfis de acesso |
| 2 | `02_dados_exemplo_origem.sql` | Dados de exemplo do modelo físico |
| 3 | `04_migracao_front.sql` | Acrescenta `descricao` e `imagem_url` em `produto` |
| 4 | `05_dados_raizes_pe.sql` | Troca os dados de exemplo pelo catálogo do front (9 usuários, 6 artesãos, 7 produtos, 3 pedidos, 6 avaliações) |
| 5 | `06_imagem_produto.sql` | `imagem_url` passa a aceitar foto enviada pelo artesão (até ~2 MB) |
| 6 | `07_autenticacao.sql` | Acrescenta `senha_hash` em `usuario` e define a senha dos 3 logins de demonstração |

Para conferir se ficou correto, cole o conteúdo de `db/validacao_resumo.sql` no SQL Editor e execute: o resultado é uma tabela de 8 linhas em que `esperado` deve ser igual a `obtido` em todas. O `03_consultas_validacao_origem.sql` traz as consultas de recomendação e de conferência do modelo físico, para rodar à mão.

> **Cuidado, o banco é compartilhado.** O `05_dados_raizes_pe.sql` **apaga** os dados existentes antes de carregar o catálogo, e o `01_ddl_origem.sql` tem uma linha de `DROP SCHEMA` comentada. Não execute esses scripts no banco oficial sem combinar com o time.

### Problemas comuns

- **Erro de conexão no `npm run dev` ou em `/api/saude-bd`:** confira a `DATABASE_URL` do `.env.local` (a string deve terminar com `?sslmode=require`) e reinicie o servidor. O Neon pode levar alguns segundos para "acordar" na primeira consulta; tente de novo.
- **Login falha com erro de servidor:** confira se o `SESSION_SECRET` está preenchido no `.env.local` (mínimo de 32 caracteres) e reinicie o `npm run dev`.
- **`relation "produto" does not exist` no SQL Editor:** o esquema não foi selecionado. Execute `SET search_path TO origem;` junto com a consulta.
- **`npm test` falha no Windows com `Could not find '...\tests\*.test.mjs'`** (ou `...\backend\test\*.test.ts`): acontece no **Node 20**, porque o `cmd.exe` não expande o `*` e o `node --test` só passou a expandir padrões no Node 21. No Node 22 o `npm test` funciona normalmente. Se precisar ficar no Node 20, rode na raiz `node --test tests/` e, no `backend/`, `npx tsx --test test/catalogoAuthPainel.test.ts test/openapi.test.ts test/pedidosProdutos.test.ts`.
- **`EPERM: operation not permitted, rmdir ...src\generated...` no `prisma generate`:** acontece com o projeto dentro do OneDrive. Veja "Problemas comuns" em [`backend/README.md`](backend/README.md).

**Antes de abrir um Pull Request**, rode os testes automatizados, o lint e o typecheck para manter a integridade do código:
```bash
npm test
npm run lint
npx tsc --noEmit
```

## 🧱 API em camadas (backend Express) e documentação

A API REST fica em `backend/`, um projeto Express separado do front (stack de referência da disciplina, decisão da PI4-121). Ela expõe as mesmas rotas de `app/api/*`, com o mesmo contrato; o front passa a chamá-la na PI4-132.

```text
requisição → routes → middlewares (sessão e perfil) → controllers → services (regras) → repositories (SQL) → PostgreSQL
```

| Camada | Pasta | Faz |
|---|---|---|
| Rotas | `backend/src/routes/` | Método + caminho → middlewares + controller |
| Middlewares | `backend/src/middlewares/` | `exigirSessao(perfis)`, sessão opcional, erros em JSON |
| Controllers | `backend/src/controllers/` | Leem a requisição, chamam o service e respondem (status, cookie, JSON) |
| Services | `backend/src/services/` | Validação e regras de negócio (estoque, dono do produto, perfil); não importam `express` |
| Repositories | `backend/src/repositories/` | Todo o SQL; únicos que falam com o banco |
| Config e utils | `backend/src/config/`, `backend/src/utils/` | Variáveis de ambiente, pool do banco, ids, senha, token de sessão |

O mapa completo (arquivo antigo → camada nova) e as regras estão em [`docs/arquitetura-backend.md`](docs/arquitetura-backend.md).

**Rodar a API** (porta 4000, ao lado do Next na 3000):
```bash
cd backend
npm install
# crie o backend/.env a partir do .env.example, com a mesma DATABASE_URL e o mesmo SESSION_SECRET
# do .env.local, mais a DIRECT_URL (veja "Variáveis de ambiente")
npm run dev
```

**Documentação da API:** com a API rodando, abra [http://localhost:4000/api-docs](http://localhost:4000/api-docs) (Swagger UI). Para testar as rotas protegidas no próprio Swagger, execute primeiro `POST /auth/login` com um login de demonstração: o navegador guarda o cookie de sessão e o envia nas chamadas seguintes. A especificação crua fica em [`/api-docs.json`](http://localhost:4000/api-docs.json) e o arquivo-fonte é `backend/openapi.yaml`. No deploy, o caminho é o mesmo: `<url-da-api>/api-docs`.

**Antes de abrir um Pull Request no backend:**
```bash
cd backend
npm run typecheck
npm test   # inclui o teste que confere se openapi.yaml cobre todas as rotas
```

## 🔐 Login de Demonstração

O login em `/login` é real: a senha é conferida contra o hash guardado em `usuario.senha_hash` (scrypt) e a sessão vai em um cookie `httpOnly` com um JWT (HS256) assinado com o `SESSION_SECRET`. Os scripts do banco já criam três contas de demonstração:

| Perfil | E-mail | Senha | Destino após login |
|---|---|---|---|
| Comprador | `ana.beatriz@raizespe.dev` | `demo123` | `/` (vitrine) |
| Artesão | `tacaratu@raizespe.dev` | `demo123` | `/painel` |
| Admin | `admin@raizespe.dev` | `demo123` | `/admin` |

Cada perfil só acessa o que é seu: o comprador vê `/meus-pedidos` e `/checkout`; o artesão, o `/painel`; o admin, `/admin` e as demais áreas. A tela de cadastro (`/cadastro`) cria uma conta de **comprador** de verdade no banco. Os demais artesãos do catálogo ainda não têm senha (não conseguem entrar até receberem um `senha_hash`).

### Painel Administrativo (`/admin`)

Área de gestão da plataforma como um todo (diferente do `/painel`, que é a visão de *um* artesão específico):

- **Dashboard**: total de vendas, artesãos ativos, produtos cadastrados e pedidos pendentes, com gráfico de vendas por técnica.
- **Gestão de Artesãos** (`/admin/artesaos`)
- **Produtos e Moderação** (`/admin/produtos`)
- **Visão de Pedidos** (`/admin/pedidos`)
- **Categorias e Técnicas** (`/admin/categorias`)

## 📁 Estrutura de Pastas

```text
├── app/                      # Roteamento do Next.js App Router
│   ├── (publico)/            # Vitrine (page.tsx), produto/[id], artesao/[id], checkout, meus-pedidos
│   ├── (auth)/               # login e cadastro
│   ├── painel/               # Painel do artesão (inclui gráficos de vendas)
│   ├── admin/                # Painel administrativo
│   ├── api/                  # Rotas de API do Next (produtos, pedidos, auth, artesaos, painel, recomendações, saude-bd)
│   ├── provedores.tsx        # Providers (Chakra UI, sessão, carrinho, produtos e pedidos)
│   └── layout.tsx            # Layout raiz
├── middleware.ts             # Protege as páginas por perfil (lê o cookie de sessão)
├── components/               # Componentes reutilizáveis
│   ├── SecaoRecomendados.tsx # Vitrine inteligente com badges explicativos de IA
│   ├── GraficoVendas.tsx     # Visualização analítica com Recharts
│   └── ...
├── lib/
│   ├── db.ts                 # Conexão com o PostgreSQL (lê DATABASE_URL)
│   ├── servidor/             # Consultas SQL e regras que rodam só no servidor
│   ├── motorRecomendacao.ts  # Baseline de IA para recomendação (lê o banco; só servidor)
│   ├── tipos.ts              # Interfaces TypeScript (espelham o Modelo Lógico)
│   ├── sessao.ts             # Sessão em JWT no cookie (criar e ler) e perfis por área
│   ├── dadosFalsos.ts        # Dados mockados (restam no admin e nos filtros; ver docs/plano-migracao-api.md)
│   ├── apiFalsa.ts           # Funções de acesso a dados usadas pelas telas (a maioria já chama /api)
│   ├── contextoSessao.tsx    # Usuário logado (Context API, via /api/auth/me)
│   ├── contextoCarrinho.tsx  # Estado do carrinho (Context API)
│   ├── contextoProdutos.tsx  # Produtos do painel (Context API, via /api/produtos)
│   ├── contextoPedidos.tsx   # Estado dos pedidos e avisos de envio (Context API, via /api/pedidos)
│   ├── tema.ts               # Design System no Chakra UI
│   └── arteProduto.ts        # Padrões visuais no lugar das fotos
├── docs/                     # Documentação do projeto
│   ├── CONTRATO_API.md       # Contrato inicial da API
│   ├── arquitetura-backend.md # Camadas do backend e mapa da migração (PI4-122)
│   ├── estrategia-autenticacao.md # Sessão em JWT, senha e perfis (PI4-117, PI4-130)
│   ├── plano-migracao-api.md # Plano de migração do apiFalsa.ts para a API real
│   ├── RELATORIO_TESTES_W12.md # Relatório de testes e rastreabilidade (PI4-31)
│   └── BASELINE_IA.md        # Documentação e regras da Baseline de IA (U1)
├── tests/                    # Suíte de testes automatizados (node --test)
│   ├── catalogo.test.mjs     # Testes do catálogo
│   ├── mascaras.test.mjs     # Testes unitários de máscaras de input
│   └── recomendacao.test.mjs # Testes do motor de recomendação inteligente
├── db/                       # Scripts SQL do banco (Neon) e consulta de validação
├── backend/                  # API REST em Express (ver "API em camadas")
│   ├── openapi.yaml          # Especificação OpenAPI de todas as rotas (servida em /api-docs)
│   ├── prisma/schema.prisma  # Modelos do Prisma, introspectados do esquema origem
│   ├── prisma.config.ts      # Configuração da CLI do Prisma (usa a DIRECT_URL)
│   ├── scripts/              # verificar-prisma.ts (npm run prisma:verificar, só leitura)
│   ├── src/
│   │   ├── routes/           # Rotas por recurso, montadas em /api
│   │   ├── middlewares/      # Sessão/perfil e tratamento de erros
│   │   ├── controllers/      # Entrada e saída HTTP
│   │   ├── services/         # Regras de negócio e validação
│   │   ├── repositories/     # SQL (pg nas rotas; Prisma só na view de popularidade)
│   │   ├── config/           # env, pool do pg, client do Prisma e carga da spec
│   │   ├── utils/            # ErroHttp, ids, senha, token de sessão
│   │   ├── types/            # Tipos de domínio
│   │   └── generated/        # Client do Prisma gerado pelo npm install (não versionado)
│   └── test/                 # Testes de integração (node:test) e da spec
├── .env.example              # Modelo das variáveis do app Next (copiar para .env.local)
├── ia/                       # Módulo de IA (AV2): serviço BentoML de recomendação e catálogo sintético
├── eslint.config.mjs         # Regras de lint
└── package.json              # Scripts e dependências
```

> Não existe pasta `src/`: o código fica na raiz, e o alias `@/` aponta para ela
> (`@/lib/tipos`, `@/components/CartaoProduto`).

## ✒️ Autoria

- Bruno José Cavalcanti Duarte Filho
- Bruno Sottomayor Martin
- Caio Gilles Costa Medeiros de Souza
- Gustavo Rafael Renaux Veloso
- Igor Kauã de Souza Siqueira
- Matheus Conolly
- Leonardo Felipe Demétrio
- Hilton Resende Montes Neto
- Maria Clara Miranda Ferraz
- Ramon Taffarel Guimarães
- Pedro Henrique Cavalcanti e Silva
