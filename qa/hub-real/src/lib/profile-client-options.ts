export function profileClientOptions(token: string) {
  if(typeof token!=='string'||!token.trim())throw new Error('SESSION_SNAPSHOT_REQUIRED');
  const snapshot=token;
  return {
    accessToken:async()=>snapshot,
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  };
}
