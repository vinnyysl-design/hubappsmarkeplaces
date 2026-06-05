// Edge Function: verify-otp
// Valida o código de 6 dígitos recebido por WhatsApp.
// Em caso de sucesso: marca profile.phone_verified=true e inicia o trial.

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "missing_token" });

  const tmp = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await tmp.auth.getUser(token);
  if (userErr || !userData.user) return json(401, { error: "invalid_token" });
  const userId = userData.user.id;

  let body: { code?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const code = (body.code ?? "").trim();
  const phone = normalizePhone(body.phone ?? "");
  if (!/^\d{6}$/.test(code)) return json(400, { error: "invalid_code_format" });
  if (phone.length < 10) return json(400, { error: "invalid_phone" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Busca código mais recente não consumido para esse usuário+telefone
  const { data: rows, error: selErr } = await admin
    .from("otp_codes")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("user_id", userId)
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (selErr) return json(500, { error: "db_error" });
  const row = rows?.[0];
  if (!row) return json(400, { error: "no_active_code" });

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    return json(400, { error: "code_expired" });
  }

  if (row.attempts >= 5) {
    await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    return json(429, { error: "too_many_attempts" });
  }

  const submittedHash = await sha256Hex(code);
  if (submittedHash !== row.code_hash) {
    await admin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return json(400, { error: "invalid_code", remaining: 5 - (row.attempts + 1) });
  }

  // Sucesso — marca consumido e ativa o perfil
  await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  const { error: rpcErr } = await admin.rpc("mark_phone_verified", {
    _user_id: userId,
    _phone: phone,
  });

  if (rpcErr) {
    const msg = rpcErr.message || "";
    if (msg.includes("phone_in_use")) return json(409, { error: "phone_in_use" });
    return json(500, { error: "activation_failed", message: msg });
  }

  return json(200, { ok: true });
});
