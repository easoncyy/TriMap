'use client';
import {Handle,Position,type NodeProps} from '@xyflow/react';


const point = (p: {x: number; y: number}) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
const line = (points: {x: number; y: number}[]) => points.map(point).join(' L ');

export function KnowledgePrism({data,selected}:NodeProps){
 const color=String(data.color),root=!!data.lightSource;
 return <div className={`knowledge-node optical-node ${selected?'selected':''} ${root?'light-source':''}`} style={{'--node-color':color} as React.CSSProperties}>
 <Handle type="target" position={Position.Left}/><span className="node-kind">{root?'光源':String(data.kind)} · {String(data.dimension)}</span>
 <svg viewBox="0 0 120 120" className="prism-shape" aria-hidden="true">
  {root
   ? <g className="prism-glow"><circle className="source-halo" cx="60" cy="56" r="34"/><circle className="source-ring" cx="60" cy="56" r="22"/><circle className="source-core" cx="60" cy="56" r="9"/></g>
   : <g className="prism-glass">
      <path className="prism-body" d="M60 12 L103.3 87 L16.7 87 Z"/>
     </g>}
 </svg>
 <strong>{String(data.title)}</strong><span className="optical-summary">{String(data.summary)}</span><span className="node-bottom">{String(data.connections)} 条关系</span><Handle type="source" position={Position.Right}/></div>;
}

export function RoutingMirror({data,selected}:NodeProps){
 return <div className={`routing-mirror ${selected?'selected':''}`}>
  <Handle type="target" position={Position.Left} isConnectable={false}/>
  <svg viewBox="0 0 76 76" className="mirror-shape" aria-hidden="true">
   <g className="mirror-inner" transform={`rotate(${Number(data.angle)} 38 38)`}>
    <path className="mirror-halo" d="M10 38H66"/>
    <path className="mirror-surface" d="M10 38H66"/>
    <path className="mirror-edge" d="M13 42H63"/>
   </g>
   <circle className="mirror-pin" cx="38" cy="38" r="1.8"/>
  </svg>
  <span className="mirror-relation-name">{String(data.title)}</span>
  {!!data.preview&&<small>目标预览 · 未发布</small>}
  <Handle type="source" position={Position.Right} isConnectable={selected} isConnectableStart={selected}/>
 </div>;
}
