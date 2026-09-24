# Contrato da API — Raízes PE

**Versão:** 0.1  
**Status:** Proposta inicial para integração entre frontend e backend  
**Projeto:** Raízes PE — Marketplace da Economia Criativa

## 1. Objetivo

Este documento define o contrato inicial de comunicação entre o frontend e a API do projeto Raízes PE. A intenção é estabelecer rotas, parâmetros, estruturas de requisição e formatos de resposta antes da integração com um backend e banco de dados reais.

Na versão atual do projeto, a maior parte dos dados ainda é simulada por arquivos locais (`lib/dadosFalsos.ts` e `lib/apiFalsa.ts`). A rota HTTP de recomendações já existe em `app/api/recomendacoes/route.ts`.

## 2. Padrões gerais

- Formato de troca de dados: JSON.
- Codificação: UTF-8.
- Datas: padrão ISO 8601 (`YYYY-MM-DD` ou timestamp ISO, quando necessário).
- Valores monetários: número decimal em reais, sem símbolo `R$` no JSON.
- Erros devem retornar uma mensagem legível para o frontend.

Exemplo de erro:

```json
{
  "sucesso": false,
  "mensagem": "Recurso não encontrado"
}
```

## 3. Usuários e autenticação

> Estas rotas representam o contrato proposto para a futura integração. Ainda não há autenticação real implementada no MVP atual.

### POST `/api/usuarios`

Cria um novo usuário comprador ou artesão.

#### Requisição

```json
{
  "nome": "Usuário Exemplo",
  "email": "usuario@exemplo.com",
  "senha": "senha-segura",
  "tipo": "comprador"
}
```

Valores permitidos para `tipo`:

- `comprador`
- `artesao`

#### Resposta de sucesso — 201

```json
{
  "sucesso": true,
  "dados": {
    "id": "u9",
    "nome": "Usuário Exemplo",
    "email": "usuario@exemplo.com",
    "tipo": "comprador"
  }
}
```

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

## 5. Artesãos

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
| 404 | Recurso não encontrado |
| 409 | Conflito, como e-mail já cadastrado |
| 500 | Erro interno do servidor |

## 9. Observação sobre a versão atual

Atualmente, apenas a rota HTTP de recomendações está implementada de forma real no App Router do Next.js. Produtos, artesãos, pedidos, carrinho e usuários ainda utilizam mocks, Context API e `localStorage`.

Este contrato serve para deixar combinado como o frontend deverá conversar com o backend quando essas integrações forem implementadas, reduzindo divergências entre as partes do projeto.
