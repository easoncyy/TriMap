import {execFileSync} from 'node:child_process';import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';import path from 'node:path';
import {seed} from '../src/lib/seed';import {mergePublishedContent} from './content-sync';
const cwd=path.resolve('cloudflare'),cli=path.join(cwd,'node_modules/wrangler/bin/wrangler.js');
function run(args:string[]){const output=execFileSync(process.execPath,[cli,'d1','execute','DB','--remote','--config',path.join(cwd,'wrangler.jsonc'),'--json',...args],{encoding:'utf8',maxBuffer:20*1024*1024});const start=output.search(/^\[/m);if(start<0)throw Error('无法解析 D1 执行结果');return JSON.parse(output.slice(start));}
const rows=run(['--command',"SELECT state FROM atlases WHERE id='official'"])[0].results;if(rows.length!==1)throw Error('共享地图不存在');const original=rows[0].state;
const merged=mergePublishedContent(JSON.parse(original),seed);
if(!merged.addedNodes&&!merged.addedRelations){console.log('Already synchronized; no database changes');process.exit(0);}
const dir=path.join(cwd,'.wrangler/content-backups');mkdirSync(dir,{recursive:true});const stamp=Date.now();writeFileSync(path.join(dir,stamp+'.json'),original,{mode:0o600});
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const file=path.join(dir,stamp+'.sql');writeFileSync(file,`UPDATE atlases SET state=${quote(JSON.stringify(merged.state))},updated_at=${quote(new Date().toISOString())} WHERE id='official' AND state=${quote(original)};`,{mode:0o600});
try{run(['--file',file]);const verified=run(['--command',"SELECT state FROM atlases WHERE id='official'"])[0].results;const published=verified[0]&&JSON.parse(verified[0].state);if(!published?.revisions?.some((v:{id:string})=>v.id===merged.state.revisions[0].id))throw Error('未确认发布快照，请重新读取后检查同步状态');console.log(JSON.stringify({addedNodes:merged.addedNodes,addedRelations:merged.addedRelations,totalNodes:merged.state.nodes.length,totalRelations:merged.state.relations.length}));}finally{unlinkSync(file);}
