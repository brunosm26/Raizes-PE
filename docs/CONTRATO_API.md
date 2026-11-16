# Contrato da API — Raízes PE

**Versão:** 0.2 (PI4-143, 15/11/2026)  
**Status:** Proposta inicial para integração entre frontend e backend, com partes já atualizadas para o que está implementado  
**Projeto:** Raízes PE — Marketplace da Economia Criativa

> **Atualização da PI4-143.** Descrevem o que está implementado: o formato de erro (seção 2), o `POST /api/auth/cadastro` (seção 3), o `GET /api/filtros` (seção 4) e o `GET /api/artesaos` (seção 5). As duas rotas novas entram com o PR #50. Os outros exemplos ainda são da proposta inicial: as rotas implementadas devolvem o JSON direto, sem o envelope `{ "sucesso", "dados" }`. O contrato completo e atualizado do Express está em `backend/openapi.yaml` (Swagger UI em `/api-docs`).

## 1. Objetivo

Este documento define o contrato inicial de comunicação entre o frontend e a API do projeto Raízes PE. A intenção é estabelecer rotas, parâmetros, estruturas de requisição e formatos de resposta antes da integração com um backend e banco de dados reais.

Quando a proposta foi escrita, a maior parte dos dados ainda era simulada por arquivos locais (`lib/dadosFalsos.ts` e `lib/apiFalsa.ts`). A situação atual está na seção 9.

## 2. Padrões gerais

- Formato de troca de dados: JSON.
- Codificação: UTF-8.
- Datas: padrão ISO 8601 (`YYYY-MM-DD` ou timestamp ISO, quando necessário).
- Valores monetários: número decimal em reais, sem símbolo `R$` no JSON.
- Erros devem retornar uma mensagem legível para o frontend.

### Formato de erro (implementado)

Na API Express, todo erro responde neste formato, com a mensagem em português. Caminho que não existe responde 404 no mesmo formato:

```json
{
  "ok": false,
  "erro": "Faça login para continuar."
}
```

- **Express (`backend/`):** sempre `{ "ok": false, "erro": "..." }`. Erro inesperado responde 500 com `"Erro interno do servidor"`, sem expor a mensagem interna.
- **Rotas do Next (`app/api`, usadas quando a `API_URL` não está definida):** as duas rotas da PI4-143 (`GET /api/artesaos` e `GET /api/filtros`, que entram com o PR #50) usam o mesmo `{ "ok": false, "erro" }`. As rotas de autenticação e de escrita do Next respondem só `{ "erro": "..." }`, e as de leitura mais antigas, `{ "mensagem": "..." }`, com os mesmos status.

## 3. Usuários e autenticação

> O `POST /api/auth/cadastro` descreve o que está implementado. O exemplo de `POST /api/auth/login` ainda é o da proposta inicial: o login real devolve `{ "usuario": { "id", "nome", "tipo" } }` e grava o cookie `httpOnly` `raizes_sessao`, sem token no corpo (ver `backend/openapi.yaml` e `docs/estrategia-autenticacao.md`).

### POST `/api/auth/cadastro`

Cria uma conta de **comprador** e já inicia a sessão. Substitui o `POST /api/usuarios` da proposta inicial. Não há autocadastro de artesão nem de admin: essas contas são criadas por quem administra a plataforma. Os artesãos que já estão no banco sem senha ganham uma pelo script `npm run contas:artesao` (`docs/estrategia-autenticacao.md`, seção 13).

#### Requisição

```json
{
  "nome": "Maria da Silva",
  "email": "maria@exemplo.com",
  "senha": "senha-segura"
}
```

- `nome`: de 1 a 150 caracteres, gravado sem espaços nas pontas.
- `email`: e-mail válido de até 150 caracteres, gravado sem espaços e em minúsculas.
- `senha`: de 8 a 200 caracteres. É guardada só como hash scrypt.
- Um campo `tipo` enviado no corpo é ignorado: a conta é sempre de comprador.

#### Resposta de sucesso — 201

Grava o cookie de sessão `raizes_sessao` (`Set-Cookie`) e devolve:

```json
{
  "usuario": {
    "id": "6f1c2a9e-3b7d-4e21-9a55-0c8d4b7e2f10",
    "nome": "Maria da Silva",
    "tipo": "comprador"
  }
}
```

#### Possíveis erros

- `400`: `"Informe seu nome (até 150 caracteres)."`, `"Informe um e-mail válido."`, `"A senha precisa ter de 8 a 200 caracteres."` ou `"Corpo da requisição inválido."`.
- `409`: `"Este e-mail já está cadastrado."`.
- `500`: erro interno.

### POST `/api/auth/login`

Autentica um usuário.

#### Requisição

```json
{
  "email": "usuario@exemplo.com",
  "senha": "senha-segura"
}
```

#### Resposta de sucesso — 200

```json
{
  "sucesso": true,
  "dados": {
    "usuario": {
      "id": "u9",
      "nome": "Usuário Exemplo",
      "email": "usuario@exemplo.com",
      "tipo": "comprador"
    },
    "token": "token-de-exemplo"
  }
}
```

#### Possíveis erros

- `400` — dados inválidos.
- `401` — e-mail ou senha incorretos.
- `409` — e-mail já cadastrado, no caso de criação de usuário.

## 4. Produtos

### GET `/api/produtos`

Lista produtos da vitrine.

#### Parâmetros opcionais

- `tecnica`
- `regiao`
- `categoria`
- `q` — termo de busca

Exemplo:

```text
GET /api/produtos?tecnica=Cerâmica&regiao=Alto%20do%20Moura&q=vaso
```

#### Resposta — 200

```json
{
  "sucesso": true,
  "dados": [
    {
      "id": "p1",
      "artesaoId": "a1",
      "nome": "Vaso de Cerâmica Maragogi",
      "descricao": "Vaso torneado à mão em argila local.",
      "tecnica": "Cerâmica",
      "categoria": "Decoração",
      "preco": 185.0,
      "estoqueQtd": 8,
      "imagemUrl": "/produtos/p1.svg",
      "artesaoNome": "Vitalino Neto",
      "artesaoRegiao": "Alto do Moura, Caruaru"
    }
  ]
}
```

### GET `/api/produtos/{id}`

Retorna os detalhes de um produto específico.

#### Possíveis respostas

- `200` — produto encontrado.
- `404` — produto inexistente.

### GET `/api/filtros`

> Implementada na PI4-143 (entra com o PR #50), no Express e no `app/api` do Next, com o mesmo contrato.

Opções dos filtros da vitrine. **Pública**, sem parâmetros.

- `tecnicas`: a lista fixa de técnicas da plataforma, a mesma do `CHECK` da coluna `produto.tecnica`, nesta ordem.
- `regioes`: as regiões de origem cadastradas nos artesãos.
- `categorias`: as categorias cadastradas nos produtos. Não há tabela de categorias (decisão D1 da PI4-143).
- Em `regioes` e `categorias`, os espaços das pontas são removidos, valores vazios ficam de fora, grafias que só diferem em maiúsculas e minúsculas aparecem uma vez e a ordem é alfabética (pt-BR).

#### Resposta — 200

Com a carga de demonstração (`db/05_dados_raizes_pe.sql`):

```json
{
  "tecnicas": ["Cerâmica", "Têxtil", "Madeira", "Renda e Bordado", "Palha"],
  "regioes": ["Alto do Moura, Caruaru", "Comunidade do Pilar", "Garanhuns", "Tacaratu", "Tracunhaém"],
  "categorias": ["Casa", "Decoração", "Vestuário"]
}
```

#### Possíveis erros

- `500`: `{ "ok": false, "erro": "Erro interno do servidor" }`.

## 5. Artesãos

### GET `/api/artesaos`

> Implementada na PI4-143 (entra com o PR #50), no Express e no `app/api` do Next, com o mesmo contrato.

Lista todos os artesãos para a gestão pelo admin. **Só o perfil `admin`**, pelo cookie de sessão `raizes_sessao`.

- Ordem alfabética do nome (pt-BR); nomes iguais desempatam pelo `id`.
- `id` é o id do artesão (tabela `artesao`) e `usuarioId`, o do usuário dele (tabela `usuario`).
- `regiaoOrigem` vem vazia quando não foi informada.
- `tecnicas` são as técnicas distintas dos produtos do artesão, em ordem alfabética (vazia se ele não tem produtos), e `totalProdutos` é quantos produtos ele tem.
- `temLogin` diz só se a conta tem senha cadastrada. A consulta não lê o hash nem o e-mail, e nenhum dos dois sai na resposta.
- `dataCadastro` é a data de cadastro do usuário, no formato `YYYY-MM-DD`.

#### Resposta — 200

Um item da carga de demonstração:

```json
[
  {
    "id": "20000000-0000-4000-8000-000000000002",
    "usuarioId": "10000000-0000-4000-8000-000000000002",
    "nome": "Cooperativa de Tacaratu",
    "regiaoOrigem": "Tacaratu",
    "tecnicas": ["Têxtil"],
    "totalProdutos": 2,
    "temLogin": true,
    "dataCadastro": "2025-01-22"
  }
]
```

#### Possíveis erros

- `401`: sem sessão, `{ "ok": false, "erro": "Faça login para continuar." }`.
- `403`: sessão de comprador ou artesão, `{ "ok": false, "erro": "Seu perfil não tem permissão para esta ação." }`.
- `500`: `{ "ok": false, "erro": "Erro interno do servidor" }`.

### GET `/api/artesaos/{id}`

Retorna o perfil público de um artesão e seus produtos.

#### Resposta — 200

```json
{
  "sucesso": true,
  "dados": {
    "id": "a1",
    "nome": "Vitalino Neto",
    "regiaoOrigem": "Alto do Moura, Caruaru",
    "biografia": "Ceramista da família Vitalino.",
    "produtos": []
  }
}
```

## 6. Recomendações

### GET `/api/recomendacoes`

Esta rota já existe no projeto atual e utiliza a baseline de recomendação.

#### Parâmetros

- `compradorId` — opcional. Quando ausente, aplica o cenário de cold start.
- `limite` — opcional. Quantidade máxima de recomendações. Valor padrão atual: `4`.

Exemplo:

```text
GET /api/recomendacoes?compradorId=u7&limite=4
```

#### Resposta — 200

```json
{
  "sucesso": true,
  "origem": "baseline_ia_v1",
  "compradorId": "u7",
  "total": 4,
  "dados": [
    {
      "id": "p2",
      "nome": "Tapete Tear Manual",
      "score": 92,
      "criterio": "historico_tecnica",
      "motivo": "Inspirado no seu apreço por Têxtil"
    }
  ]
}
```

#### Regra geral

A recomendação atual:

1. remove produtos sem estoque;
2. utiliza histórico de compras quando disponível;
3. prioriza afinidade por técnica e região;
4. utiliza avaliação, popularidade e novidade como apoio;
5. aplica fallback para visitantes novos ou sem histórico.

#### Possíveis erros

- `500` — erro interno ao gerar recomendações.

## 7. Pedidos

> Rotas propostas para substituir a persistência atual feita em `localStorage`.

### POST `/api/pedidos`

Cria um pedido.

#### Requisição

```json
{
  "compradorId": "u7",
  "itens": [
    {
      "produtoId": "p1",
      "quantidade": 1
    }
  ]
}
```

#### Resposta — 201

```json
{
  "sucesso": true,
  "dados": {
    "id": "pe4",
    "compradorId": "u7",
    "status": "pendente",
    "valorTotal": 185.0
  }
}
```

### GET `/api/compradores/{id}/pedidos`

Lista pedidos de um comprador.

### PATCH `/api/pedidos/{id}/status`

Atualiza o status de um pedido.

#### Requisição

```json
{
  "status": "enviado"
}
```

Valores previstos:

- `pendente`
- `pago`
- `enviado`
- `entregue`

## 8. Códigos HTTP previstos

| Código | Significado |
|---|---|
| 200 | Requisição realizada com sucesso |
| 201 | Recurso criado com sucesso |
| 400 | Dados inválidos |
| 401 | Não autenticado |
| 403 | Sem permissão: a sessão é de outro perfil (por exemplo, comprador em `GET /api/artesaos`) |
| 404 | Recurso não encontrado |
| 409 | Conflito, como e-mail já cadastrado |
| 429 | Muitas tentativas de login (5 falhas por e-mail e IP a cada 15 minutos) |
| 500 | Erro interno do servidor |

## 9. Situação atual (15/11/2026)

As rotas estão implementadas nos dois lados, com o mesmo contrato: no app Next (`app/api`) e no backend Express (`backend/`), que o front usa quando a `API_URL` está definida. Catálogo, pedidos, produtos do painel, login e recomendações já leem e gravam no banco. Na PI4-143, a lista de artesãos do admin e os filtros da vitrine ganham as rotas `GET /api/artesaos` e `GET /api/filtros` (entram com o PR #50), e as telas passam a usá-las no PR2 da PI4-143. A aprovação de artesãos e a moderação de produtos continuam só no navegador, como demonstração.

O contrato completo do Express, conferido por testes, está em `backend/openapi.yaml`. Este documento guarda a proposta inicial, com as partes atualizadas na PI4-143 indicadas no topo.
