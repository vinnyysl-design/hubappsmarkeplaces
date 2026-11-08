const {build}=require('./tools/staging-build.cjs');
const fs=require('node:fs'),path=require('node:path');
const origin='https://deploy-preview-1--analyticalxhub.netlify.app';
if(process.env.CONTEXT!=='deploy-preview'||process.env.REVIEW_ID!=='1'||process.env.SITE_ID!=='c8274cfa-e417-4e1a-a33a-fb4f112e5f3f'||process.env.DEPLOY_PRIME_URL!==origin)throw Error('QA_PREVIEW_SCOPE_REQUIRED');
const gate=fs.readFileSync(path.join(__dirname,'src/lib/qa-tool-bridge.ts'),'utf8');
if(!gate.includes('enabled: false, ownerId: null, windowStart: 0, windowEnd: 0'))throw Error('QA_MUST_REMAIN_CLOSED');
(async()=>{
 await build({stage:'staging',projectRef:'mdqlgwnggbkgmplgkebd',supabaseUrl:'https://mdqlgwnggbkgmplgkebd.supabase.co',publishableKey:'sb_publishable_niqCH59CqrrGi5QHLGrL-g_qSpWnNYD',frontendOrigin:origin,readOnly:true,externalIntegrations:'disabled',signup:'disabled'},{app:__dirname});
 fs.writeFileSync(path.join(__dirname,'dist-staging/version.json'),JSON.stringify({app:'hub',stage:'qa-real-ui-v3-closed',commit:process.env.COMMIT_REF||null,ssoEnabled:false,billingEnabled:false,frameEnabled:false}));
})().catch(()=>{console.error('CLOSED_QA_BUILD_FAILED');process.exitCode=1});
