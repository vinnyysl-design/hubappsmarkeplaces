// Public build configuration only. No .env, keys, network or deployment access.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
try {
  const ts=require('typescript');
  const source=fs.readFileSync(path.join(__dirname,'../src/lib/deployment-config.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports});
  const names=['VITE_DEPLOYMENT_STAGE','VITE_APPROVED_PROJECT_REF','VITE_SUPABASE_PROJECT_ID','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'];
  exports.readDeploymentConfig(Object.fromEntries(names.map(k=>[k,process.env[k]])));
  console.log('PUBLIC_DEPLOYMENT_CONFIGURATION_VALID');
} catch {console.error('BUILD_BLOCKED_UNAPPROVED_DEPLOYMENT_CONFIGURATION');process.exitCode=2;}
