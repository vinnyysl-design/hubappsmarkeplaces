# Integração de Apps Externos com o HUB Analytical X

O HUB centraliza autenticação e controle de acesso para os 9 apps. Cada app
externo (hospedado em seu próprio site Netlify) **não pode confiar apenas
na existência do token** — ele precisa validar o usuário contra o HUB a
cada carregamento.

## 1. URLs importantes

- **HUB (frontend)**: `https://hubappsmarkeplaces.lovable.app`
- **Endpoint de validação**: `https://hubappsmarkeplaces.lovable.app/api/validate-user`
- **Tela de login do HUB**: `https://hubappsmarkeplaces.lovable.app/auth`

> Quando publicar em um domínio próprio, troque a base URL acima.

## 2. Fluxo recomendado

1. Usuário faz login no HUB (`/auth`).
2. O HUB salva o `access_token` do Supabase em `localStorage`
   (chave `analyticalx.access_token`) **e** mantém a sessão Supabase ativa.
3. Ao abrir um app externo, o app:
   - Lê o token (do seu próprio localStorage ou recebido via URL/postMessage).
   - Faz **POST** para `/api/validate-user` do HUB com o header
     `Authorization: Bearer <token>`.
   - Se a resposta for **200**, libera o conteúdo.
   - Se for **401** ou **403**, faz logout e redireciona para a tela de
     login do HUB.

## 3. Respostas do endpoint

| Status | Significado                  | Ação no app externo               |
| ------ | ---------------------------- | --------------------------------- |
| 200    | Usuário válido e ativo       | Libera acesso                     |
| 401    | Token inválido / não existe  | Redireciona para login do HUB     |
| 403    | Usuário **bloqueado**        | Logout + redireciona para login   |
| 500    | Erro de configuração/servidor| Mostra erro genérico, tente de novo |

Exemplo de payload de sucesso:

```json
{
  "valid": true,
  "user": {
    "id": "uuid-do-usuario",
    "email": "fulano@empresa.com",
    "status": "ativo",
    "role": "user"
  }
}
```

## 4. Snippet pronto para copiar (JS puro)

```js
const HUB_VALIDATE_URL =
  "https://hubappsmarkeplaces.lovable.app/api/validate-user";
const HUB_LOGIN_URL = "https://hubappsmarkeplaces.lovable.app/auth";
const TOKEN_KEY = "analyticalx.access_token";

async function ensureAccess() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return redirectToLogin();

  try {
    const res = await fetch(HUB_VALIDATE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 200) return true;
    return redirectToLogin();
  } catch {
    return redirectToLogin();
  }
}

function redirectToLogin() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = HUB_LOGIN_URL;
  return false;
}

// Chame ANTES de renderizar qualquer conteúdo protegido:
ensureAccess();
```

## 5. Variáveis de ambiente necessárias no Netlify do HUB

Configure em **Site settings → Environment variables**:

- `SUPABASE_URL` — URL do projeto Supabase (igual ao `VITE_SUPABASE_URL`).
- `SUPABASE_SERVICE_ROLE_KEY` — chave service-role.
  **Nunca** exponha no frontend, **nunca** commit no repositório.

Sem essas variáveis a function retorna `500 server_misconfigured`.

## 6. Regras de segurança (não negociáveis)

- Apps externos **nunca** devem ter a `SUPABASE_SERVICE_ROLE_KEY`.
- Apps externos **nunca** devem decidir acesso só pela presença de token.
- Bloqueio de usuário tem efeito imediato: na próxima validação o app
  recebe `403` e desloga o usuário.
- O endpoint `/api/validate-user` aceita CORS aberto (`*`) porque cada
  app externo está em um domínio diferente; a segurança vem do token,
  não da origem.
