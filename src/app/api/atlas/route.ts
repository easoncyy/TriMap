import {NextRequest,NextResponse} from 'next/server';
import {authorized,sameOrigin} from '@/lib/auth';
import {readStore,updateStore} from '@/lib/storage';
import {validateGraph} from '@/lib/model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const s=await readStore();const admin=authorized(req);return NextResponse.json({...s,draft:admin?s.draft:null,revisions:s.revisions.map(({id,date,reason})=>({id,date,reason})),feedback:s.feedback.map(f=>({...f,author:admin?f.author:'访客'}))});}
export async function POST(req:NextRequest){
 try{
 if(!sameOrigin(req))return NextResponse.json({error:'请求来源不匹配'},{status:403});
 const raw=await req.text();if(raw.length>2000000)throw Error('请求内容过大');const b=JSON.parse(raw);
 if(b.action==='feedback'){
  if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000)throw Error('请填写 1–2000 字的反馈');
  await updateStore(s=>{if(b.target!=='atlas'&&!s.nodes.some(n=>n.id===b.target)&&!s.relations.some(e=>e.id===b.target))throw Error('反馈对象不存在');s.feedback.unshift({id:crypto.randomUUID(),target:b.target,text:b.text.trim(),author:String(b.author||'匿名访客').slice(0,60),createdAt:new Date().toISOString(),status:'待处理',response:''});});
 }else{
  if(!authorized(req))return NextResponse.json({error:'请先以维护者身份登录'},{status:401});
  await updateStore(s=>{
   if(b.action==='draft'){validateGraph(b.nodes,b.relations);s.draft={nodes:b.nodes,relations:b.relations};}
   else if(b.action==='publish'){if(!s.draft)throw Error('没有待发布的草稿');if(!b.reason?.trim())throw Error('请填写发布说明');validateGraph(s.draft.nodes,s.draft.relations);s.revisions.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),reason:b.reason.slice(0,1000),nodes:structuredClone(s.nodes),relations:structuredClone(s.relations)});s.nodes=s.draft.nodes;s.relations=s.draft.relations;s.draft=null;}
   else if(b.action==='respond'){const f=s.feedback.find(f=>f.id===b.id);if(!f)throw Error('反馈不存在');if(!b.response?.trim())throw Error('请填写回应');f.response=b.response.slice(0,2000);f.status='已回应';}
   else if(b.action==='restore'){const v=s.revisions.find(v=>v.id===b.id);if(!v)throw Error('版本不存在');s.draft={nodes:structuredClone(v.nodes),relations:structuredClone(v.relations)};}
   else if(b.action==='discard')s.draft=null;
   else throw Error('未知操作');
  });
 }
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'操作失败'},{status:400});}
}
