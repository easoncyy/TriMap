import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const temp=await mkdtemp(path.join(tmpdir(),'spectrum-test-'));
const origin='http://127.0.0.1:3101';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{env:{...process.env,ATLAS_DATA_FILE:path.join(temp,'store.json'),MAINTAINER_PASSWORD:'integration-only'},stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
async function send(body,cookie=''){return fetch(origin+'/api/atlas',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(body)});}
async function read(cookie=''){return fetch(origin+'/api/atlas',{headers:{Cookie:cookie}}).then(r=>r.json());}
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,output);
 assert.equal((await send({action:'draft',nodes:[],relations:[]})).status,401);
 const login=await fetch(origin+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({password:'integration-only'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const before=await read();const updated=structuredClone(before.nodes);updated[0].title='Integration title';
 assert.equal((await send({action:'draft',nodes:updated,relations:before.relations},cookie)).status,200);
 assert.equal((await read()).draft,null);assert.equal((await read()).nodes[0].title,before.nodes[0].title);assert.equal((await read(cookie)).draft.nodes[0].title,'Integration title');
 assert.equal((await send({action:'publish',reason:'integration publication'},cookie)).status,200);assert.equal((await read()).nodes[0].title,'Integration title');
 assert.equal((await send({action:'feedback',target:before.nodes[0].id,text:'Test feedback'})).status,200);
 const s=await read(cookie);assert.equal(s.feedback.length,1);assert.equal((await send({action:'respond',id:s.feedback[0].id,response:'Checked'},cookie)).status,200);assert.equal((await read()).feedback[0].status,'已回应');
 assert.equal((await send({action:'restore',id:s.revisions[0].id},cookie)).status,200);assert.equal((await read(cookie)).draft.nodes[0].title,before.nodes[0].title);
 const bad=await fetch(origin+'/api/atlas',{method:'POST',headers:{Origin:'http://other.example','Content-Type':'application/json'},body:JSON.stringify({action:'feedback',target:'atlas',text:'bad origin'})});assert.equal(bad.status,403);
 console.log('PASS: page response, server authorization, draft isolation, publication, feedback, response, restore, same-origin guard');
}finally{server.kill();await new Promise(r=>server.once('exit',r));await rm(temp,{recursive:true,force:true});}
