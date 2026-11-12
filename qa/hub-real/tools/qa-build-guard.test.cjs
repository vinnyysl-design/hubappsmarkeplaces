const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const valid={CONTEXT:'deploy-preview',REVIEW_ID:'1',SITE_ID:'c8274cfa-e417-4e1a-a33a-fb4f112e5f3f',DEPLOY_PRIME_URL:'https://deploy-preview-1--analyticalxhub.netlify.app'};
const cases=[{}, {...valid,CONTEXT:'production'}, {...valid,REVIEW_ID:'2'}, {...valid,SITE_ID:'other'}, {...valid,DEPLOY_PRIME_URL:'https://analyticalxhub.netlify.app'}];
for(const env of cases){const r=spawnSync(process.execPath,['build-qa.cjs'],{cwd:root,env:{SystemRoot:process.env.SystemRoot,...env},encoding:'utf8'});if(r.status===0||!r.stderr.includes('QA_PREVIEW_SCOPE_REQUIRED'))throw Error('GUARD_FAILED');}
console.log('5 build-denial cases passed');
