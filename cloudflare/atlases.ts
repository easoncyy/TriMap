import {NextRequest,NextResponse} from 'next/server';
import {authorized,sameOrigin,visitorIdentity,attachVisitor} from '@/lib/auth';
import {atlasRecord,createAtlas,listAtlases,metadata,readable,editable,updateMetadata} from '@/lib/storage';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const visitor=visitorIdentity(req);return attachVisitor(NextResponse.json({atlases:await listAtlases(visitor.id,authorized(req))}),visitor);}
export async function POST(req:NextRequest){
 try{
  if(!sameOrigin(req))return NextResponse.json({error:'请求来源不匹配'},{status:403});
  const visitor=visitorIdentity(req),admin=authorized(req);const b=await req.json();
  if(typeof b.title!=='string'||!b.title.trim()||b.title.length>100)throw Error('请填写 1–100 字的图谱名称');
  const ownerName=String(b.ownerName||'匿名探索者').trim().slice(0,60)||'匿名探索者';
  if(b.action==='create'){
   const source=b.sourceId?await atlasRecord(b.sourceId):undefined;
   if(b.sourceId&&(!source||!readable(source,visitor.id,admin)))return NextResponse.json({error:'无法复制此图谱'},{status:404});
   const id=await createAtlas(visitor.id,b.title.trim(),ownerName,source);return attachVisitor(NextResponse.json({atlas:metadata((await atlasRecord(id))!,visitor.id,admin)}),visitor);
  }
  if(b.action==='metadata'){
   const row=await atlasRecord(b.id);if(!row||!editable(row,visitor.id,admin))return NextResponse.json({error:'无权管理此图谱'},{status:403});
   await updateMetadata(row.id,b.title.trim(),String(b.description||'').slice(0,1000),ownerName,row.official?true:b.isPublic===true);
   return attachVisitor(NextResponse.json({atlas:metadata((await atlasRecord(row.id))!,visitor.id,admin)}),visitor);
  }
  throw Error('未知操作');
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'操作失败'},{status:400});}
}
