export async function health(env:{DB?:{prepare:(sql:string)=>{first:()=>Promise<unknown>}};VISITOR_SECRET?:string},revision:string){
 const headers={'cache-control':'no-store'};
 try{
  if(!env.VISITOR_SECRET||!env.DB)throw Error('configuration');
  await env.DB.prepare('SELECT 1').first();
  return Response.json({status:'ok',revision,database:'ok'},{headers});
 }catch{return Response.json({status:'unavailable',revision},{status:503,headers});}
}
