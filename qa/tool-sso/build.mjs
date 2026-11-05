import {readFile,mkdir,writeFile} from 'node:fs/promises';
// Context is non-secret platform metadata. Never inspect environment wholesale.
if(process.env.CONTEXT!=='deploy-preview')throw Error('QA_PREVIEW_ONLY');
const {qaRole}=JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8'));
if(!['Hub','AdsEngine'].includes(qaRole))throw Error('INVALID_QA_ROLE');
await mkdir(new URL('./dist/',import.meta.url),{recursive:true});
await writeFile(new URL('./dist/index.html',import.meta.url),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${qaRole} — homologação privada</title><main><h1>${qaRole}: homologação privada do login único</h1><p>Ambiente preparado. Passagem de identidade ainda bloqueada.</p><p>Não informe senha nesta página. Nenhuma análise, arquivo, cobrança ou histórico é acessado.</p><p>Falta validar as origens e os controles do servidor antes do teste de sessão.</p></main></html>`);
await writeFile(new URL('./dist/version.json',import.meta.url),JSON.stringify({role:qaRole,stage:'private-sso-foundation',identityEnabled:false,dataEnabled:false,storageEnabled:false,billingEnabled:false}));
await writeFile(new URL('./dist/_headers',import.meta.url),`/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\n`);
