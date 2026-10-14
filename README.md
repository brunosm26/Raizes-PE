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

> **Aviso:** Como se trata de um MVP voltado para validação de frontend, *não há integração com banco de dados real nem serviços de autenticação externa neste estágio.* Toda a aplicação consome dados *Mockados* de `lib/dadosFalsos.ts`, servidos por `lib/apiFalsa.ts` e pelo motor em `lib/motorRecomendacao.ts`.
>
> Como ainda não existe login, as áreas logadas usam usuários fixos de demonstração:
> o artesão `u2` (Cooperativa de Tacaratu) no `/painel` e a compradora `u7` (Ana Beatriz) no
> `/meus-pedidos` e no checkout. Os pedidos criados durante o uso e as mudanças de status
> ficam salvos no `localStorage` do navegador (chave `raizes-pe:pedidos`), então sobrevivem a
> um *refresh*, mas não saem da máquina.

### 🔜 Próximos Passos

- Alerta de baixo estoque no painel do artesão.
- Cadastro e edição de produtos pelo próprio artesão.
- Painel administrativo de moderação: aprovação e bloqueio de artesãos, edição de categorias e técnicas.
- Autenticação real, substituindo os usuários fixos de demonstração.
- Evolução do modelo de recomendação com técnicas colaborativas e embeddings.

## 🎨 Foco em Inclusão Digital (UX)

- **Legendas em Ícones**: Evitamos metáforas visuais isoladas. Botões importantes possuem descrições literais (ex: "Meu Carrinho").
- **Fluxo Via WhatsApp**: Para mitigar a resistência de compras digitais, implementamos botões com links "wa.me" parametrizados para os artesãos.
- **Checkout Wizard**: Telas de formulário curtas, contendo apenas uma instrução clara de cada vez para o preenchimento da compra.
- **Micro-interações e Contraste**: Botões e áreas de clique (*tap targets*) foram aumentados visando usabilidade em telas mobile pequenas.

---

## 💻 Como Rodar o Projeto Localmente

**Pré-requisitos:**
- [Node.js](https://nodejs.org/en/) (Versão 18 ou superior).
- Gerenciador de pacotes padrão: `npm`.

**Passo 1:** Clone o repositório para sua máquina local.
```bash
git clone https://github.com/brunosm26/Raizes-pe.git
```

**Passo 2:** Acesse o diretório do projeto.
```bash
cd Raizes-pe
```

**Passo 3:** Instale todas as dependências do projeto.
```bash
npm install
```

**Passo 4:** Inicie o servidor de desenvolvimento.
```bash
npm run dev
```

O aplicativo estará disponível em seu navegador acessando: [http://localhost:3000](http://localhost:3000)

**Antes de abrir um Pull Request**, rode os testes automatizados, o lint e o typecheck para manter a integridade do código:
```bash
npm test
npm run lint
npx tsc --noEmit
```

## 🔐 Login de Demonstração

Como o projeto ainda não tem backend/autenticação real, o login em `/login` usa três credenciais fixas para simular os perfis de uso da plataforma:

| Perfil | E-mail | Senha | Destino após login |
|---|---|---|---|
| Comprador | `ana.beatriz@raizespe.dev` | `demo123` | `/` (vitrine) |
| Artesão | `tacaratu@raizespe.dev` | `demo123` | `/painel` |
| Admin | `admin@raizespe.dev` | `demo123` | `/admin` |

Também existe uma tela de cadastro (`/cadastro`), mas ela é apenas ilustrativa — os dados preenchidos não são persistidos. Para testar de verdade, use uma das credenciais acima.

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
│   ├── page.tsx              # Vitrine pública (inclui recomendações de IA)
│   ├── api/
│   │   └── recomendacoes/    # API Route HTTP para recomendações inteligentes
│   ├── produto/[id]/         # Detalhe do produto
│   ├── artesao/[id]/         # Perfil público do artesão
│   ├── checkout/             # Wizard de finalização de compra
│   ├── painel/               # Painel do artesão (inclui gráficos de vendas)
│   ├── meus-pedidos/         # Área do comprador (acompanhamento de pedidos)
│   ├── provedores.tsx        # Providers (Chakra UI, carrinho e pedidos)
│   └── layout.tsx            # Layout raiz
├── components/               # Componentes reutilizáveis
│   ├── SecaoRecomendados.tsx # Vitrine inteligente com badges explicativos de IA
│   ├── GraficoVendas.tsx     # Visualização analítica com Recharts
│   └── ...
├── lib/
│   ├── motorRecomendacao.ts  # Baseline de IA para recomendação de produtos
│   ├── tipos.ts              # Interfaces TypeScript (espelham o Modelo Lógico)
│   ├── dadosFalsos.ts        # Dados mockados
│   ├── apiFalsa.ts           # Funções que simulam chamadas de API
│   ├── contextoCarrinho.tsx  # Estado do carrinho (Context API)
│   ├── contextoPedidos.tsx   # Estado dos pedidos e avisos de envio (Context API)
│   ├── tema.ts               # Design System no Chakra UI
│   └── arteProduto.ts        # Padrões visuais no lugar das fotos
├── docs/                     # Documentação do projeto
│   ├── CONTRATO_API.md       # Contrato inicial da API
│   ├── BASELINE_IA.md        # Documentação e regras da Baseline de IA (U1)
│   └── AUDITORIA_INPUTS.md   # Auditoria de tipagem e validação de inputs (PI4-91)
├── tests/                    # Suíte de testes automatizados (node --test)
│   ├── mascaras.test.mjs     # Testes unitários de máscaras de input
│   └── recomendacao.test.mjs # Testes do motor de recomendação inteligente
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
