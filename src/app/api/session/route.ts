import {NextRequest,NextResponse} from 'next/server';
import {authorized,password,sameOrigin,token} from '@/lib/auth';
export async function GET(req:NextRequest){return NextResponse.json({maintainer:authorized(req)});}
export async function POST(req:NextRequest){if(!sameOrigin(req))return NextResponse.json({error:'请求来源不匹配'},{status:403});const body=await req.json();if(body.password!==password())return NextResponse.json({error:'维护口令不正确'},{status:401});const res=NextResponse.json({maintainer:true});res.cookies.set('spectrum_session',token(),{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:28800});return res;}
export async function DELETE(req:NextRequest){if(!sameOrigin(req))return NextResponse.json({error:'请求来源不匹配'},{status:403});const res=NextResponse.json({maintainer:false});res.cookies.delete('spectrum_session');return res;}
