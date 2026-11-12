'use client';
import {useId} from 'react';
import {Handle,Position,type NodeProps} from '@xyflow/react';


export function KnowledgePrism({data,selected}:NodeProps){
 const glass=useId().replace(/:/g,'');
 const color=String(data.color),root=!!data.lightSource;
 return <div className={`knowledge-node optical-node ${selected?'selected':''} ${root?'light-source':''}`} style={{'--node-color':color} as React.CSSProperties}>
 <Handle type="target" position={Position.Left}/><span className="node-kind">{root?'光源':String(data.kind)} · {String(data.dimension)}</span>
 <svg viewBox="0 0 120 120" className="prism-shape" aria-hidden="true">
  <defs><linearGradient id={glass} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ecf7ff" stopOpacity=".85"/><stop offset=".35" stopColor="#9bbbd3" stopOpacity=".16"/><stop offset=".7" stopColor="#fafcff" stopOpacity=".5"/><stop offset="1" stopColor="#677b8f" stopOpacity=".45"/></linearGradient></defs>
  {root
   ? <g className="prism-glow"><circle className="source-halo" cx="60" cy="56" r="34"/><circle className="source-ring" cx="60" cy="56" r="22"/><ellipse className="lamp-base" cx="60" cy="68" rx="25" ry="22"/><circle className="source-core" cx="60" cy="56" r="9"/></g>
   : <g className="prism-glass">
      <path className="glass-shadow" d="M24 95L108 95L65 22Z"/>
      <path className="glass-side" d="M60 12L69 20L112 95L103.3 87Z"/>
      <path className="glass-base" d="M16.7 87L103.3 87L112 95L25 95Z"/>
      <path className="prism-body" style={{fill:`url(#${glass})`}} d="M60 12 L103.3 87 L16.7 87 Z"/>
      <path className="glass-reflection" d="M59 20L29 76L42 76L65 34Z"/>
      <path className="glass-reflection fine" d="M69 43L85 73L80 73L66 49Z"/>
      <path className="glass-caustic" d="M24 99Q63 108 111 98"/>
      <path className="glass-highlight" d="M59 17L21 84M63 20L101 85"/>
     </g>}
 </svg>
 <strong>{String(data.title)}</strong><span className="optical-summary">{String(data.summary)}</span><span className="node-bottom">{String(data.connections)} 条关系</span><Handle type="source" position={Position.Right}/></div>;
}

export function RoutingMirror({data,selected}:NodeProps){
 return <div className={`routing-mirror ${selected?'selected':''} ${data.folded?'is-folded':''}`}>
  <Handle type="target" position={Position.Left} isConnectable={false}/>
  <svg viewBox="0 0 76 76" className="mirror-shape" aria-hidden="true">
   <g className="mirror-inner" transform={`rotate(${Number(data.angle)} 38 38)`}>
    <path className="mirror-halo" d="M10 38H66"/>
    <path className="mirror-metal" d="M9 36H67V42H9Z"/><path className="mirror-surface" d="M10 38H66"/>
    <path className="mirror-edge" d="M13 42H63"/>
   </g>
   <circle className="mirror-pin" cx="38" cy="38" r="1.8"/>
  </svg>
  {typeof data.onToggle==='function'&&<button type="button" className="mirror-fold nodrag nopan" aria-expanded={!data.folded} aria-label={`${data.folded?'展开':'折叠'}关系：${String(data.title)}`} title={data.folded?`展开：${String(data.targetTitle||'下一层知识')}`:'折叠这条关系的下游'} onClick={event=>{event.stopPropagation();(data.onToggle as ()=>void)();}}>{data.folded?'+':'−'}</button>}
  <span className="mirror-relation-name">{String(data.title)}</span>
  {!!data.preview&&<small>目标预览 · 未发布</small>}
  <Handle type="source" position={Position.Right} isConnectable={selected} isConnectableStart={selected}/>
 </div>;
}
