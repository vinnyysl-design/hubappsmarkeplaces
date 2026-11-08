// Telemetry never needs session/query/hash or partner bearer capabilities.
export function safeTrackingPath(path: string): string {
  const clean = path.split(/[?#]/, 1)[0];
  if (!clean.startsWith('/')) return '/';
  return clean.startsWith('/parceiro/') ? '/parceiro/[redacted]' : clean;
}
export function safeReferrer(raw: string): string | null {
  try { const u=new URL(raw); return /^https?:$/.test(u.protocol)?u.origin:null; }
  catch { return null; }
}
export function safeToolUrl(raw?: string | null): string | null {
  try { const u=new URL(raw??''); return /^https?:$/.test(u.protocol)?u.origin+safeTrackingPath(u.pathname):null; }
  catch { return null; }
}
