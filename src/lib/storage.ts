import 'server-only';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {seed} from './seed';
import type {Store} from './model';
const file=process.env.ATLAS_DATA_FILE||path.join(process.cwd(),'data','store.json');
export async function readStore():Promise<Store>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return structuredClone(seed);throw e;}}
let queue:Promise<unknown>=Promise.resolve();
export function updateStore<T>(fn:(s:Store)=>T|Promise<T>):Promise<T>{
 const job=queue.then(async()=>{const s=await readStore();const result=await fn(s);await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(s,null,2),'utf8');await rename(file+'.tmp',file);return result;});
 queue=job.catch(()=>{});return job;
}
