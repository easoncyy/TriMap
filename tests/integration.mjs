import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const temp=await mkdtemp(path.join(tmpdir(),'spectrum-test-'));
const origin='http://127.0.0.1:3101';
const legacy={nodes:[{id:'legacy',title:'Migrated node',kind:'概念',lens:'domain',summary:'migration test',body:'',sources:[],status:'待核实',x:100,y:100}],relations:[],draft:null,feedback:[],revisions:[]};
await writeFile(path.join(temp,'store.json'),JSON.stringify(legacy));
const launch=()=>spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{env:{...process.env,ATLAS_DATA_FILE:path.join(temp,'store.json'),ATLAS_DB_FILE:path.join(temp,'test.sqlite'),MAINTAINER_PASSWORD:'integration-only'},stdio:['ignore','pipe','pipe']});
let server=launch();
let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
async function send(body,cookie=''){return fetch(origin+'/api/atlas',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)});}
async function read(cookie=''){return fetch(origin+'/api/atlas',{headers:{Cookie:cookie}}).then(r=>r.json());}
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
 assert.equal((await send({action:'draft',nodes:[],relations:[]})).status,401);
 const login=await fetch(origin+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({password:'integration-only'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const before=await read();const updated=structuredClone(before.nodes);updated[0].title='Integration title';
 assert.equal(before.nodes[0].id,'legacy','legacy JSON should migrate automatically');
 assert.equal((await send({action:'draft',nodes:updated,relations:before.relations},cookie)).status,200);
 assert.equal((await read()).draft,null);assert.equal((await read()).nodes[0].title,before.nodes[0].title);assert.equal((await read(cookie)).draft.nodes[0].title,'Integration title');
 assert.equal((await send({action:'publish',reason:'integration publication'},cookie)).status,200);assert.equal((await read()).nodes[0].title,'Integration title');
 assert.equal((await send({action:'feedback',target:before.nodes[0].id,text:'Test feedback'})).status,200);
 const s=await read(cookie);assert.equal(s.feedback.length,1);assert.equal((await send({action:'respond',id:s.feedback[0].id,response:'Checked'},cookie)).status,200);assert.equal((await read()).feedback[0].status,'已回应');
 assert.equal((await send({action:'restore',id:s.revisions[0].id},cookie)).status,200);assert.equal((await read(cookie)).draft.nodes[0].title,before.nodes[0].title);
 const bad=await fetch(origin+'/api/atlas',{method:'POST',headers:{Origin:'http://other.example','Content-Type':'application/json'},body:JSON.stringify({action:'feedback',target:'atlas',text:'bad origin'})});assert.equal(bad.status,403);
 const visitorA=(await fetch(origin+'/api/atlases')).headers.get('set-cookie').split(';')[0];
 const visitorB=(await fetch(origin+'/api/atlases')).headers.get('set-cookie').split(';')[0];
 async function postTo(endpoint,body,identity=visitorA){return fetch(origin+endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:identity},body:JSON.stringify(body)});}
 async function getAtlas(id,identity){return fetch(origin+'/api/atlas?id='+id,{headers:{Cookie:identity}});}
 const created=await postTo('/api/atlases',{action:'create',title:'Private atlas',ownerName:'Explorer A',sourceId:'official'});assert.equal(created.status,200);const id=(await created.json()).atlas.id;
 assert.equal((await getAtlas(id,visitorA)).status,200);assert.equal((await getAtlas(id,visitorB)).status,404);
 const collection=await fetch(origin+'/api/atlases',{headers:{Cookie:visitorB}}).then(r=>r.json());assert.equal(collection.atlases.some(a=>a.id===id),false);
 const owned=await (await getAtlas(id,visitorA)).json();assert.equal(owned.meta.canEdit,true);assert.equal(owned.feedback.length,0);assert.equal(owned.revisions.length,0);assert.equal(owned.draft,null);
 assert.equal((await postTo('/api/atlases',{action:'metadata',id,title:'Public atlas',ownerName:'Explorer A',description:'Share',isPublic:true})).status,200);
 assert.equal((await getAtlas(id,visitorB)).status,200);
 assert.equal((await postTo('/api/atlas?id='+id,{action:'draft',nodes:[],relations:[]},visitorB)).status,401);
 assert.equal((await postTo('/api/atlases',{action:'metadata',id,title:'Hijack',isPublic:false},visitorB)).status,403);
 assert.equal((await postTo('/api/atlas?id='+id,{action:'feedback',target:'legacy',category:'内容错误',text:'Specific question',suggestion:'Correct this',author:'Explorer B'},visitorB)).status,200);
 const question=(await (await getAtlas(id,visitorA)).json()).feedback[0];assert.equal(question.category,'内容错误');assert.equal(question.targetTitle,'Integration title');assert.equal(question.suggestion,'Correct this');
 assert.equal((await postTo('/api/atlas?id='+id,{action:'respond',id:question.id,response:'Updated'},visitorB)).status,401);
 assert.equal((await postTo('/api/atlas?id='+id,{action:'respond',id:question.id,response:'Updated'})).status,200);
 const next=structuredClone(owned.nodes);next[0].title='Personal update';next.push({...next[0],id:'draft-only',title:'Private draft node'});
 assert.equal((await postTo('/api/atlas?id='+id,{action:'draft',nodes:next,relations:owned.relations})).status,200);
 assert.equal((await (await getAtlas(id,visitorB)).json()).draft,null);
 assert.equal((await postTo('/api/atlas?id='+id,{action:'feedback',target:'draft-only',text:'Draft discussion'})).status,200);
 assert.equal((await (await getAtlas(id,visitorB)).json()).feedback.some(f=>f.target==='draft-only'),false,'draft discussions must not reveal unpublished nodes');
 assert.equal((await postTo('/api/atlas?id='+id,{action:'publish',reason:'Personal publication'})).status,200);
 const published=await (await getAtlas(id,visitorB)).json();assert.equal(published.nodes[0].title,'Personal update');assert.ok(published.revisions[0].changes.some(c=>c.includes('修改节点')));
 assert.equal((await read()).nodes[0].title,'Integration title','personal edits must not modify the source');
 assert.equal((await readFile(path.join(temp,'test.sqlite'))).subarray(0,15).toString(),'SQLite format 3');
 assert.deepEqual(JSON.parse(await readFile(path.join(temp,'store.json'),'utf8')),legacy,'migration must preserve the legacy file');
 server.kill();await new Promise(r=>server.once('exit',r));server=launch();server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 let restarted=false;for(let i=0;i<60;i++){try{const r=await getAtlas(id,visitorA);if(r.ok){const persisted=await r.json();assert.equal(persisted.nodes[0].title,'Personal update');assert.equal(persisted.meta.owned,true);restarted=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(restarted,'SQLite and signed visitor ownership should survive restart');
 console.log('PASS: SQLite migration, visitor ownership, private/public visibility, cross-visitor write protection, concrete feedback, personal publication, version diff, source isolation, original maintenance flows');
}finally{server.kill();await new Promise(r=>server.once('exit',r));await rm(temp,{recursive:true,force:true});}
