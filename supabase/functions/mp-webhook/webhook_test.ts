/**
 * Integração: valida que o HUB_WEBHOOK_SECRET configurado no Hub bate
 * com o segredo no gerador de imagens.
 *
 * Envia um POST assinado (HMAC-SHA256) para o endpoint público de créditos
 * usando um event_id de teste. O gerador deve aceitar (200) ou responder
 * de forma que confirme a assinatura válida.
 */

import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const IMAGE_TOOL_WEBHOOK =
  "https://geradordeimagens.analyticalx.com.br/api/public/hub/credits";

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("HUB_WEBHOOK_SECRET está configurado no Hub", () => {
  const secret = Deno.env.get("HUB_WEBHOOK_SECRET");
  assert(secret && secret.length > 10, "HUB_WEBHOOK_SECRET ausente");
});

Deno.test("Assinatura HMAC é aceita pelo gerador de imagens (assinatura válida)", async () => {
  const secret = Deno.env.get("HUB_WEBHOOK_SECRET")!;
  const payload = {
    event_id: `hub-selftest-${Date.now()}`,
    email: "selftest@analyticalx.com.br",
    uses: 0, // 0 usos = ping/self-test, não credita nada
  };
  const body = JSON.stringify(payload);
  const signature = await hmacHex(secret, body);

  const res = await fetch(IMAGE_TOOL_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature": signature,
    },
    body,
  });
  const text = await res.text();
  console.log("Gerador respondeu:", res.status, text);

  // 401/403 = assinatura recusada -> segredo diferente entre os dois lados
  assert(
    res.status !== 401 && res.status !== 403,
    `Assinatura recusada pelo gerador (HTTP ${res.status}): ${text}`,
  );
});

Deno.test("Assinatura inválida é recusada pelo gerador", async () => {
  const payload = {
    event_id: `hub-selftest-bad-${Date.now()}`,
    email: "selftest@analyticalx.com.br",
    uses: 1,
  };
  const body = JSON.stringify(payload);
  const badSignature = "0".repeat(64);

  const res = await fetch(IMAGE_TOOL_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature": badSignature,
    },
    body,
  });
  const text = await res.text();
  console.log("Resposta a assinatura inválida:", res.status, text);
  // esperamos rejeição (401/403) — se aceitar, o gerador não está validando
  assert(res.status >= 400, `Gerador aceitou assinatura inválida: ${res.status}`);
});
