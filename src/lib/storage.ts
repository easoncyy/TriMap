import 'server-only';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {seed} from './seed';
import type {Store,AtlasMeta} from './model';
type RecordRow={id:string;owner:string;title:string;description:string;owner_name:string;public:number;official:number;updated_at:string;state:string};
let connection:DatabaseSync|undefined;
function db(){
 if(connection)return connection;
 const filename=process.env.ATLAS_DB_FILE||path.join(process.cwd(),'data','atlas.sqlite');
 mkdirSync(path.dirname(filename),{recursive:true});
 connection=new DatabaseSync(filename);
 connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS atlases(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',owner_name TEXT NOT NULL,public INTEGER NOT NULL DEFAULT 0,official INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,state TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS atlases_owner ON atlases(owner);
 CREATE INDEX IF NOT EXISTS atlases_visibility ON atlases(public,updated_at);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 if(!connection.prepare('SELECT id FROM atlases WHERE id=?').get('official')){
  let initial=structuredClone(seed);const legacy=process.env.ATLAS_DATA_FILE||path.join(process.cwd(),'data','store.json');
  if(existsSync(legacy))initial=JSON.parse(readFileSync(legacy,'utf8'));
  connection.prepare('INSERT OR IGNORE INTO atlases VALUES(?,?,?,?,?,?,?,?,?)').run('official','system','具身视觉 · 三张活地图','从视觉感知到机器人操作的共享知识样例。','TriMap 小组',1,1,new Date().toISOString(),JSON.stringify(initial));
 }
 return connection;
}
export function databaseSecret(){const c=db();const row=c.prepare('SELECT value FROM settings WHERE key=?').get('visitor_secret') as {value:string}|undefined;if(row)return row.value;const value=crypto.randomUUID()+crypto.randomUUID();c.prepare('INSERT OR IGNORE INTO settings VALUES(?,?)').run('visitor_secret',value);return (c.prepare('SELECT value FROM settings WHERE key=?').get('visitor_secret') as {value:string}).value;}
export function atlasRecord(id='official'){return db().prepare('SELECT * FROM atlases WHERE id=?').get(id) as RecordRow|undefined;}
export function readable(row:RecordRow,visitor:string,admin:boolean){return !!row.public||row.owner===visitor||admin;}
export function editable(row:RecordRow,visitor:string,admin:boolean){return row.owner===visitor||admin;}
export function metadata(row:RecordRow,visitor:string,admin:boolean):AtlasMeta{return {id:row.id,title:row.title,description:row.description,ownerName:row.owner_name,isPublic:!!row.public,official:!!row.official,canEdit:editable(row,visitor,admin),owned:row.owner===visitor,updatedAt:row.updated_at};}
export function listAtlases(visitor:string,admin:boolean){return (db().prepare('SELECT * FROM atlases WHERE public=1 OR owner=? OR ?=1 ORDER BY official DESC,updated_at DESC').all(visitor,Number(admin)) as RecordRow[]).map(row=>metadata(row,visitor,admin));}
export function createAtlas(visitor:string,title:string,ownerName:string,source?:RecordRow){
 const state:Store=source?JSON.parse(source.state):{nodes:[],relations:[],draft:null,feedback:[],revisions:[]};
 state.draft=null;state.feedback=[];state.revisions=[];
 const id=crypto.randomUUID();db().prepare('INSERT INTO atlases VALUES(?,?,?,?,?,?,?,?,?)').run(id,visitor,title,'',ownerName,0,0,new Date().toISOString(),JSON.stringify(state));return id;
}
export function updateMetadata(id:string,title:string,description:string,ownerName:string,isPublic:boolean){db().prepare('UPDATE atlases SET title=?,description=?,owner_name=?,public=?,updated_at=? WHERE id=?').run(title,description,ownerName,Number(isPublic),new Date().toISOString(),id);}
export async function readStore(id='official'):Promise<Store>{const row=atlasRecord(id);if(!row)throw Error('图谱不存在');return JSON.parse(row.state);}
// A synchronous transaction keeps each read/modify/write cycle atomic.
export async function updateStore<T>(fn:(s:Store)=>T,id='official'):Promise<T>{const c=db();c.exec('BEGIN IMMEDIATE');try{const row=atlasRecord(id);if(!row)throw Error('图谱不存在');const state:Store=JSON.parse(row.state);const result=fn(state);c.prepare('UPDATE atlases SET state=?,updated_at=? WHERE id=?').run(JSON.stringify(state),new Date().toISOString(),id);c.exec('COMMIT');return result;}catch(e){c.exec('ROLLBACK');throw e;}}
