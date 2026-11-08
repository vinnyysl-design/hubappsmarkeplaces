import {readDeploymentConfig} from '@/lib/deployment-config';
import {createClient} from '@supabase/supabase-js';
import type {Database} from './types';
import {profileClientOptions} from '@/lib/profile-client-options';
// Dedicated nonpersistent client with immutable caller credentials. Never use
// the current global session to continue work queued for a different user.
export function createProfileClient(token: string) {
  const deployment=readDeploymentConfig(import.meta.env);
  return createClient<Database>(deployment.url,deployment.publishableKey,profileClientOptions(token));
}
