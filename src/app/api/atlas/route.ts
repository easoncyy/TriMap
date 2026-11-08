import {NextRequest,NextResponse} from 'next/server';
import {authorized,sameOrigin,visitorIdentity,attachVisitor} from '@/lib/auth';
import {readStore,updateStore,atlasRecord,readable,editable,metadata} from '@/lib/storage';
import {validateGraph} from '@/lib/model';
import {graphChanges} from '@/lib/diff';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const visitor=visitorIdentity(req),admin=authorized(req),id=req.nextUrl.searchParams.get('id')||'official';
 const row=atlasRecord(id);
 if(!row||!readable(row,visitor.id,admin))return NextResponse.json({error:'图谱不存在或尚未公开'},{status:404});
 const s=await readStore(id),canEdit=editable(row,visitor.id,admin);
 return attachVisitor(NextResponse.json({...s,meta:metadata(row,visitor.id,admin),draft:canEdit?s.draft:null,revisions:s.revisions.map(({id,date,reason,changes})=>({id,date,reason,changes})),feedback:s.feedback.filter(f=>canEdit||!f.draftOnly||s.nodes.some(n=>n.id===f.target)||s.relations.some(e=>e.id===f.target))}),visitor);
}
export async function POST(req:NextRequest){
 try{
  if(!sameOrigin(req))return NextResponse.json({error:'请求来源不匹配'},{status:403});
  const raw=await req.text();if(raw.length>2000000)throw Error('请求内容过大');const b=JSON.parse(raw);
  const visitor=visitorIdentity(req),admin=authorized(req),id=req.nextUrl.searchParams.get('id')||'official',row=atlasRecord(id);
  if(!row||!readable(row,visitor.id,admin))return NextResponse.json({error:'图谱不存在或尚未公开'},{status:404});
  if(b.action==='feedback'){
   if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000)throw Error('请填写 1–2000 字的具体问题');
   await updateStore(s=>{
    const candidate=editable(row,visitor.id,admin)&&s.draft?s.draft:s;
    const node=candidate.nodes.find(n=>n.id===b.target),edge=candidate.relations.find(e=>e.id===b.target);
    if(b.target!=='atlas'&&!node&&!edge)throw Error('反馈对象不存在');
    s.feedback.unshift({id:crypto.randomUUID(),target:b.target,targetTitle:node?.title||(edge?`关系：${edge.label}`:'整个图谱'),draftOnly:b.target!=='atlas'&&!s.nodes.some(n=>n.id===b.target)&&!s.relations.some(e=>e.id===b.target),category:['内容错误','关系疑问','来源缺失','改进建议','使用问题'].includes(b.category)?b.category:'改进建议',suggestion:String(b.suggestion||'').slice(0,2000),text:b.text.trim(),author:String(b.author||'匿名访客').slice(0,60),createdAt:new Date().toISOString(),status:'待处理',response:''});
   },id);
  }else{
   if(!editable(row,visitor.id,admin))return NextResponse.json({error:'只能修改自己的图谱；共享样例需要维护者权限'},{status:401});
   await updateStore(s=>{
    if(b.action==='draft'){validateGraph(b.nodes,b.relations);s.draft={nodes:b.nodes,relations:b.relations};}
    else if(b.action==='publish'){
     if(!s.draft)throw Error('没有待发布的草稿');if(typeof b.reason!=='string'||!b.reason.trim())throw Error('请填写发布说明');
     validateGraph(s.draft.nodes,s.draft.relations);
     s.revisions.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),reason:b.reason.slice(0,1000),changes:graphChanges(s,s.draft),nodes:structuredClone(s.nodes),relations:structuredClone(s.relations)});
     s.nodes=s.draft.nodes;s.relations=s.draft.relations;s.draft=null;
    }else if(b.action==='respond'){
     const f=s.feedback.find(f=>f.id===b.id);if(!f)throw Error('反馈不存在');if(typeof b.response!=='string'||!b.response.trim())throw Error('请填写核实过程与处理说明');f.response=b.response.slice(0,2000);f.status='已回应';
    }else if(b.action==='restore'){
     const v=s.revisions.find(v=>v.id===b.id);if(!v)throw Error('版本不存在');s.draft={nodes:structuredClone(v.nodes),relations:structuredClone(v.relations)};
    }else if(b.action==='discard')s.draft=null;
    else throw Error('未知操作');
   },id);
  }
  return attachVisitor(NextResponse.json({ok:true}),visitor);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'操作失败'},{status:400});}
}
