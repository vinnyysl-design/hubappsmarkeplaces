import { describe, it, expect } from 'vitest';
import { readDeploymentConfig, STAGING_PROJECT } from '../lib/deployment-config';
const good = {VITE_DEPLOYMENT_STAGE:'staging',VITE_APPROVED_PROJECT_REF:STAGING_PROJECT,VITE_SUPABASE_PROJECT_ID:STAGING_PROJECT,VITE_SUPABASE_URL:`https://${STAGING_PROJECT}.supabase.co`,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_offline_validation_value'};
describe('owned deployment configuration', () => {
  it('accepts an explicitly mapped staging target', () => {expect(readDeploymentConfig(good).projectRef).toBe(STAGING_PROJECT);});
  it('fails closed when configuration or approval is missing', () => {expect(()=>readDeploymentConfig({})).toThrow();});
  it('rejects project/key mismatches, placeholders and secrets', () => {
    for (const change of [{VITE_SUPABASE_PROJECT_ID:'other'},{VITE_SUPABASE_URL:'https://example.invalid'},{VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_NEVER_FRONTEND'},{VITE_SUPABASE_PUBLISHABLE_KEY:'REPLACE_WITH_PUBLIC_KEY'},{VITE_DEPLOYMENT_STAGE:'preview'}]) expect(()=>readDeploymentConfig({...good,...change})).toThrow();
  });
  it('rejects restored production as an accidental staging target', () => {
    const ref='ihhddmiboopesqlkifvz';expect(()=>readDeploymentConfig({...good,VITE_APPROVED_PROJECT_REF:ref,VITE_SUPABASE_PROJECT_ID:ref,VITE_SUPABASE_URL:`https://${ref}.supabase.co`})).toThrow();
  });
  it('never accepts the former source project', () => {
    const ref='nhgehigwwxcqsovjzxch';expect(()=>readDeploymentConfig({...good,VITE_DEPLOYMENT_STAGE:'production',VITE_APPROVED_PROJECT_REF:ref,VITE_SUPABASE_PROJECT_ID:ref,VITE_SUPABASE_URL:`https://${ref}.supabase.co`})).toThrow();
  });
});
