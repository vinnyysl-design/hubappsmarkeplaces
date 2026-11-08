// Build/check only; never starts a server, publishes or calls Supabase.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
function validate(c) {
  if(c.stage!=='staging'||c.projectRef!=='mdqlgwnggbkgmplgkebd'||c.supabaseUrl!==`https://${c.projectRef}.supabase.co`||c.readOnly!==true||c.externalIntegrations!=='disabled'||c.signup!=='disabled')throw Error('STAGING_SCOPE_NOT_APPROVED');
  if(typeof c.publishableKey!=='string'||!c.publishableKey.startsWith('sb_publishable_')||/REPLACE|PLACEHOLDER|EXAMPLE|\s/i.test(c.publishableKey))throw Error('PUBLIC_STAGING_KEY_REQUIRED');
  const origin=new URL(c.frontendOrigin);
  if(origin.origin!==c.frontendOrigin||origin.username||origin.password||!['https:','http:'].includes(origin.protocol)||(origin.protocol==='http:'&&origin.hostname!=='127.0.0.1'))throw Error('STAGING_ORIGIN_REQUIRED');
  if(['hub.analyticalx.com.br','analyticalxhub.netlify.app'].includes(origin.hostname))throw Error('LIVE_HOST_NOT_ALLOWED_AS_STAGING');
  if(c.qaFrameOrigins !== undefined && JSON.stringify(c.qaFrameOrigins)!==JSON.stringify(["https://deploy-preview-1--adsenginee.netlify.app","https://deploy-preview-1--visionxagent.netlify.app"]))throw Error("UNAPPROVED_FRAME_ORIGINS");
  return c;
}
async function build(c,{app=path.resolve(__dirname,'..'),dependencyRoot}={}) {
  validate(c);
  process.chdir(app);
  const req=createRequire(path.join(dependencyRoot?path.resolve(dependencyRoot,'..'):app,'package.json'));
  const vite=await import(pathToFileURL(path.join(path.dirname(req.resolve('vite/package.json')),'dist/node/index.js')).href);
  const pluginModule=await import(pathToFileURL(req.resolve('@vitejs/plugin-react-swc')).href);
  const react=pluginModule.default??pluginModule;
  // Resolves the already-installed, read-only toolchain during local validation;
  // exported app works with its own normal node_modules after a clean CI install.
  const anchor=path.join(dependencyRoot?path.resolve(dependencyRoot,'..'):app,'__dependency_anchor__.ts');
  const base=await vite.resolveConfig({root:path.dirname(anchor),configFile:false,envDir:false},'build');
  const resolve=base.createResolver();
  const defs={VITE_DEPLOYMENT_STAGE:'staging',VITE_APPROVED_PROJECT_REF:c.projectRef,VITE_SUPABASE_PROJECT_ID:c.projectRef,VITE_SUPABASE_URL:c.supabaseUrl,VITE_SUPABASE_PUBLISHABLE_KEY:c.publishableKey};
  await vite.build({root:app,configFile:false,envDir:false,envPrefix:'AX_DISABLED_ENV_PREFIX_',plugins:[react(),{name:'existing-local-dependencies',enforce:'pre',async resolveId(id){if(!dependencyRoot||id.startsWith('.')||id.startsWith('/')||id.startsWith('\0')||id.startsWith('@/')||id.startsWith('vite/'))return null;return await resolve(id,anchor);}}],resolve:{alias:{'@':path.join(app,'src')}},define:Object.fromEntries(Object.entries(defs).map(([k,v])=>[`import.meta.env.${k}`,JSON.stringify(v)])),build:{outDir:'dist-staging',emptyOutDir:true,sourcemap:false}});
  const headers=`/*\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'self'; connect-src 'self' ${c.supabaseUrl}; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; frame-src ${c.qaFrameOrigins ? c.qaFrameOrigins.join(" ") : "'none'"}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'\n`;
  fs.writeFileSync(path.join(app,'dist-staging/_headers'),headers);
  fs.writeFileSync(path.join(app,'dist-staging/_redirects'),'/* /index.html 200\n');
}
module.exports={validate,build};
if(require.main===module)(async()=>{
  const args=process.argv.slice(2);
  const c=args[0]==='--from-env'?{stage:'staging',projectRef:process.env.VITE_APPROVED_PROJECT_REF,supabaseUrl:process.env.VITE_SUPABASE_URL,publishableKey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY,frontendOrigin:process.env.STAGING_APPROVED_ORIGIN,readOnly:true,externalIntegrations:'disabled',signup:'disabled'}:JSON.parse(fs.readFileSync(path.resolve(args[0]??'config/staging.example.json'),'utf8'));
  validate(c);if(args.includes('--check')){console.log('STAGING_CONFIG_VALID_NO_EXTERNAL_CALLS');return;}
  const index=args.indexOf('--dependency-root');await build(c,{dependencyRoot:index>=0?args[index+1]:undefined});
})().catch(()=>{console.error('STAGING_CONFIGURATION_OR_BUILD_BLOCKED');process.exitCode=2;});

