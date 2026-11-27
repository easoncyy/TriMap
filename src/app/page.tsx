import {redirect} from 'next/navigation';
import GalaxyGateway from '@/components/GalaxyGateway';

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 if(params.atlas!==undefined){
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params)){
   for(const item of Array.isArray(value)?value:value===undefined?[]:[value])query.append(key,item);
  }
  redirect('/map/?'+query);
 }
 return <GalaxyGateway/>;
}
