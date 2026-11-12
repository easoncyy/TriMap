import {maintenance} from './release-safety';
import {health} from './health';
declare const BUILD_REVISION:string;
import {context} from './context';
import {NextRequest} from './server';
import {initialize} from './storage';
import * as atlas from './atlas';import * as atlases from './atlases';import * as session from './session';
export default {async fetch(request:Request,env:any){const url=new URL(request.url);if(url.pathname==='/api/health'&&request.method==='GET')return health(env,BUILD_REVISION);if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);return context.run(env,async()=>{try{if(!env.VISITOR_SECRET)return Response.json({error:'站点密钥尚未配置'},{status:503});if(await maintenance(env.DB))return Response.json({error:'内容更新中，请稍后刷新'},{status:503,headers:{'Retry-After':'60','Cache-Control':'no-store'}});await initialize();const routes:any={'/api/atlas':atlas,'/api/atlases':atlases,'/api/session':session};const handler=routes[url.pathname]?.[request.method];if(!handler)return new Response('Not found',{status:404});return await handler(new NextRequest(request));}catch(e){return Response.json({error:'请求失败，请稍后重试'},{status:500});}})}};
