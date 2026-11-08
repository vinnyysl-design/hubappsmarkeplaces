const {build}=require('./tools/staging-build.cjs');
const fs=require('node:fs'),path=require('node:path');
const origin='https://deploy-preview-1--analyticalxhub.netlify.app';
if(process.env.CONTEXT!=='deploy-preview'||process.env.REVIEW_ID!=='1'||process.env.SITE_ID!=='c8274cfa-e417-4e1a-a33a-fb4f112e5f3f'||process.env.DEPLOY_PRIME_URL!==origin)throw Error('QA_PREVIEW_SCOPE_REQUIRED');
const {validateQaWindow}=require('./tools/qa-window.cjs');
const windowConfig=validateQaWindow(JSON.parse(fs.readFileSync(path.join(__dirname,'qa-window.json'),'utf8').replace(/^\uFEFF/,'')));
(async()=>{
 await build({stage:'staging',projectRef:'mdqlgwnggbkgmplgkebd',supabaseUrl:'https://mdqlgwnggbkgmplgkebd.supabase.co',publishableKey:'sb_publishable_niqCH59CqrrGi5QHLGrL-g_qSpWnNYD',frontendOrigin:origin,readOnly:true,externalIntegrations:'disabled',signup:'disabled'},{app:__dirname});
 fs.writeFileSync(path.join(__dirname,'dist-staging/version.json'),JSON.stringify({app:'hub',stage:windowConfig.enabled?'qa-v3-owner-window':'qa-real-ui-v3-closed',commit:process.env.COMMIT_REF||null,ssoEnabled:windowConfig.enabled,billingEnabled:false,frameEnabled:false,transport:"popup",windowStart:windowConfig.windowStart,windowEnd:windowConfig.windowEnd}));
})().catch(()=>{console.error('CLOSED_QA_BUILD_FAILED');process.exitCode=1});


