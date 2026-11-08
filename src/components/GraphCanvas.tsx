'use client';
import {useEffect,useRef,useState} from 'react';
import {ReactFlow,useNodesState,type ReactFlowProps,type ReactFlowInstance} from '@xyflow/react';

/** Keep React Flow's measured dimensions and drag state inside the canvas.
 * The application only persists completed drags, not every pointer movement.
 */
export default function GraphCanvas({nodes:incoming=[],...props}:ReactFlowProps){
 const [nodes,setNodes,onNodesChange]=useNodesState(incoming);
 const container=useRef<HTMLDivElement>(null);
 const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
 useEffect(()=>{
  if(!instance||!container.current)return;
  let frame=0;
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>instance.fitView({padding:0.2,maxZoom:1,duration:180}));});
  observer.observe(container.current);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[instance]);
 useEffect(()=>{
  setNodes(previous=>incoming.map(node=>{
   const existing=previous.find(item=>item.id===node.id);
   return existing?{...existing,...node,measured:existing.measured}:node;
  }));
 },[incoming,setNodes]);
 return <div ref={container} style={{width:'100%',height:'100%',minHeight:0}}><ReactFlow {...props} onInit={flow=>{setInstance(flow);props.onInit?.(flow);}} nodes={nodes} onNodesChange={onNodesChange}/></div>;
}
