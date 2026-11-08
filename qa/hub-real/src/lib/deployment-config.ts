export const STAGING_PROJECT = 'mdqlgwnggbkgmplgkebd';
const SOURCE_PROJECT = 'nhgehigwwxcqsovjzxch';
export function readDeploymentConfig(env: Record<string, unknown>) {
  const stage = env.VITE_DEPLOYMENT_STAGE;
  const ref = env.VITE_APPROVED_PROJECT_REF;
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!['staging', 'production'].includes(String(stage)) || typeof ref !== 'string' || !/^[a-z]{20}$/.test(ref) || ref === SOURCE_PROJECT ||
      url !== `https://${ref}.supabase.co` || env.VITE_SUPABASE_PROJECT_ID !== ref ||
      typeof key !== 'string' || !key.startsWith('sb_publishable_') || key.length < 25 || /REPLACE|PLACEHOLDER|EXAMPLE|\s/i.test(key)) throw Error('DEPLOYMENT_CONFIGURATION_NOT_APPROVED');
  if (stage === 'staging' && ref !== STAGING_PROJECT) throw Error('STAGING_TARGET_NOT_APPROVED');
  return { stage, projectRef: ref, url: url as string, publishableKey: key };
}
