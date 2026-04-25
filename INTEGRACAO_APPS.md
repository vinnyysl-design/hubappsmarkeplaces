# Integração de Apps Externos com o HUB Analytical X

O HUB centraliza autenticação e controle de acesso para os 9 apps. Cada app
externo **não pode confiar apenas na existência do token** — ele precisa
validar o usuário contra o endpoint central a cada carregamento.

## 1. URLs importantes

- **HUB (frontend)**: `https://hub.analyticalx.com.br` (ou `https://hub-analyticalx-com-br.lovable.app`)
- **Tela de login do HUB**: `https://hub.analyticalx.com.br/auth`
- **Endpoint de validação (Edge Function)**:
  ```
  https://nhgehigwwxcqsovjzxch.supabase.co/functions/v1/validate-user
  ```

> O endpoint é público (não exige JWT do Supabase) — ele valida o token
> que você envia no header `Authorization`.

## 2. Fluxo recomendado

1. Usuário faz login no HUB (`/auth`).
2. O HUB salva o `access_token` do Supabase em `localStorage`
   (chave `analyticalx.access_token`) e mantém a sessão Supabase ativa.
3. Ao abrir um app externo, o app:
   - Lê o token (do próprio `localStorage` ou recebido via URL/postMessage do HUB).
   - Faz **POST** para o endpoint de validação com o header
     `Authorization: Bearer <token>`.
   - Se a resposta for **200**, libera o conteúdo.
   - Se for **401** ou **403**, faz logout e redireciona para o login do HUB.

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

## 4. Snippet pronto (JavaScript) para um app externo

```js
const HUB_LOGIN_URL = "https://hub.analyticalx.com.br/auth";
const VALIDATE_URL =
  "https://nhgehigwwxcqsovjzxch.supabase.co/functions/v1/validate-user";
const TOKEN_KEY = "analyticalx.access_token";

export async function ensureAccessOrRedirect() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = HUB_LOGIN_URL;
    return;
  }

  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (res.status === 200) return; // OK, segue o app
    // 401 / 403 / 500 → derruba a sessão local e manda pro login
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = HUB_LOGIN_URL;
  } catch {
    // erro de rede: por segurança, manda pro login
    window.location.href = HUB_LOGIN_URL;
  }
}
```

Chame `ensureAccessOrRedirect()` no boot do app externo (antes de
renderizar qualquer conteúdo protegido).

## 5. Por que não usar Netlify Functions?

A validação roda como **Edge Function gerenciada pelo Lovable Cloud**, então:

- Funciona no preview do Lovable, em qualquer domínio (`*.lovable.app`,
  domínio customizado, Netlify, Vercel...).
- A `SUPABASE_SERVICE_ROLE_KEY` fica protegida no servidor — você **não
  precisa** configurar nada manualmente.
- CORS já vem liberado (`Access-Control-Allow-Origin: *`).
