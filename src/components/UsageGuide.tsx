'use client';
import {useEffect,useRef,useState} from 'react';
const steps=[
 {title:'同一束知识，三种看法',body:'顶部三个滤光片切换领域、生态和认知地图。棱镜代表知识，关系镜代表关联；点击它们可以查看内容和关联依据。',hint:'先选择一张地图，再点击一个感兴趣的棱镜。'},
 {title:'色散：探索当前地图',body:'色散用于浏览同一张地图中的知识关系。默认只展开有限层级，避免一次出现过多内容；它不会修改正式知识。',hint:'悬停或选中关系镜后，点击 + 展开下游，点击 − 收起。'},
 {title:'折射：理解跨地图关联',body:'先选中一个知识棱镜，再点击底栏的「折射」。视图围绕它展示跨地图关联和可连通的光源上游路径，让你理解方法、资源与研究判断如何联系。',hint:'选中棱镜 → 折射 → 点击关系镜查看“为什么关联”。没有相关关系时不会凭空生成光线。'},
 {title:'设为光源：换一个探索起点',body:'在当前地图选中一个棱镜，点击「设为光源」，就把它作为探索起点。光源决定探索从哪里开始，不会改变知识内容或正式关系的方向。',hint:'换一个起点后，可点「整理布局」重新安排画面。'},
 {title:'摆放、整理与保存',body:'拖动棱镜或关系镜调整自己的布局。展开、收起保持已有位置；「整理布局」会重新排列。光线目标预览属于个人探索，不会直接发布为知识关系。',hint:'「更多」中可保存、恢复探索及切换全部关系。正式内容编辑需要权限和草稿发布流程。'}
];
export default function UsageGuide({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[step,setStep]=useState(0);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const item=steps[step];
 return <dialog ref={dialog} className="usage-guide" aria-labelledby="usage-guide-title" onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}>
 <div className="usage-guide-card"><header><span>INSTRUCTION · 使用指引</span><button autoFocus aria-label="关闭使用指引" onClick={()=>dialog.current?.close()}>×</button></header>
 <p className="usage-progress">{step+1} / {steps.length}</p><h2 id="usage-guide-title">{item.title}</h2><p>{item.body}</p><aside>{item.hint}</aside>
 <nav aria-label="教程步骤">{steps.map((s,i)=><button key={s.title} aria-label={`第 ${i+1} 步：${s.title}`} aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}>{i+1}</button>)}</nav>
 <footer><button disabled={step===0} onClick={()=>setStep(i=>i-1)}>上一步</button><button onClick={()=>step===steps.length-1?dialog.current?.close():setStep(i=>i+1)}>{step===steps.length-1?'开始探索':'下一步'}</button></footer></div></dialog>;
}
