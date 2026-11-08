// Fingerprint leve baseado em propriedades estáveis do navegador.
// Não é à prova de balas, mas detecta a maioria dos casos de criação de
// múltiplas contas no mesmo dispositivo sem exigir biblioteca externa.

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("AnalyticalX-fp-🔒", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("AnalyticalX-fp-🔒", 4, 17);
    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  const parts: string[] = [
    navigator.userAgent ?? "",
    navigator.language ?? "",
    (navigator.languages ?? []).join(","),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    String(navigator.hardwareConcurrency ?? 0),
    String((navigator as any).deviceMemory ?? 0),
    String(navigator.platform ?? ""),
    canvasFingerprint(),
  ];
  return sha256(parts.join("|"));
}
