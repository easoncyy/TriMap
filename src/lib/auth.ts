import {createHmac,timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {NextResponse} from 'next/server';
import {databaseSecret} from './storage';
export const password=()=>process.env.MAINTAINER_PASSWORD||'local-spectrum';
export function token(){return createHmac('sha256',password()).update('spectrum-local-maintainer-v1').digest('hex');}
export function authorized(req:NextRequest){const v=req.cookies.get('spectrum_session')?.value||'';const expected=token();return /^[a-f0-9]{64}$/.test(v)&&timingSafeEqual(Buffer.from(v),Buffer.from(expected));}
export function sameOrigin(req:NextRequest){try{const origin=new URL(req.headers.get('origin')||'');return origin.host===req.headers.get('host')&&origin.protocol===req.nextUrl.protocol;}catch{return false;}}
function signature(id:string){return createHmac('sha256',databaseSecret()).update(id).digest('hex');}
export function visitorIdentity(req:NextRequest){const raw=req.cookies.get('spectrum_visitor')?.value||'';const [id,sig]=raw.split('.');if(id&&/^[a-f0-9-]{36}$/.test(id)&&sig&&/^[a-f0-9]{64}$/.test(sig)&&timingSafeEqual(Buffer.from(sig),Buffer.from(signature(id))))return {id,isNew:false};return {id:crypto.randomUUID(),isNew:true};}
export function attachVisitor(res:NextResponse,visitor:{id:string;isNew:boolean}){if(visitor.isNew)res.cookies.set('spectrum_visitor',`${visitor.id}.${signature(visitor.id)}`,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:31536000});return res;}
