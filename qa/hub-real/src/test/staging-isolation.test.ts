import {it,expect} from 'vitest';
import {stagingRequestAllowed} from '../lib/staging-isolation';
it('allows only isolated QA core reads and validated access flows',()=>{
  expect(stagingRequestAllowed(new URL('https://mdqlgwnggbkgmplgkebd.supabase.co/rest/v1/profiles'),'GET')).toBe(true);
  expect(stagingRequestAllowed(new URL('https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/token?grant_type=password'),'POST')).toBe(true);
});
it('blocks production, email, signup, payments and external integrations',()=>{
  for(const url of ['https://ihhddmiboopesqlkifvz.supabase.co/rest/v1/profiles','https://nhgehigwwxcqsovjzxch.supabase.co/rest/v1/profiles','https://api.mercadopago.com/','https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/recover','https://mdqlgwnggbkgmplgkebd.supabase.co/auth/v1/signup','https://mdqlgwnggbkgmplgkebd.supabase.co/functions/v1/create-mp-preference'])expect(stagingRequestAllowed(new URL(url),'POST')).toBe(false);
});
