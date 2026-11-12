import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';import {mkdir,writeFile,cp} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(import.meta.dirname,'dist');await mkdir(out,{recursive:true});
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();

await build({entryPoints:[path.join(import.meta.dirname,'entry.tsx')],bundle:true,outfile:out+'/app.js',minify:true,external:['/materials/*'],jsx:'automatic',alias:{'@':root+'/src'},loader:{'.woff2':'file'}});
await cp(root+'/public',out,{recursive:true});
await writeFile(out+'/index.html','<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TriMap · 光谱</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
await writeFile(out+'/_routes.json',JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await build({entryPoints:[path.join(import.meta.dirname,'worker.ts')],bundle:true,outfile:out+'/_worker.js',format:'esm',define:{BUILD_REVISION:JSON.stringify(revision)},platform:'node',target:'es2022',external:['node:*'],alias:{'next/server':root+'/cloudflare/server.ts','@/lib/storage':root+'/cloudflare/storage.ts','@/lib/auth':root+'/cloudflare/auth.ts','@':root+'/src'}});

await writeFile(out+'/_headers','/app.js\n  Cache-Control: no-cache\n/app.css\n  Cache-Control: no-cache\n/\n  Cache-Control: no-cache\n');
await writeFile(out+'/release.json',JSON.stringify({revision},null,2));
