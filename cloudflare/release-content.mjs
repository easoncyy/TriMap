import {build} from 'esbuild';import {execFileSync} from 'node:child_process';import path from 'node:path';
const out=path.join(import.meta.dirname,'.wrangler/release-content.mjs');
await build({entryPoints:[path.join(import.meta.dirname,'release-content.ts')],bundle:true,platform:'node',format:'esm',outfile:out});
execFileSync(process.execPath,[out,...process.argv.slice(2)],{cwd:path.resolve(import.meta.dirname,'..'),stdio:'inherit'});
