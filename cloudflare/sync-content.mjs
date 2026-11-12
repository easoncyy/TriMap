import {build} from 'esbuild';import {execFileSync} from 'node:child_process';import path from 'node:path';
const folder=import.meta.dirname;const output=path.join(folder,'.wrangler/sync-content.mjs');
await build({entryPoints:[path.join(folder,'sync-content.ts')],bundle:true,platform:'node',format:'esm',outfile:output});
execFileSync(process.execPath,[output],{cwd:path.resolve(folder,'..'),stdio:'inherit'});
