'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {PlanetaryOrbits} from './optical/PlanetaryOrbits';
import {mountNightSky} from './optical/night-sky';
import {orbitStones,type GlassAnchor} from './optical/orbit-glass';
import {createPrismSurface} from './optical/prism-surface';
import {Plus,Minus,Pause,Play} from 'lucide-react';
import {locateCamera,restoreCamera,type CameraSnapshot,type RevealRequest} from '@/lib/exploration-navigation';
import {placeLabelWithin,type Box,type Segment} from '@/lib/label-placement';
import {ReactFlow,Controls,ControlButton,useNodesState,type Viewport,type ReactFlowProps,type ReactFlowInstance,type Node,type NodeChange} from '@xyflow/react';

import {wrapOrbit,fullTurn,projectOrbit,opticalOffset} from '@/lib/orbit';
import {mirrorAngle,type Point} from '@/lib/optics';
import {bindOrbitInput} from './orbit-input';

type Props=ReactFlowProps&{active?:boolean;orbitAngle?:number;onOrbitCommit?:(angle:number)=>void;fitScope:string;reveal?:RevealRequest|null;onRevealHandled?:(epoch:number)=>void;onViewChange?:(snapshot:CameraSnapshot)=>void};
// Keep the cloud legible in fitted, sparse maps without obscuring close-up nodes.
// Only its visual scale is normalized; pointer position remains synchronous.
const cursorCloudScale=(zoom:number)=>Math.max(.28,Math.min(.72,.7*Math.sqrt(Math.max(0,zoom))));
// Moderate overview scaling: text stays between 80% and 100% of its role size.
const labelScreenScale=(zoom:number)=>Math.max(.8,Math.min(1,Math.pow(Math.max(.001,zoom)/.4,.12)));
const labelTransformScale=(zoom:number)=>labelScreenScale(zoom)/zoom;
/** React Flow owns geometry. Labels/leaders are disposable screen-space presentation. */
export default function GraphCanvas({nodes:incoming=[],active=true,orbitAngle,onOrbitCommit,fitScope,reveal,onRevealHandled,onViewChange,...props}:Props){
 const [nodes,setNodes,onNodesChange]=useNodesState(incoming);
 const container=useRef<HTMLDivElement>(null),leaders=useRef<SVGSVGElement>(null);
 const [instance,setInstance]=useState<ReactFlowInstance|null>(null);
 const [skyPaused,setSkyPaused]=useState(false);
 useEffect(()=>{try{setSkyPaused(localStorage.getItem('trimap-optical-sky')==='paused');}catch{}},[]);
 const [hiddenLabels,setHiddenLabels]=useState(0);
 const dragging=useRef<string|null>(null),hovered=useRef<string|null>(null);
 const labelFrame=useRef(0),fitted=useRef(false),autoFit=useRef(true);
 const lastReveal=useRef<number|null>(null);
 const labelOffsets=useRef(new WeakMap<HTMLElement,{x:number;y:number}>());
 const rayEndpoints=useRef(new WeakMap<SVGPathElement,{d:string;a:DOMPoint;b:DOMPoint}>());
 const pendingReveal=useRef(reveal);pendingReveal.current=reveal;
 const viewCallback=useRef(onViewChange);viewCallback.current=onViewChange;
 function publishView(){const host=container.current;if(host&&instance)viewCallback.current?.({viewport:instance.getViewport(),width:host.clientWidth,height:host.clientHeight});}
 const canceledDrag=useRef<string|null>(null),originalPosition=useRef<Point|null>(null);
 const orbitEnabled=orbitAngle!==undefined;
 const [angle,setAngle]=useState(orbitAngle??0);
 const angleRef=useRef(orbitAngle??0),orbitFrame=useRef(0),turning=useRef(false);
 const sliderTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const commit=useRef(onOrbitCommit);
 useLayoutEffect(()=>{commit.current=onOrbitCommit;},[onOrbitCommit]);
 useLayoutEffect(()=>{angleRef.current=orbitAngle??0;setAngle(orbitAngle??0);},[orbitAngle]);
 const source=incoming.find(n=>n.data.lightSource);
 const prismCenter=opticalOffset('spectral');
 const pivotX=(source?.position.x??0)+prismCenter.x,pivotY=(source?.position.y??0)+prismCenter.y;
 const pivot=useMemo(()=>({x:pivotX,y:pivotY}),[pivotX,pivotY]);
 const projected=useMemo(()=>{
  if(!orbitEnabled||angle===0)return nodes;
  const centers=new Map<string,Point>();
  const result=nodes.map(n=>{
   const offset=opticalOffset(n.type);
   const center={x:n.position.x+offset.x,y:n.position.y+offset.y};
   const p=n.data.lightSource?{...center,scale:1,depth:0}:projectOrbit(center,pivot,angle);
   centers.set(n.id,p);
   return {...n,position:{x:p.x-offset.x,y:p.y-offset.y},zIndex:Math.round(500+450*Math.tanh(p.depth/1000)),data:{...n.data,orbitScale:p.scale}};
  });
  const sources=new Map<string,string>(),targets=new Map<string,string>();
  for(const edge of props.edges??[]){sources.set(edge.target,edge.source);targets.set(edge.source,edge.target);}
  return result.map(n=>{
   if(n.type!=='mirror')return n;
   const a=centers.get(sources.get(n.id)??''),b=centers.get(targets.get(n.id)??'');
   return a&&b?{...n,data:{...n.data,angle:mirrorAngle(a,centers.get(n.id)!,b)}}:n;
  });
 },[nodes,pivot,angle,props.edges,orbitEnabled]);
 function layoutPoint(id:string,type:string|undefined,position:Point){
  if(!orbitEnabled||id===source?.id)return position;
  const offset=opticalOffset(type);
  const p=projectOrbit({x:position.x+offset.x,y:position.y+offset.y},pivot,-angleRef.current);
  return {x:p.x-offset.x,y:p.y-offset.y};
 }
 function beginTurn(){
  if(turning.current)return;
  turning.current=true;autoFit.current=false;
  if(container.current)container.current.dataset.turning='true';
 }
 function turn(delta:number){
  if(!delta)return;
  beginTurn();
  angleRef.current=wrapOrbit(angleRef.current+delta);
  if(!orbitFrame.current)orbitFrame.current=requestAnimationFrame(()=>{orbitFrame.current=0;setAngle(angleRef.current);});
 }
 function finishTurn(){
  if(!turning.current)return;
  clearTimeout(sliderTimer.current);
  turning.current=false;
  if(container.current)delete container.current.dataset.turning;
  cancelAnimationFrame(orbitFrame.current);orbitFrame.current=0;
  setAngle(angleRef.current);commit.current?.(angleRef.current);latestDraw.current();
 }
 useEffect(()=>{
  if(!active||!orbitEnabled||!container.current||!instance)return;
  const interruptDrag=()=>{
   const id=dragging.current,position=originalPosition.current;
   if(!id||!position)return;
   canceledDrag.current=id;dragging.current=null;
   setNodes(ns=>ns.map(n=>n.id===id?{...n,position,dragging:false}:n));
  };
  const unbind=bindOrbitInput(container.current,instance,props.minZoom??.02,props.maxZoom??1.8,turn,finishTurn,()=>{autoFit.current=false;},interruptDrag);
  return ()=>{unbind();clearTimeout(sliderTimer.current);cancelAnimationFrame(orbitFrame.current);orbitFrame.current=0;};
 },[active,instance,props.minZoom,props.maxZoom,orbitEnabled]);
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const latestDraw=useRef(()=>{});
 // Hover changes the glass illumination only. Reprioritizing collision placement
 // under the pointer moves its own hit target and can create an enter/leave loop.
 function followHover(id:string|null){
  if(hovered.current===id)return;
  hovered.current=id;
  surface.current?.illuminate(id);
 }
 const glassCanvas=useRef<HTMLCanvasElement|null>(null);
 const cloudSize=useRef<HTMLSpanElement>(null);
 const paintedCamera=useRef<Viewport|null>(null);
 const visibleLabels=useRef<HTMLElement[]>([]);
 const trackedZoom=useRef(0);
 const canvasSize=useRef({width:0,height:0});
 const cameraSettle=useRef<ReturnType<typeof setTimeout>|null>(null);
 function settleCamera(){
  if(cameraSettle.current)clearTimeout(cameraSettle.current);
  cameraSettle.current=setTimeout(()=>{
   inCameraMotion.current=false;
   latestDraw.current();
  },160);
 }
 useEffect(()=>()=>{if(cameraSettle.current)clearTimeout(cameraSettle.current);},[]);
 const inCameraMotion=useRef(false);
 function followCamera(view:Viewport){
  const base=paintedCamera.current,host=container.current;
  if(cloudSize.current)cloudSize.current.style.transform=`scale(${cursorCloudScale(view.zoom)})`;
  if(!base||!host)return;
  if(!host.classList.contains('camera-travel'))host.classList.add('camera-travel');
  // Use the same continuous text scale during camera travel and settled placement.
  // Only labels that were placed at the last settled view need tracking.
  if(trackedZoom.current!==view.zoom){
   const transform=`translateX(-50%) scale(${labelTransformScale(view.zoom)})`;
   for(const label of visibleLabels.current)label.style.transform=transform;
   trackedZoom.current=view.zoom;
  }
  const scale=view.zoom/base.zoom,x=view.x-base.x*scale,y=view.y-base.y*scale;
  const transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
  if(glassCanvas.current)glassCanvas.current.style.transform=transform;
  if(leaders.current)leaders.current.style.transform=transform;
  // Beyond the captured part of the sky, the graph's own vector bodies follow the camera.
  host.classList.toggle('beyond-glass',Math.abs(x)>canvasSize.current.width*.35||Math.abs(y)>canvasSize.current.height*.35||scale<.66||scale>1.6);
 }
 const glassAnchors=useRef(new Map<string,GlassAnchor>());
 const measuredZoom=useRef(0);
 const surface=useRef<ReturnType<typeof createPrismSurface>|null>(null);
 function arrangeLabels(){
  cancelAnimationFrame(labelFrame.current);
  labelFrame.current=requestAnimationFrame(()=>{
   const host=container.current;if(!host||host.inert||!instance)return;
   if(inCameraMotion.current||dragging.current)return;
   const view=instance.getViewport(),zoom=view.zoom;
   if(turning.current&&zoom===measuredZoom.current){
    const stones=orbitStones(projected,glassAnchors.current,view);
    if(stones){
     const {width,height}=canvasSize.current;
     surface.current?.draw(width,height,stones);
     return;
    }
   }
   if(cloudSize.current)cloudSize.current.style.transform=`scale(${cursorCloudScale(zoom)})`;
   paintedCamera.current=view;
   for(const label of visibleLabels.current)label.style.removeProperty('transform');
   trackedZoom.current=zoom;
   if(glassCanvas.current)glassCanvas.current.style.transform='';
   if(leaders.current)leaders.current.style.transform='';
   host.classList.remove('beyond-glass','dragging-object','camera-travel');
   host.style.setProperty('--label-scale',String(1/zoom));
   host.style.setProperty('--label-text-scale',String(labelTransformScale(zoom)));
   host.dataset.overview=String(zoom<.4);host.dataset.detail=String(zoom>=.65);
   host.querySelectorAll<HTMLElement>('.react-flow__node').forEach(owner=>{owner.dataset.labelPriority=String(owner.classList.contains('selected'));});
   const labels=Array.from(host.querySelectorAll<HTMLElement>('.graph-label'));
   // Hidden labels still have geometry. Undo the previous world-space offset in math,
   // so measuring a settled camera never toggles visibility across the whole graph.
   const outer=host.getBoundingClientRect();
   canvasSize.current={width:outer.width,height:outer.height};
   const rect=(el:Element):Box=>{const r=el.getBoundingClientRect();return {x:r.x-outer.x,y:r.y-outer.y,width:r.width,height:r.height};};
   const bounds={x:12,y:12,width:Math.max(0,outer.width-24),height:Math.max(0,outer.height-64)};
   const controlBoxes=Array.from(host.querySelectorAll('.orbit-control,.react-flow__controls,.overview-note')).map(rect);
   const lines:Segment[]=[];
   host.querySelectorAll<SVGPathElement>('.react-flow__edge-path').forEach(path=>{
    const d=path.getAttribute('d')||'';
    let endpoints=rayEndpoints.current.get(path);
    if(!endpoints||endpoints.d!==d){
     endpoints={d,a:path.getPointAtLength(0),b:path.getPointAtLength(path.getTotalLength())};
     rayEndpoints.current.set(path,endpoints);
    }
    const {a,b}=endpoints;
    lines.push({a:{x:view.x+a.x*zoom,y:view.y+a.y*zoom},b:{x:view.x+b.x*zoom,y:view.y+b.y*zoom}});
   });
   const measured=labels.map(el=>{
    const owner=el.closest<HTMLElement>('.react-flow__node')!;
    const shape=owner.querySelector('.prism-shape,.mirror-shape')!;
    const priority=owner.dataset.labelPriority==='true';
    const box=rect(el),offset=labelOffsets.current.get(el);
    if(offset){box.x-=offset.x*zoom;box.y-=offset.y*zoom;}
    // WebKit rounds transformed DOMRects; remove subpixel noise before the
    // discrete placement search chooses which side of a neighbouring label to use.
    box.x=Math.round(box.x*16)/16;box.y=Math.round(box.y*16)/16;
    return {el,rank:owner.classList.contains('selected')?2:priority?1:0,owner:owner.dataset.id!,path:owner.classList.contains('navigation-mirror'),box,shape:rect(shape),priority,mirror:owner.classList.contains('react-flow__node-mirror')};
   }).sort((a,b)=>b.rank-a.rank||Number(a.mirror)-Number(b.mirror));
   // Project the material using the same measured screen rectangles as the labels.
   // React Flow remains the sole owner of node coordinates, hit targets and camera.
   const bodies=new Map(measured.map(item=>[item.owner,item]));
   const beams=new Map<string,{mirror:typeof measured[number];active:boolean}>();
   for(const edge of props.edges||[]){
    const from=bodies.get(edge.source),to=bodies.get(edge.target);
    if(!from||!to||from.mirror===to.mirror)continue;
    const [stone,mirror]=from.mirror?[to,from]:[from,to];
    const active=mirror.rank===2 || !!edge.data?.active;
    if(active||!beams.has(stone.owner))beams.set(stone.owner,{mirror,active});
   }
   const anchors=new Map<string,GlassAnchor>();
   const stones=[];
   for(const item of measured){
    const {x,y,width,height}=item.shape;
    const beam=beams.get(item.owner),mirror=beam?.mirror.shape;
    const material=item.mirror?undefined:{lens:item.el.parentElement?.dataset.lens,focused:item.rank===2,energy:beam?.active?1:item.rank===2?.48:.12};
    if(material){
     const light=mirror?{x:mirror.x+mirror.width/2-x-width/2,y:y+height/2-mirror.y-mirror.height/2}:{x:-.85,y:.45};
     stones.push({...material,id:item.owner,x,y,span:width,light});
    }
    const node=instance.getInternalNode(item.owner);
    if(node){
     const position=node.internals.positionAbsolute;
     anchors.set(item.owner,{
      offset:{x:(x+width/2-view.x)/zoom-position.x,y:(y+height/2-view.y)/zoom-position.y},
      span:width/zoom/Number(node.data.orbitScale??1),mirrorId:beam?.mirror.owner,material,
     });
    }
   }
   glassAnchors.current=anchors;measuredZoom.current=zoom;
   surface.current?.draw(outer.width,outer.height,stones);
   if(turning.current)return;
   const obstacles=measured.map(item=>item.shape).concat(controlBoxes);
   const peerShapes=[measured.filter(item=>!item.mirror).map(item=>item.shape),measured.filter(item=>item.mirror).map(item=>item.shape)];
   const labelObstacles:Box[]=[];
   let hidden=0;const leaderLines:Array<Segment&{owner:string;priority:boolean}>=[];
   const placed=measured.map(item=>{
    const {box,shape,priority}=item;
    const onScreen=shape.x+shape.width>=0&&shape.y+shape.height>=0&&shape.x<=outer.width&&shape.y<=outer.height;
    const eligible=onScreen&&(!item.mirror||zoom>=.4||priority||item.path);
    // Start below the visible glass, even when its apparent size is compensated for zoom.
    const anchor=item.mirror?box:{...box,x:shape.x+(shape.width-box.width)/2,y:shape.y+shape.height*.91+3};
    let result=eligible?placeLabelWithin(anchor,obstacles,lines,bounds,priority?112:zoom<.4?64:96,{owner:shape,peers:peerShapes[Number(item.mirror)]}):null;
    // Near the bottom edge, a label below its prism can hit the overview note.
    // Try the other side of the same prism before treating its title as optional.
    if(eligible&&!item.mirror&&!result){
     const above={...box,x:shape.x+(shape.width-box.width)/2,y:shape.y-box.height-8};
     result=placeLabelWithin(above,obstacles,lines,bounds,64,{owner:shape,peers:peerShapes[0]});
    }
    // Selected/focused text wins over the optional labels, never over the zoom controls.
    if(eligible&&priority&&!result)result=placeLabelWithin(box,[shape,...labelObstacles,...controlBoxes],lines,bounds,112);
    if(!result){if(onScreen)hidden++;return {...item,result:null};}
    obstacles.push(result);labelObstacles.push(result);
    if(Math.hypot(result.x-box.x,result.y-box.y)>12||priority){
     const a={x:shape.x+shape.width/2,y:shape.y+shape.height/2};
     const b={x:Math.max(result.x,Math.min(a.x,result.x+result.width)),y:Math.max(result.y,Math.min(a.y,result.y+result.height))};
     const dx=b.x-a.x,dy=b.y-a.y;
     const t=Math.min(1,1/Math.max(Math.abs(dx)/(shape.width/2||1),Math.abs(dy)/(shape.height/2||1)));
     leaderLines.push({a:{x:a.x+dx*t,y:a.y+dy*t},b,owner:item.owner,priority});
    }
    return {...item,result};
   });
   visibleLabels.current=placed.filter(item=>item.result).map(item=>item.el);
   placed.forEach(({el,box,result})=>{
    el.style.visibility=result?'visible':'hidden';
    el.dataset.placed=String(!!result);
    if(!result){labelOffsets.current.delete(el);el.style.removeProperty('translate');return;}
    const x=(result.x-box.x)/zoom,y=(result.y-box.y)/zoom;
    labelOffsets.current.set(el,{x,y});
    el.style.translate=`${x}px ${y}px`;
   });
   if(leaders.current){
    leaders.current.replaceChildren(...leaderLines.map(({a,b,owner,priority})=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [key,value] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,String(value));line.dataset.owner=owner;line.classList.toggle('priority-leader',priority);return line;}));
   }
   setHiddenLabels(previous=>previous===hidden?previous:hidden);
  });
 }
 latestDraw.current=arrangeLabels;
 const hasOverviewNote=hiddenLabels>0;
 useEffect(()=>{
  const note=container.current?.querySelector('.overview-note');
  if(!note)return;
  const observer=new ResizeObserver(()=>latestDraw.current());
  observer.observe(note);
  return()=>observer.disconnect();
 },[hasOverviewNote]);
 useEffect(()=>{
  const host=container.current;
  if(!host)return;
  const canvas=document.createElement('canvas');
  canvas.className='prism-surface';
  canvas.setAttribute('aria-hidden','true');
  host.prepend(canvas);glassCanvas.current=canvas;
  surface.current=createPrismSurface(canvas,()=>latestDraw.current());
  const removeSky=mountNightSky(host);
  arrangeLabels();
  return ()=>{removeSky();surface.current?.dispose();surface.current=null;glassCanvas.current=null;canvas.remove();};
 },[]);
 function fitAll(){
  if(!instance)return;
  autoFit.current=true;
  // The former .25 minimum cropped the graph before fitView could fit it.
  void instance.fitView({padding:.2,minZoom:.02,maxZoom:1,duration:0}).then(arrangeLabels);
 }
 useEffect(()=>{
  if(!active){if(turning.current)finishTurn();return;}
  arrangeLabels();return()=>cancelAnimationFrame(labelFrame.current);
 },[active,projected,props.edges,instance]);
 useEffect(()=>{
  let alive=true;
  const refresh=()=>{if(alive)latestDraw.current();};
  document.fonts.ready.then(refresh);
  document.fonts.addEventListener('loadingdone',refresh);
  return()=>{alive=false;document.fonts.removeEventListener('loadingdone',refresh);};
 },[instance]);
 useEffect(()=>{
  if(!instance||fitted.current||!nodes.length||nodes.some(n=>!n.measured?.width))return;
  fitted.current=true;if(!pendingReveal.current)fitAll();
 },[nodes,instance]);

 function changeNodes(changes:NodeChange[]){
  const selection=changes.find(c=>c.type==='select'&&c.selected);
  if(selection?.type==='select')setNodes(ns=>ns.map(n=>({...n,selected:n.id===selection.id})));
  const allowed=changes.filter(c=>c.type!=='position'||(c.id!==canceledDrag.current&&(!dragging.current||c.id===dragging.current)));
  onNodesChange(allowed.map(c=>c.type==='position'&&c.position?{...c,position:layoutPoint(c.id,nodes.find(n=>n.id===c.id)?.type,c.position)}:c));
 }
 useEffect(()=>{
  if(!instance||!container.current)return;
  let previous={width:container.current.clientWidth,height:container.current.clientHeight};
  let resizeFrame=0;
  const resize=()=>{
    const host=container.current;if(!host)return;
    const width=host.clientWidth,height=host.clientHeight;
    if(width===previous.width&&height===previous.height)return;
    if(pendingReveal.current){arrangeLabels();}
    else if(autoFit.current)fitAll();
    else{const v=instance.getViewport();void instance.setViewport({...v,x:v.x+(width-previous.width)/2,y:v.y+(height-previous.height)/2},{duration:0}).then(arrangeLabels);}
    previous={width,height};
  }
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);});
  observer.observe(container.current);
  return()=>{observer.disconnect();cancelAnimationFrame(resizeFrame);};
 },[instance]);
 useEffect(()=>{
  setNodes(previous=>{
   const previousById=new Map(previous.map(node=>[node.id,node]));
   return incoming.map(node=>{
    const existing=previousById.get(node.id);
    return existing?{...existing,...node,position:dragging.current===node.id?existing.position:node.position,measured:existing.measured}:node;
   });
  });
 },[incoming,setNodes]);
 // Search and view changes refit. Expanding a relation keeps the same camera.
 useEffect(()=>{if(instance&&fitted.current&&!pendingReveal.current)fitAll();},[fitScope,instance]);
 useEffect(()=>{
  if(!instance||!reveal||lastReveal.current===reveal.epoch||!nodes.some(n=>n.id===reveal.id&&n.measured?.width))return;
  autoFit.current=false;
  let frame=0;
  // Let the reading/explorer layout and ResizeObserver settle before locating the target.
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   const host=container.current,node=instance.getInternalNode(reveal.id);if(!host||!node)return;
   lastReveal.current=reveal.epoch;
   const current=instance.getViewport();
   const shape=host.querySelector(`[data-id="${CSS.escape(reveal.id)}"] .prism-shape, [data-id="${CSS.escape(reveal.id)}"] .mirror-shape`);if(!shape)return;
   const r=shape.getBoundingClientRect(),h=host.getBoundingClientRect();
   const object={x:(r.x-h.x-current.x)/current.zoom,y:(r.y-h.y-current.y)/current.zoom,width:r.width/current.zoom,height:r.height/current.zoom};
   const safe={x:64,y:16,width:Math.max(1,host.clientWidth-80),height:Math.max(1,host.clientHeight-84)};
   const origin=reveal.restore?restoreCamera(reveal.restore,host.clientWidth,host.clientHeight):current;
   const next=locateCamera(origin,object,safe,!!reveal.restore);
   const changed=Math.abs(current.x-next.x)>.5||Math.abs(current.y-next.y)>.5||Math.abs(current.zoom-next.zoom)>.001;
   void (changed?instance.setViewport(next,{duration:reduced()?0:180}):Promise.resolve(true)).then(()=>{
    if(!container.current||lastReveal.current!==reveal.epoch)return;arrangeLabels();publishView();onRevealHandled?.(reveal.epoch);
   });
  });});
  return()=>cancelAnimationFrame(frame);
 },[instance,reveal,nodes]);
 return <div className="graph-host" inert={!active} data-orbit-degrees={Math.round(angle*360/fullTurn)} data-dense={incoming.filter(n=>n.type==='spectral').length>14} data-sky-paused={skyPaused} ref={container} onMouseOver={event=>{const id=(event.target as Element).closest<HTMLElement>('.react-flow__node')?.dataset.id||null;followHover(id);}} onMouseLeave={()=>followHover(null)} onBlur={()=>followHover(null)} onFocus={event=>{followHover((event.target as Element).closest<HTMLElement>('.react-flow__node')?.dataset.id||null);}}>
  <div className="sky-depth" aria-hidden="true"><i className="gas gas-far"/></div>
  <div className="cursor-bloom" aria-hidden="true"><span className="cursor-dust" ref={cloudSize}><i className="nebula-wake"/><i className="cloud-swirl"/></span></div>
  <ReactFlow {...props} fitView={false} onMoveEnd={(event,viewport)=>{settleCamera();publishView();props.onMoveEnd?.(event,viewport);}} onMoveStart={(event,viewport)=>{if(cameraSettle.current)clearTimeout(cameraSettle.current);inCameraMotion.current=true;if(event)autoFit.current=false;props.onMoveStart?.(event,viewport);}} onMove={(event,viewport)=>{inCameraMotion.current=true;followCamera(viewport);props.onMove?.(event,viewport);}} multiSelectionKeyCode={null} selectionKeyCode={null} selectionOnDrag={false} onNodeDragStart={(event,node,items)=>{canceledDrag.current=null;originalPosition.current=nodes.find(n=>n.id===node.id)?.position??null;dragging.current=node.id;container.current?.classList.add('dragging-object');autoFit.current=false;setNodes(ns=>ns.map(n=>({...n,selected:n.id===node.id})));props.onNodeDragStart?.(event,node,items);}} onNodeDragStop={(event,node,items)=>{if(node.id===canceledDrag.current)return;const original=(n:Node)=>({...n,position:layoutPoint(n.id,n.type,n.position)});props.onNodeDragStop?.(event,original(node),items.map(original));dragging.current=null;arrangeLabels();}} onInit={flow=>{setInstance(flow);props.onInit?.(flow);}} nodes={projected} onNodesChange={changeNodes}>
   {props.children}<PlanetaryOrbits nodes={nodes}/><Controls showZoom={false} showInteractive={false} onFitView={fitAll}><ControlButton aria-label="Zoom In" onClick={()=>{autoFit.current=false;void instance?.zoomIn({duration:reduced()?0:180});}}><Plus/></ControlButton><ControlButton aria-label="Zoom Out" onClick={()=>{autoFit.current=false;void instance?.zoomOut({duration:reduced()?0:180});}}><Minus/></ControlButton><ControlButton className="sky-control" aria-label="暂停星云与环绕星光" aria-pressed={skyPaused} title="暂停或继续星云与环绕星光" onClick={()=>{const value=!skyPaused;setSkyPaused(value);try{localStorage.setItem('trimap-optical-sky',value?'paused':'running');}catch{}}}>{skyPaused?<Play/>:<Pause/>}</ControlButton></Controls>
  </ReactFlow>
  {orbitEnabled&&<label className="orbit-control" title="触控板双指横滑或拧转；触屏双指旋转">
   <span>星环</span><input type="range" aria-label="星环旋转角度" min={0} max={360} step={1} value={Math.round(angle*360/fullTurn)} onPointerUp={finishTurn} onKeyUp={finishTurn} onBlur={finishTurn} onChange={event=>{
    const next=Number(event.target.value)*fullTurn/360;
    beginTurn();angleRef.current=next;setAngle(next);
    clearTimeout(sliderTimer.current);sliderTimer.current=setTimeout(finishTurn,150);
   }}/><output>{Math.round(angle*360/fullTurn)}°</output>
  </label>}
  <svg ref={leaders} className="label-leaders" aria-hidden="true"/>
  {hiddenLabels>0&&<div className="overview-note">概览已收起 {hiddenLabels} 个拥挤标签；选中物体、放大或切换列表查看。</div>}
 </div>;
}
