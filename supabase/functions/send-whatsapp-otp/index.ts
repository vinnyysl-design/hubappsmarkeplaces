// Edge Function: send-whatsapp-otp
// Gera um código de 6 dígitos, salva hash + expiração na tabela otp_codes,
// e envia via SMS pelo Twilio para o telefone informado.

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

function normalizeTwilioPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const stripped = value.replace(/^whatsapp:/i, "").trim();
  const digits = stripped.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `+${digits}`;
}

type TwilioMessageResponse = {
  sid?: string;
  status?: string;
  code?: number | null;
  error_code?: number | null;
  error_message?: string | null;
};

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
  const TWILIO_SMS_FROM = normalizeTwilioPhone(Deno.env.get("TWILIO_SMS_FROM"));
  const TWILIO_WHATSAPP_FROM = normalizeTwilioPhone(Deno.env.get("TWILIO_WHATSAPP_FROM"));

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
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
    .is("consumed_at", null)
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

  // Envia via SMS usando um número Twilio com capacidade de SMS.
  const to = `+${phone}`;
  const msg = `Analytical X: seu código de verificação é ${code}. Expira em 5 minutos. Não compartilhe com ninguém.`;

  const gwUrl = "https://connector-gateway.lovable.dev/twilio/Messages.json";
  const listNumbersUrl = "https://connector-gateway.lovable.dev/twilio/IncomingPhoneNumbers.json?PageSize=20";

  const invalidateCurrentCode = async () => {
    await admin
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("phone", phone)
      .is("consumed_at", null);
  };

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

    let payload: TwilioMessageResponse | null = null;
    try {
      payload = JSON.parse(text) as TwilioMessageResponse;
    } catch {
      payload = null;
    }

    const twilioErrorCode = payload?.error_code ?? payload?.code ?? null;
    const twilioStatus = payload?.status ?? null;
    const accepted =
      response.ok &&
      !["failed", "undelivered", "canceled"].includes(twilioStatus ?? "") &&
      twilioErrorCode == null;

    return {
      ok: accepted,
      status: response.status,
      text,
      fromAddress,
      payload,
      twilioErrorCode,
      twilioStatus,
    };
  };

  const resolveSmsFromNumber = async () => {
    const response = await fetch(listNumbersUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
      },
    });

    const text = await response.text();
    let payload: {
      incoming_phone_numbers?: Array<{
        phone_number?: string | null;
        capabilities?: { sms?: boolean | null } | null;
      }>;
    } | null = null;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        error: "sms_sender_lookup_failed",
        hint: text || "Não foi possível listar os números SMS da conta.",
      };
    }

    const smsNumbers = (payload?.incoming_phone_numbers ?? [])
      .filter((item) => item.capabilities?.sms && item.phone_number)
      .map((item) => normalizeTwilioPhone(item.phone_number))
      .filter((item): item is string => Boolean(item));

    const preferredFrom = [TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM]
      .filter((item): item is string => Boolean(item))
      .find((item) => smsNumbers.includes(item));

    const selectedFrom = preferredFrom ?? smsNumbers[0] ?? null;

    if (!selectedFrom) {
      return {
        ok: false,
        error: "sms_sender_not_available",
        hint: "Nenhum número com capacidade de SMS foi encontrado na conta conectada.",
      };
    }

    return { ok: true, from: selectedFrom };
  };

  const waitForTerminalStatus = async (sid: string) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages/${sid}.json`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
        },
      });

      const text = await response.text();
      let payload: TwilioMessageResponse | null = null;
      try {
        payload = JSON.parse(text) as TwilioMessageResponse;
      } catch {
        payload = null;
      }

      const twilioErrorCode = payload?.error_code ?? payload?.code ?? null;
      const twilioStatus = payload?.status ?? null;

      if (!response.ok || twilioErrorCode != null || ["failed", "undelivered", "canceled"].includes(twilioStatus ?? "")) {
        return { ok: false, status: response.status, text, payload, twilioErrorCode, twilioStatus };
      }

      if (twilioStatus && !["queued", "accepted", "sending", "scheduled"].includes(twilioStatus)) {
        return { ok: true, status: response.status, text, payload, twilioErrorCode, twilioStatus };
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    return null;
  };

  const fromResult = await resolveSmsFromNumber();
  if (!fromResult.ok) {
    await invalidateCurrentCode();
    return json(200, { error: fromResult.error, hint: fromResult.hint });
  }

  const twilioResult = await sendTwilioMessage(fromResult.from);

  if (twilioResult.ok && twilioResult.payload?.sid) {
    const finalStatus = await waitForTerminalStatus(twilioResult.payload.sid);
    if (finalStatus && !finalStatus.ok) {
      twilioResult = {
        ...twilioResult,
        ok: false,
        status: finalStatus.status,
        text: finalStatus.text,
        payload: finalStatus.payload,
        twilioErrorCode: finalStatus.twilioErrorCode,
        twilioStatus: finalStatus.twilioStatus,
      };
    }
  }

  if (!twilioResult.ok) {
    await invalidateCurrentCode();

    console.error(
      "[send-whatsapp-otp] sms error",
      twilioResult.status,
      twilioResult.twilioErrorCode,
      twilioResult.twilioStatus,
      twilioResult.text,
    );

    return json(200, {
      error: "twilio_error",
      status: twilioResult.status,
      details: twilioResult.text,
      hint: twilioResult.payload?.error_message ?? "O provedor recusou a entrega da mensagem.",
    });
  }

  return json(200, { ok: true, expires_at: expiresAt });
});
