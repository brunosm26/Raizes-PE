# Raízes PE - Marketplace da Economia Criativa

Este é o **Raízes PE**, desenvolvido para dar visibilidade a artesãos locais e conectá-los diretamente a potenciais compradores, promovendo a inclusão digital e a facilidade de vendas online.

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

**Antes de abrir um Pull Request**, rode o lint e o typecheck para manter a integridade do código:
```bash
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
