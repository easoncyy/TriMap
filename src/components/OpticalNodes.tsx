'use client';
import {useId} from 'react';
import {Handle,Position,type NodeProps} from '@xyflow/react';


export function KnowledgePrism({data,selected}:NodeProps){
 const glass=useId().replace(/:/g,'');
 const color=String(data.color),root=!!data.lightSource;
 return <div className={`knowledge-node optical-node ${selected?'selected':''} ${root?'light-source':''}`} data-lens={String(data.lens)} style={{'--node-color':color,'--orbit-delay':-(String(data.id).split('').reduce((sum,c)=>sum+c.charCodeAt(0),0)%113)/10+'s'} as React.CSSProperties}>
 <Handle type="target" position={Position.Left}/>
 <div className="prism-shape" style={{transform:`scale(${Number(data.orbitScale??1)})`}} aria-hidden="true"><svg viewBox="0 0 120 120" width="100%" height="100%">
  <defs><linearGradient id={glass} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#cbd6d5"/><stop offset=".45" stopColor="#42545d"/><stop offset=".54" stopColor="#91a2a5"/><stop offset="1" stopColor="#26343c"/></linearGradient></defs>
  <g className="crystal-fallback" stroke="none">
    <path d="M57 9L17 83 62 103Z" fill={`url(#${glass})`}/>
    <path d="M57 9L62 103 103 76Z" fill="#354955" fillOpacity=".65"/>
    <path d="M17 83L62 103 103 76 46 68Z" fill="#93c8c6" fillOpacity=".19"/>
    <path d="M36 50L59 65 91 56 62 77Z" fill="var(--node-color)" fillOpacity=".37" stroke="none"/>
  </g>
  <g transform="rotate(-18 60 72)">
   {!(root||selected)&&<circle cx="96" cy="63" r="1.25" fill="#c8bb9c"/>}
  </g>
 </svg>
 {(root||selected)&&<><i className="facet-sheen"/><i className="satellite-plane"><i className="satellite-turn"/></i></>}
 </div>
 <div className="graph-label"><strong>{String(data.title)}</strong><span className="node-kind">{root?'光源':String(data.kind)} · {String(data.dimension)}{data.contextAnchor?' · 探索锚点':''}</span></div><Handle type="source" position={Position.Right}/></div>;
}

export function RoutingMirror({data,selected}:NodeProps){
 const star=useId().replace(/:/g,'');
 return <div className={`routing-mirror ${selected?'selected':''} ${data.folded?'is-folded':''}`}>
  <Handle type="target" position={Position.Left} isConnectable={false}/>
  <svg viewBox="0 0 76 76" className="mirror-shape" style={{transform:`scale(${Number(data.orbitScale??1)})`}} aria-hidden="true">
   <defs><radialGradient id={star}>
    <stop stopColor="white" stopOpacity=".19"/><stop offset=".48" stopColor="white" stopOpacity=".05"/>
    <stop offset="1" stopColor="white" stopOpacity="0"/>
   </radialGradient></defs>
   <g transform={`rotate(${Number(data.angle)} 38 38)`}>
    <ellipse className="star-corona" cx="38" cy="38" rx="27" ry="17" fill={`url(#${star})`}/>
    <path d="M8 38Q32 36 38 24Q41 36 68 38Q43 40 38 52Q35 40 8 38Z" fill="white" fillOpacity=".09"/>
    <path d="M8 38Q32 36 38 24L37 37Z" fill="white" fillOpacity=".39"/>
    <path d="M38 52Q42 40 68 38L39 39Z" fill="white" fillOpacity=".27"/>
    <path d="M26 44L37 37L49 31" fill="none" stroke="white" strokeOpacity=".48" strokeWidth="1"/>
    {data.folded===true&&<circle cx="38" cy="38" r="5.5" fill="none" stroke="white" strokeOpacity=".64" strokeWidth="1.2"/>}
   </g>
  </svg>
  {typeof data.onToggle==='function'&&<button type="button" className="mirror-fold nodrag nopan" aria-expanded={!data.folded} aria-label={`${data.folded?'展开':'折叠'}关系：${String(data.title)}`} data-hint={data.folded?`展开：${String(data.targetTitle||'下一层知识')}`:'折叠这条关系的下游'} onClick={event=>{event.stopPropagation();(data.onToggle as ()=>void)();}}>
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2L29 16 16 30 3 16Z" fill="#0b1820" stroke="#b4a483"/><path d="M16 5L26.5 16 16 27 5.5 16Z" fill="none" stroke="#586873" strokeDasharray="2 6"/><path d="M11 16H21" stroke="#f8e7c6" strokeWidth="1.6"/>{!!data.folded&&<path d="M16 11V21" stroke="#f8e7c6" strokeWidth="1.6"/>}<circle cx="16" cy="3" r="1.6" fill="#fff1d4"/></svg>
   </button>}
  <div className="graph-label"><span className="mirror-relation-name">{String(data.title)}</span>
  {!!data.preview&&<small>目标预览 · 未发布</small>}</div>
  <Handle type="source" position={Position.Right} isConnectable={selected} isConnectableStart={selected}/>
 </div>;
}
