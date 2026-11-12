import {execFileSync} from 'node:child_process';import {mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {seed} from '../src/lib/seed';import {candidate} from './release-safety';import {graphChanges} from '../src/lib/diff';
const cli=path.resolve('cloudflare/node_modules/wrangler/bin/wrangler.js');
const command=process.argv[2],dir=path.resolve(process.argv[3]||'cloudflare/.wrangler/releases/'+Date.now());
const call=(args:string[])=>execFileSync(process.execPath,[cli,...args],{cwd:path.resolve('cloudflare'),encoding:'utf8',maxBuffer:40*1024*1024});
function query(sql:string){const raw=call(['d1','execute','DB','--remote','--json','--command',sql]);const at=raw.search(/^\[/m);if(at<0)throw Error('D1 response invalid');return JSON.parse(raw.slice(at))[0].results;}
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const save=(name:string,data:string)=>writeFileSync(path.join(dir,name),data,{mode:0o600});
const load=(name:string)=>readFileSync(path.join(dir,name),'utf8');
function locked(){if(!query("SELECT value FROM settings WHERE key='content_maintenance'").length)throw Error('Maintenance not enabled');}
function writeState(before:string,after:string){locked();const file=path.join(dir,'pending.sql');save('pending.sql',`UPDATE atlases SET state=${quote(after)},updated_at=${quote(new Date().toISOString())} WHERE id='official' AND state=${quote(before)} AND EXISTS (SELECT 1 FROM settings WHERE key='content_maintenance');`);try{call(['d1','execute','DB','--remote','--json','--file',file]);}finally{unlinkSync(file);}const read=query("SELECT state FROM atlases WHERE id='official'")[0]?.state;if(read!==after)throw Error('CAS or full-state verification failed');}
if(command==='lock'){query("INSERT INTO settings(key,value) VALUES('content_maintenance','release')");console.log('Maintenance enabled');}
else if(command==='unlock'){locked();query("DELETE FROM settings WHERE key='content_maintenance'");console.log('Maintenance disabled');}
else if(command==='prepare'){
 locked();mkdirSync(dir,{recursive:true});
 const rows=query('SELECT * FROM atlases ORDER BY id');save('atlases.json',JSON.stringify(rows));
 const official=rows.find((r:any)=>r.id==='official');if(!official)throw Error('No official atlas');save('official.json',official.state);
 const fixture=JSON.parse(readFileSync('tests/fixtures/content-integration.json','utf8'));
 const before=JSON.parse(official.state),next=candidate(before,fixture.mainStore,seed);
 save('candidate.json',JSON.stringify({nodes:next.nodes,relations:next.relations}));
 const backup=path.join(dir,'database.sql');call(['d1','export','DB','--remote','--output',backup]);
 const sql=readFileSync(backup,'utf8');const restored=new DatabaseSync(path.join(dir,'restore-check.sqlite'));restored.exec(sql);
 if((restored.prepare('PRAGMA integrity_check').get() as any).integrity_check!=='ok')throw Error('Backup integrity failed');
 const recovered=restored.prepare('SELECT * FROM atlases ORDER BY id').all();if(JSON.stringify(recovered)!==JSON.stringify(rows))throw Error('Backup rows differ');restored.close();
 const current=query('SELECT * FROM atlases ORDER BY id');if(JSON.stringify(current)!==JSON.stringify(rows))throw Error('Database changed during backup');
 const bookmark=call(['d1','time-travel','info','DB','--json']);save('time-travel.txt',bookmark);
 const changes=graphChanges(before,next);const manifest={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),backupSha256:digest(sql),beforeSha256:digest(official.state),candidateSha256:digest(load('candidate.json')),nodes:next.nodes.length,relations:next.relations.length,changes};save('manifest.json',JSON.stringify(manifest,null,2));
 console.log(JSON.stringify({directory:dir,nodes:next.nodes.length,relations:next.relations.length,changes:changes.length,backupRestored:true,backupSha256:manifest.backupSha256}));
}else if(command==='apply'){
 locked();const manifest=JSON.parse(load('manifest.json'));if(manifest.revision!==execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim())throw Error('Revision mismatch');
 if(digest(load('database.sql'))!==manifest.backupSha256||digest(load('official.json'))!==manifest.beforeSha256||digest(load('candidate.json'))!==manifest.candidateSha256)throw Error('Artifact hash mismatch');
 const original=load('official.json'),before=JSON.parse(original),graph=JSON.parse(load('candidate.json'));
 const drafted={...before,draft:graph};writeState(original,JSON.stringify(drafted));
 const published=structuredClone(drafted);published.revisions.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),reason:'发布已审核应用、视觉和 Infra 集成内容（89aa9d8）',changes:manifest.changes,nodes:structuredClone(before.nodes),relations:structuredClone(before.relations)});published.nodes=graph.nodes;published.relations=graph.relations;published.draft=null;
 writeState(JSON.stringify(drafted),JSON.stringify(published));save('published.json',JSON.stringify(published));
 const rows=query('SELECT * FROM atlases ORDER BY id'),old=JSON.parse(load('atlases.json'));
 if(JSON.stringify(rows.filter((r:any)=>r.id!=='official'))!==JSON.stringify(old.filter((r:any)=>r.id!=='official')))throw Error('Other atlases changed');
 const official=rows.find((r:any)=>r.id==='official'),previous=old.find((r:any)=>r.id==='official');for(const key of Object.keys(previous).filter(k=>!['state','updated_at'].includes(k)))if(official[key]!==previous[key])throw Error('Official metadata changed');
 console.log(JSON.stringify({published:true,nodes:published.nodes.length,relations:published.relations.length,otherAtlasesPreserved:true,feedbackPreserved:JSON.stringify(before.feedback)===JSON.stringify(published.feedback),historyPreserved:JSON.stringify(published.revisions.slice(1))===JSON.stringify(before.revisions)}));
}else throw Error('Use lock, prepare [directory], apply <directory>, unlock');
