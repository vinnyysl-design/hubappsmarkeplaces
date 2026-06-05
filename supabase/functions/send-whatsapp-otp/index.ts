// Edge Function: send-whatsapp-otp
// Gera um código de 6 dígitos, salva hash + expiração na tabela otp_codes,
// e envia via Twilio WhatsApp para o telefone informado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(p: string): string {
  return (p || "").replace(/[^0-9]/g, "");
}

const TWILIO_WHATSAPP_SANDBOX_FROM = "whatsapp:+14155238886";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM"); // ex: whatsapp:+14155238886

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_WHATSAPP_FROM) {
    return json(500, { error: "twilio_not_configured" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "missing_token" });

  // Valida usuário
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: "invalid_token" });
  const userId = userData.user.id;

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  let phone = normalizePhone(body.phone ?? "");
  // Auto-adiciona DDI 55 se for um número BR (10 ou 11 dígitos sem código do país)
  if ((phone.length === 10 || phone.length === 11) && !phone.startsWith("55")) {
    phone = "55" + phone;
  }
  if (phone.length < 11 || phone.length > 15) {
    return json(400, { error: "invalid_phone" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Telefone já vinculado a outra conta?
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .neq("id", userId)
    .maybeSingle();
  if (existing) return json(409, { error: "phone_in_use" });

  // Rate-limit simples: máximo 1 código por minuto por usuário
  const { data: recent } = await admin
    .from("otp_codes")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1);
  if (recent && recent.length > 0) {
    return json(429, { error: "rate_limited", message: "Aguarde 1 minuto antes de pedir outro código." });
  }

  // Gera código 6 dígitos
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  // Invalida códigos anteriores não usados
  await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("consumed_at", null);

  const { error: insErr } = await admin.from("otp_codes").insert({
    user_id: userId,
    phone,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (insErr) return json(500, { error: "db_error", message: insErr.message });

  // Envia via Twilio WhatsApp (gateway Lovable)
  // Garante prefixo "whatsapp:" tanto no From quanto no To (erro 21910 do Twilio)
  const from = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM
    : `whatsapp:${TWILIO_WHATSAPP_FROM.startsWith("+") ? "" : "+"}${TWILIO_WHATSAPP_FROM}`;
  const to = `whatsapp:+${phone}`;
  const msg = `Analytical X: seu código de verificação é ${code}. Expira em 5 minutos. Não compartilhe com ninguém.`;

  const gwUrl = "https://connector-gateway.lovable.dev/twilio/Messages.json";

  const sendTwilioMessage = async (fromAddress: string) => {
    const form = new URLSearchParams({
      To: to,
      From: fromAddress,
      Body: msg,
    });

    const response = await fetch(gwUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const text = await response.text();
    return { ok: response.ok, status: response.status, text, fromAddress };
  };

  let twilioResult = await sendTwilioMessage(from);

  if (!twilioResult.ok && twilioResult.text.includes('"code":63007') && from !== TWILIO_WHATSAPP_SANDBOX_FROM) {
    console.warn("[send-whatsapp-otp] configured sender not found, retrying with Twilio WhatsApp sandbox");
    twilioResult = await sendTwilioMessage(TWILIO_WHATSAPP_SANDBOX_FROM);
  }

  if (!twilioResult.ok) {
    console.error("[send-whatsapp-otp] twilio error", twilioResult.status, twilioResult.text);
    return json(502, {
      error: "twilio_error",
      status: twilioResult.status,
      details: twilioResult.text,
      hint: twilioResult.text.includes('"code":63007')
        ? "O remetente WhatsApp configurado não existe nesta conta Twilio. Use um sender WhatsApp aprovado ou entre no sandbox do Twilio antes do teste."
        : undefined,
    });
  }

  return json(200, { ok: true, expires_at: expiresAt });
});
