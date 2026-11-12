import {environment} from './context';
import {seed} from '../src/lib/seed';
import type {Store,AtlasMeta} from '../src/lib/model';
type RecordRow={id:string;owner:string;title:string;description:string;owner_name:string;public:number;official:number;updated_at:string;state:string};
const db=()=>environment().DB;
export async function initialize(){await db().batch([db().prepare('INSERT OR IGNORE INTO atlases VALUES(?,?,?,?,?,?,?,?,?)').bind('official','system','具身视觉 · 三张活地图','共享样例','TriMap 示例',1,1,new Date().toISOString(),JSON.stringify(seed))]);}
export async function atlasRecord(id='official'):Promise<RecordRow|undefined>{return await db().prepare('SELECT * FROM atlases WHERE id=?').bind(id).first()||undefined;}
export function readable(row:RecordRow,visitor:string,admin:boolean){return !!row.public||row.owner===visitor||admin;}
export function editable(row:RecordRow,visitor:string,admin:boolean){return row.owner===visitor||admin;}
export function metadata(row:RecordRow,visitor:string,admin:boolean):AtlasMeta{return {id:row.id,title:row.title,description:row.description,ownerName:row.owner_name,isPublic:!!row.public,official:!!row.official,canEdit:editable(row,visitor,admin),owned:row.owner===visitor,updatedAt:row.updated_at};}

export async function listAtlases(visitor:string,admin:boolean){const r=await db().prepare('SELECT * FROM atlases WHERE public=1 OR owner=? OR ?=1 ORDER BY official DESC,updated_at DESC').bind(visitor,Number(admin)).all();return r.results.map((r:RecordRow)=>metadata(r,visitor,admin));}
export async function createAtlas(visitor:string,title:string,ownerName:string,source?:RecordRow){const state:Store=source?JSON.parse(source.state):{nodes:[],relations:[],draft:null,feedback:[],revisions:[]};state.draft=null;state.feedback=[];state.revisions=[];const id=crypto.randomUUID();await db().prepare(`INSERT INTO atlases SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='content_maintenance')`).bind(id,visitor,title,'',ownerName,0,0,new Date().toISOString(),JSON.stringify(state)).run();return id;}
export async function updateMetadata(id:string,title:string,description:string,ownerName:string,isPublic:boolean){await db().prepare(`UPDATE atlases SET title=?,description=?,owner_name=?,public=?,updated_at=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM settings WHERE key='content_maintenance')`).bind(title,description,ownerName,Number(isPublic),new Date().toISOString(),id).run();}
export async function readStore(id='official'):Promise<Store>{const row=await atlasRecord(id);if(!row)throw Error('图谱不存在');return JSON.parse(row.state);}
export async function updateStore<T>(fn:(s:Store)=>T,id='official'):Promise<T>{const row=await atlasRecord(id);if(!row)throw Error('图谱不存在');const state=JSON.parse(row.state),result=fn(state);const r=await db().prepare(`UPDATE atlases SET state=?,updated_at=? WHERE id=? AND state=? AND NOT EXISTS (SELECT 1 FROM settings WHERE key='content_maintenance')`).bind(JSON.stringify(state),new Date().toISOString(),id,row.state).run();if(!r.meta.changes)throw Error('内容已更新，请刷新后重试');return result;}
