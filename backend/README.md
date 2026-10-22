# Backend Raízes PE (Express + TypeScript)

API REST independente do app Next. Requer Node.js 18 ou superior. Todos os comandos rodam dentro da pasta `backend/`.

## Instalar

```bash
cd backend
npm install
```

Opcional: crie o `.env` a partir do modelo (sem ele, valem `PORT=4000` e `NODE_ENV=development`).

```bash
# Windows (cmd)
copy .env.example .env
# Mac/Linux
cp .env.example .env
```

## Rodar em desenvolvimento (recarrega ao salvar)

```bash
npm run dev
```

## Compilar e rodar a versão compilada

```bash
npm run typecheck
npm run build
npm start
```

O `build` gera o JavaScript em `backend/dist/`.

## Testar a rota de saúde

Com o servidor rodando, abra <http://localhost:4000/api/saude> no navegador ou rode:

```bash
curl.exe http://localhost:4000/api/saude
```

Resposta esperada (status 200): `{"ok":true}`. No PowerShell, use `curl.exe`, e não `curl`, que é um apelido do `Invoke-WebRequest`.
