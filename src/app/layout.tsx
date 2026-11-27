import type {Metadata,Viewport} from 'next';
import './globals.css';
import './optical.css';
import './typography.css';
import './gateway.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export const metadata:Metadata={title:'光谱 Spectrum · 三张活地图',description:'通过领域、生态与认知三种滤光片，探索知识之间的联系。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><head><link rel="stylesheet" href="/optical/type/faces.css"/><link rel="stylesheet" href="/optical/type/role-faces.css"/><link rel="stylesheet" href="/optical/type/ibm-plex-sc/faces.css"/></head><body>{children}</body></html>;}
