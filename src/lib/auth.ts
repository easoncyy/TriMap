import {createHmac,timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
export const password=()=>process.env.MAINTAINER_PASSWORD||'local-spectrum';
export function token(){return createHmac('sha256',password()).update('spectrum-local-maintainer-v1').digest('hex');}
export function authorized(req:NextRequest){const v=req.cookies.get('spectrum_session')?.value||'';const expected=token();return v.length===expected.length&&timingSafeEqual(Buffer.from(v),Buffer.from(expected));}
export function sameOrigin(req:NextRequest){try{const origin=new URL(req.headers.get('origin')||'');return origin.host===req.headers.get('host')&&origin.protocol===req.nextUrl.protocol;}catch{return false;}}
