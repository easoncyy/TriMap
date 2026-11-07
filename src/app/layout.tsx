import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'光谱 Spectrum · 三张活地图',description:'通过领域、生态与认知三种滤光片，探索知识之间的联系。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
