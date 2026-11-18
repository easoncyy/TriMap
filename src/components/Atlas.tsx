'use client';
import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Background} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import SpectralEdge from './SpectralEdge';
import {KnowledgePrism,RoutingMirror} from './OpticalNodes';
import {opticalView,lightPath,lightDepths,mirrorAngle,type Mirror,type Point} from '@/lib/optics';
import GraphCanvas from './GraphCanvas';
import type {CameraSnapshot,RevealRequest} from '@/lib/exploration-navigation';
import ReadingPanel from './ReadingPanel';
import {useInterfaceMotion} from '@/hooks/useInterfaceMotion';
import {filterKnowledge} from '@/lib/graph-filter';

import UsageGuide from './UsageGuide';
import {foldedView} from '@/lib/folding';
import {balancedLayout,extendPositions,routeFrontiers,primaryTree,LAYOUT_VERSION,layoutPrisms,routeMirrors} from '@/lib/layout';
import {graphChanges} from '@/lib/diff';
import {EXPLORATION_VERSION,parseExploration,emptyExploration,loadExploration,mirrorViewKey,readCheckpoint,writeCheckpoint,writeExploration,type ExplorationState} from '@/lib/exploration';
import {ArrowUpRight,ArrowLeft,Search,Plus,SlidersHorizontal,MessageSquare,GitBranch,X,Download,Check,Layers,Compass,History,Lock,ChevronRight,Send,Maximize2,Minimize2} from 'lucide-react';
import {lenses,type Lens,type KnowledgeNode,type Relation,type Store,type AtlasMeta} from '@/lib/model';
type Snapshot=Omit<Store,'revisions'>&{contentVersion?:string;meta:AtlasMeta;revisions:{id:string;date:string;reason:string;changes?:string[]}[]};
const AtlasLibrary=lazy(()=>import('./AtlasLibrary'));
const ConflictReview=lazy(()=>import('./ConflictReview'));
const EMPTY_NODES:KnowledgeNode[]=[];
const EMPTY_EDGES:Relation[]=[];
function LoadingDialog({close}:{close:()=>void}){
 return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="正在加载">
  <p role="status">正在加载…</p><button onClick={close}>关闭</button>
 </section></div>;
}
const nodeTypes={spectral:KnowledgePrism,mirror:RoutingMirror};
const edgeTypes={spectral:SpectralEdge};
const lensColor=(lens:Lens)=>`var(--atlas-lens-${lens})`;
const emptyForm:KnowledgeNode={id:'',title:'',kind:'概念',lens:'domain',summary:'',body:'',sources:[],status:'待核实',x:400,y:250};
function readLocal(key:string){try{return localStorage.getItem(key);}catch{return null;}}
function writeLocal(key:string,value:string){try{localStorage.setItem(key,value);}catch{/* private mode or quota: exploration stays in memory */}}
export default function Atlas(){
 const currentAtlas=useRef('official'),loadedFor=useRef(''),latest=useRef<ExplorationState>(emptyExploration()),writeTimer=useRef<number|undefined>(undefined);
 const [prismMode,setPrismMode]=useState<'dispersion'|'refraction'>('dispersion'),[roots,setRoots]=useState<Partial<Record<Lens,string>>>({}),[mirrors,setMirrors]=useState<Mirror[]>([]),[mirrorId,setMirrorId]=useState<string|null>(null),[redirectTarget,setRedirectTarget]=useState(''),[pickingMirror,setPickingMirror]=useState(false);
 const [folds,setFolds]=useState<Record<string,Record<string,boolean>>>({});
 const [hoveredEdge,setHoveredEdge]=useState<string|null>(null);
 const [allRelations,setAllRelations]=useState(false),[manualPositions,setManualPositions]=useState<string[]>([]);
 const [layoutEpoch,setLayoutEpoch]=useState(0);
 const [explorerOpen,setExplorerOpen]=useState(false);
 const [modeMotion,enableModeMotion]=useState(false),[explorerMotion,enableExplorerMotion]=useState(false);
 const [immersive,setImmersive]=useState(false),[wide,setWide]=useState(false);
 const immersiveRef=useRef(false);immersiveRef.current=immersive;
 const modeToggle=useRef<HTMLButtonElement>(null);
 const workspaceShell=useRef<HTMLDivElement>(null);
 useInterfaceMotion(workspaceShell,immersive,modeMotion,'.canvas-toolbar,.tool-main');
 useInterfaceMotion(workspaceShell,explorerOpen,explorerOpen&&explorerMotion,'#exploration-panel');
 const workbenchPanels=useRef({explorer:false,detail:false});
 const explorerToggle=useRef<HTMLButtonElement>(null);
 const closeDetail=useCallback(()=>{setDetailOpen(false);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-controls="knowledge-reading"]')?.focus());},[]);
 useEffect(()=>{const media=matchMedia('(min-width: 1200px)');const update=()=>{setWide(media.matches);if(!immersiveRef.current)setExplorerOpen(media.matches);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const closeExplorer=useCallback(()=>{setExplorerOpen(false);requestAnimationFrame(()=>explorerToggle.current?.focus());},[]);

 const [refractedPositions,setRefractedPositions]=useState<Record<string,Point>>({});
 const [detailOpen,setDetailOpen]=useState(false),[linking,setLinking]=useState(false),[linkPending,setLinkPending]=useState(false);
 const [atlasId,setAtlasId]=useState('official'),[library,setLibrary]=useState(false),[feedbackTarget,setFeedbackTarget]=useState('current'),[feedbackCategory,setFeedbackCategory]=useState('关系疑问'),[suggestion,setSuggestion]=useState(''),[feedbackScope,setFeedbackScope]=useState<'all'|'target'>('target');
 const [store,setStore]=useState<Snapshot|null>(null),[admin,setAdmin]=useState(false),[lens,setLens]=useState<Lens>('domain');
 const [focus,setFocus]=useState('task'),[trail,setTrail]=useState<string[]>([]),[expanded,setExpanded]=useState(false),[query,setQuery]=useState(''),[kind,setKind]=useState('全部类型'),[list,setList]=useState(false);
 const [panel,setPanel]=useState<'detail'|'feedback'|'history'>('detail'),[modal,setModal]=useState<'login'|'node'|'relation'|'publish'|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const [password,setPassword]=useState(''),[form,setForm]=useState<KnowledgeNode>(emptyForm),[edgeForm,setEdgeForm]=useState<Relation>({id:'',source:'',target:'',label:'',reason:''}),[feedbackText,setFeedbackText]=useState(''),[author,setAuthor]=useState(''),[publishReason,setPublishReason]=useState(''),[edgeId,setEdgeId]=useState<string|null>(null);
 const [positions,setPositions]=useState<Record<string,{x:number;y:number}>>({}),[showGuide,setShowGuide]=useState(false),[lensSweep,setLensSweep]=useState(0);
 const editVersion=useRef<string|undefined>(undefined),writeInFlight=useRef(false);
 const [conflict,setConflict]=useState<{local:unknown;latest?:Snapshot}|null>(null),[reviewOpen,setReviewOpen]=useState(false),[localBackup,setLocalBackup]=useState<unknown[]>([]);
 const editorContent=useRef<unknown>(null);editorContent.current={node:form,relation:edgeForm,publishReason};
 const refresh=useCallback(async()=>{const r=await fetch('/api/atlas?id='+encodeURIComponent(atlasId));const b=await r.json();if(currentAtlas.current!==atlasId)return;if(!r.ok)throw Error(b.error||'无法加载图谱');setStore(b);},[atlasId]);
 useEffect(()=>{if(!ready)return;Promise.all([refresh(),fetch('/api/session').then(r=>r.json()).then(s=>setAdmin(s.maintainer))]).catch(e=>setError(e.message));},[refresh,ready]);
 useEffect(()=>{const id=new URLSearchParams(location.search).get('atlas')||'official';currentAtlas.current=id;setAtlasId(id);loadView(id);setReady(true);},[]);
 function applyExploration(state:ExplorationState){if(state.layoutVersion!==LAYOUT_VERSION){if(Object.keys(state.positions).length||Object.keys(state.refractedPositions).length||state.mirrors.length)writeLocal('spectrum-layout-backup:'+currentAtlas.current,JSON.stringify(state));state={...state,positions:Object.fromEntries(Object.entries(state.positions).filter(([id])=>state.manualPositions?.includes(id))),refractedPositions:Object.fromEntries(Object.entries(state.refractedPositions).filter(([id])=>state.manualPositions?.includes(id))),mirrors:state.mirrors.filter(m=>m.manual),layoutVersion:LAYOUT_VERSION};}setManualPositions(state.manualPositions||[]);setFolds(state.folds||{});setPositions(state.positions);setRoots(state.roots);setMirrors(state.mirrors);setPrismMode(state.prismMode);setRefractedPositions(state.refractedPositions);setMirrorId(null);setLens(state.lens);setFocus(state.focus);}
 function flushExploration(){if(loadedFor.current)writeExploration(writeLocal,loadedFor.current,latest.current);}
 function loadView(id:string){applyExploration(loadExploration(readLocal,id));loadedFor.current=id;}
 function selectAtlas(id:string){if(conflict){setReviewOpen(true);return;}setLocated(null);flushExploration();currentAtlas.current=id;setStore(null);setAtlasId(id);loadView(id);setTrail([]);trailViews.current=[];setNavigationEdge(null);setReveal(null);setEdgeId(null);setPanel('detail');setQuery('');setKind('全部类型');setExpanded(false);setFeedbackTarget('current');const url=new URL(location.href);url.searchParams.set('atlas',id);history.replaceState(null,'',url);if(id===atlasId)refresh();}
 useEffect(()=>{
  if(!ready||loadedFor.current!==atlasId)return;
  latest.current={version:EXPLORATION_VERSION,lens,focus,roots,mirrors,positions,refractedPositions,prismMode,folds,manualPositions,layoutVersion:LAYOUT_VERSION};
  window.clearTimeout(writeTimer.current);
  writeTimer.current=window.setTimeout(()=>{writeExploration(writeLocal,loadedFor.current,latest.current);},300);
  return()=>window.clearTimeout(writeTimer.current);
 },[positions,lens,focus,ready,atlasId,roots,mirrors,refractedPositions,prismMode,folds,manualPositions]);
 useEffect(()=>{
  function flush(){flushExploration();}
  window.addEventListener('pagehide',flush);
  return()=>{flush();window.removeEventListener('pagehide',flush);};
 },[]);
 function saveExploration(){const state={version:EXPLORATION_VERSION,lens,focus,roots,mirrors,positions,refractedPositions,prismMode,folds,manualPositions,layoutVersion:LAYOUT_VERSION};writeExploration(writeLocal,atlasId,state);writeCheckpoint(writeLocal,atlasId,state);setNotice('已保存探索存档，仅当前浏览器可见');}
 function restoreExploration(){const state=readCheckpoint(readLocal,atlasId);if(!state){setNotice('暂无已保存的探索存档');return;}applyExploration(state);setLinking(false);setExpanded(false);setNotice('已恢复光源、棱镜与镜子布局');}
 useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t);}},[notice]);
 const canEdit=store?.meta.canEdit||false;
 const graph=canEdit&&store?.draft?store.draft:store;
 const allNodes=graph?.nodes||EMPTY_NODES,allEdges=graph?.relations||EMPTY_EDGES;
 const selected=allNodes.find(n=>n.id===focus),selectedEdge=allEdges.find(e=>e.id===edgeId);
 const related=allEdges.filter(e=>e.source===focus||e.target===focus);
 const same=related.filter(e=>allNodes.find(n=>n.id===(e.source===focus?e.target:e.source))?.lens===lens);
 const cross=related.filter(e=>allNodes.find(n=>n.id===(e.source===focus?e.target:e.source))?.lens!==lens);
 const root=allNodes.find(n=>n.id===roots[lens]&&n.lens===lens)?.id||allNodes.find(n=>n.id==='task'&&n.lens===lens)?.id||allNodes.find(n=>n.lens===lens)?.id||'';
 const explorationRoot=prismMode==='refraction'&&selected?selected.id:root;
 const viewKey=lens+':'+prismMode+(prismMode==='refraction'?':focused-v1:'+explorationRoot:'');
 const foldKey=viewKey+':'+explorationRoot;
 const mirrorKey=mirrorViewKey(lens,prismMode,linking)+(prismMode==='refraction'&&!linking?':focused-v1:'+explorationRoot:'');
 const candidate=useMemo(()=>opticalView(allNodes,allEdges,lens,root,focus,prismMode),[allNodes,allEdges,lens,root,focus,prismMode]);
 const candidateNodes=candidate.nodes,candidateEdges=candidate.edges;
 const [located,setLocated]=useState<string|null>(null);
 const [navigationEdge,setNavigationEdge]=useState<string|null>(null);
 const folded=useMemo(()=>{
  const overrides=folds[foldKey]||{};
  const route=located&&lightPath(candidateNodes,candidateEdges,explorationRoot,located);
  const opened=route?Object.fromEntries(route.edges.map(id=>[id,true])):{};
  return foldedView(candidateNodes,candidateEdges,explorationRoot,{...overrides,...opened});
 },[candidateNodes,candidateEdges,explorationRoot,folds,foldKey,located]);
 const searching=!!query.trim()||kind!=='全部类型'||list||expanded;
 const optical=useMemo(()=>{
  const connection=candidateEdges.find(edge=>edge.id===navigationEdge);
  const targets=new Set([located,connection?.source,connection?.target]);
  const extra=candidateNodes.filter(n=>targets.has(n.id)&&!folded.depth.has(n.id));
  const edges=connection&&!folded.edges.some(e=>e.id===connection.id)?[...folded.edges,connection]:folded.edges;
  return {nodes:searching?candidateNodes:[...folded.nodes,...extra],edges:searching?candidateEdges:edges,path:candidate.path};
 },[located,navigationEdge,folded,candidateNodes,candidateEdges,searching,candidate.path]);
 function toggleFold(id:string,open:boolean){setNavigationEdge(null);setLocated(null);setFolds(previous=>({...previous,[foldKey]:{...previous[foldKey],[id]:open}}));}
 const previewTargets=useMemo(()=>mirrors.filter(m=>m.view===mirrorKey&&optical.edges.some(e=>e.id===m.edgeId)).map(m=>allNodes.find(n=>n.id===m.targetId)).filter((n):n is KnowledgeNode=>!!n),[mirrors,mirrorKey,optical.edges,allNodes]);
 const projection=useMemo(()=>[...optical.nodes,...previewTargets.filter(n=>!optical.nodes.some(o=>o.id===n.id))],[optical.nodes,previewTargets]);
 const {visible,matches,anchors,filtering}=useMemo(()=>filterKnowledge(linking?allNodes:projection,linking?allEdges:optical.edges,{query,kind,root,focus,expanded}),[linking,allNodes,projection,allEdges,optical.edges,query,kind,root,focus,expanded]);
 const [reveal,setReveal]=useState<RevealRequest|null>(null);
 const camera=useRef<CameraSnapshot|null>(null);
 const trailViews=useRef<Array<{camera:CameraSnapshot|null;lens:Lens;prismMode:'dispersion'|'refraction';expanded:boolean;linking:boolean;query:string;kind:string}>>([]);
 const recordVisit=()=>{trailViews.current=[...trailViews.current,{camera:camera.current,lens,prismMode,expanded,linking,query,kind}].slice(-20);setTrail(t=>[...t,focus].slice(-20));};
 const revealEpoch=useRef(0);
 function revealKnowledge(id:string){navigate(id);}
 function locateCurrent(){setList(false);if(selected?.lens!==lens&&!mirrorId&&selected)setLens(selected.lens);setReveal({id:mirrorId||focus,epoch:++revealEpoch.current});}
 function returnKnowledge(){
  const previous=trail.at(-1);if(!previous||!allNodes.some(n=>n.id===previous))return;
  const saved=trailViews.current.pop();
  setTrail(t=>t.slice(0,-1));setLocated(previous);setFocus(previous);setLens(saved?.lens||allNodes.find(n=>n.id===previous)!.lens);
  setPrismMode(saved?.prismMode||'dispersion');setExpanded(saved?.expanded||false);setLinking(saved?.linking||false);setQuery(saved?.query||'');setKind(saved?.kind||'全部类型');
  setEdgeId(null);setMirrorId(null);setPickingMirror(false);setRedirectTarget('');setPanel('detail');setDetailOpen(true);setList(false);setNavigationEdge(null);
  if(immersive||window.innerWidth<1200)closeExplorer();
  setReveal({id:previous,epoch:++revealEpoch.current,restore:saved?.camera||undefined});
 }
 const layoutNodes=linking?allNodes:candidateNodes,layoutEdges=linking?allEdges:candidateEdges;
 const pathTree=useMemo(()=>primaryTree(layoutNodes,layoutEdges,explorationRoot),[layoutNodes,layoutEdges,explorationRoot]);
 const defaultPositions=useMemo(()=>layoutPrisms(layoutNodes,pathTree,explorationRoot),[layoutNodes,pathTree,explorationRoot]);
 const savedViewPositions=useMemo(()=>prismMode==='refraction'?Object.fromEntries(Object.entries(refractedPositions).filter(([key])=>key.startsWith(viewKey+':')).map(([key,p])=>[key.slice(viewKey.length+1),p])):positions,[prismMode,refractedPositions,viewKey,positions]);
 const stablePositions=useMemo(()=>extendPositions(defaultPositions,savedViewPositions),[defaultPositions,savedViewPositions]);
 useEffect(()=>{
  if(!ready||!store||linking)return;
  const missing=candidateNodes.filter(n=>!savedViewPositions[n.id]);
  if(!missing.length)return;
  if(prismMode==='refraction')setRefractedPositions(previous=>({...previous,...Object.fromEntries(missing.map(n=>[viewKey+':'+n.id,stablePositions[n.id]]))}));
  else setPositions(previous=>({...previous,...Object.fromEntries(missing.map(n=>[n.id,stablePositions[n.id]]))}));
 },[ready,store,linking,prismMode,viewKey,candidateNodes,savedViewPositions,stablePositions]);
 const path=optical.path;
 function displayedPosition(n:KnowledgeNode):Point{
  if(linking)return {x:(positions[n.id]?.x??n.x)+['domain','ecology','cognition'].indexOf(n.lens)*1150,y:positions[n.id]?.y??n.y};
  if(prismMode==='refraction'){
   const saved=refractedPositions[viewKey+':'+n.id];if(saved)return saved;
   return stablePositions[n.id]||{x:n.x,y:n.y};
  }
  return stablePositions[n.id]||{x:n.x,y:n.y};
 }
 const graphPositions=useMemo(()=>Object.fromEntries(visible.map(n=>[n.id,displayedPosition(n)])),[visible,linking,positions,prismMode,refractedPositions,viewKey,stablePositions]);
 const flowKnowledge=visible.map(n=>({id:n.id,type:'spectral',ariaLabel:'知识：'+n.title,position:graphPositions[n.id],selected:n.id===focus&&!mirrorId,data:{...n,contextAnchor:anchors.some(a=>a.id===n.id),lightSource:n.id===root,dimension:lenses[n.lens].name,color:lensColor(n.lens)}}));
 const visibleIds=useMemo(()=>new Set(visible.map(n=>n.id)),[visible]);
 const secondaryCount=optical.edges.filter(e=>!pathTree.treeEdges.has(e.id)).length;
 const routeEdges=useMemo(()=>candidateEdges.filter(e=>allRelations||pathTree.treeEdges.has(e.id)||e.id===edgeId||e.id===navigationEdge),[candidateEdges,allRelations,pathTree,edgeId,navigationEdge]);
 const opticalEdges=useMemo(()=>(linking?allEdges:optical.edges.filter(e=>allRelations||pathTree.treeEdges.has(e.id)||e.id===edgeId||e.id===navigationEdge)).filter(e=>visibleIds.has(e.source)&&visibleIds.has(e.target)),[linking,allEdges,optical.edges,allRelations,pathTree,edgeId,navigationEdge,visibleIds]);
 const center=(id:string):Point=>{const p=graphPositions[id]||{x:0,y:0};return {x:p.x+100,y:p.y+(id===root?72:80)};};
 const depths=useMemo(()=>searching?lightDepths(candidateNodes,candidateEdges,explorationRoot):folded.depth,[searching,candidateNodes,candidateEdges,explorationRoot,folded]);
 function lightEndpoints(e:Relation){
  return (depths.get(e.source)??999)<=(depths.get(e.target)??999)
   ?{source:e.source,target:e.target}:{source:e.target,target:e.source};
 }
 const routePositions=linking?graphPositions:stablePositions;
 const routed=useMemo(()=>routeMirrors(routePositions,linking?allEdges:routeEdges),[routePositions,linking,allEdges,routeEdges]);
 const savedMirrors=useMemo(()=>new Map(mirrors.filter(m=>m.view===mirrorKey).map(m=>[m.edgeId,m])),[mirrors,mirrorKey]);
 const activeMirrors=opticalEdges.map(e=>{
  const saved=savedMirrors.get(e.id);
  if(saved)return {...saved,targetId:allNodes.some(n=>n.id===saved.targetId)?saved.targetId:undefined};
  return {id:'mirror:'+e.id,edgeId:e.id,view:mirrorKey,position:routed[e.id],angle:0} as Mirror;
 });
 const mirrorsByEdge=new Map(activeMirrors.map(m=>[m.edgeId,m]));
 const outgoing=new Map<string,string[]>();
 for(const edge of opticalEdges){
  const {source}=lightEndpoints(edge);
  const siblings=outgoing.get(source)||[];
  siblings.push(edge.id);
  outgoing.set(source,siblings);
 }
 const branches=new Map<string,{index:number;count:number}>();
 for(const siblings of outgoing.values()){
  siblings.sort((a,b)=>a.localeCompare(b));
  siblings.forEach((id,index)=>branches.set(id,{index,count:siblings.length}));
 }
 function updateMirror(id:string,changes:Partial<Mirror>){const m=activeMirrors.find(m=>m.id===id);if(m)setMirrors(ms=>[...ms.filter(x=>!(x.edgeId===m.edgeId&&x.view===m.view)),{...m,...changes,manual:true}]);}
 const litKnowledge=flowKnowledge;
 const flowEdges=opticalEdges.flatMap(e=>{
  const endpoints=lightEndpoints(e),m=mirrorsByEdge.get(e.id);
  const {index,count}=branches.get(e.id)!;
  const color=endpoints.source===root?'#efeee4':`hsl(${Math.round(index*300/Math.max(1,count-1))} 72% 68%)`;
  const base={type:'spectral',className:e.id===navigationEdge?'navigation-ray':undefined,selectable:false,focusable:false,data:{relationId:e.id,active:e.id===hoveredEdge||e.id===edgeId||e.id===navigationEdge,color}};
  return m?[{...base,id:e.id+':in',source:endpoints.source,target:m.id,label:undefined},{...base,id:e.id+':out',source:m.id,target:m.targetId||endpoints.target,label:undefined,data:{...base.data,spectral:e.id===edgeId}}]:[{...base,id:e.id,...endpoints,label:undefined}];
 });
 const chosenMirror=activeMirrors.find(m=>m.id===mirrorId),mirrorRelation=allEdges.find(e=>e.id===chosenMirror?.edgeId);
 const incomingNode=mirrorRelation?lightEndpoints(mirrorRelation).source:'';
 const suggestedTarget=chosenMirror?.targetId||null;
 function connectMirror(id:string,target:string){const m=activeMirrors.find(m=>m.id===id),e=allEdges.find(e=>e.id===m?.edgeId);if(!m||!e)return;const incoming=lightEndpoints(e).source;if(target===incoming||!allNodes.some(n=>n.id===target)){setError('请选择入射节点以外的知识棱镜');return;}setExpanded(false);setQuery('');setKind('全部类型');updateMirror(id,{targetId:target});setMirrorId(id);setRedirectTarget(target);setPickingMirror(false);setNotice('光线已连接到目标；如需修改知识关系，请保存为关系草稿');}
 const mirrorNodes=activeMirrors.map(m=>{const e=allEdges.find(e=>e.id===m.edgeId)!,ends=lightEndpoints(e);return {id:m.id,type:'mirror',className:e.id===navigationEdge?'navigation-mirror':undefined,ariaLabel:'关系：'+e.label,zIndex:3000,position:m.position,selected:m.id===mirrorId,data:{title:e.label,preview:!!m.targetId&&m.targetId!==ends.target,folded:false,onToggle:()=>toggleFold(e.id,false),angle:mirrorAngle(center(ends.source),{x:m.position.x+38,y:m.position.y+38},center(m.targetId||ends.target))}};});
 const frontier=useMemo(()=>linking||searching?[]:folded.frontier.filter(f=>visibleIds.has(f.source)&&f.edge.id!==navigationEdge),[linking,searching,folded,visibleIds,navigationEdge]);
 const frontierPositions=useMemo(()=>frontier.every(f=>savedMirrors.has(f.edge.id))?{}:routeFrontiers(graphPositions,frontier,explorationRoot,Object.fromEntries(opticalEdges.map(e=>[e.id,savedMirrors.get(e.id)?.position||routed[e.id]]))),[graphPositions,frontier,explorationRoot,savedMirrors,routed,opticalEdges]);
 const frontierNodes=frontier.map(f=>{const saved=savedMirrors.get(f.edge.id);const position=saved?.position||frontierPositions[f.edge.id];return {id:'frontier:'+f.edge.id,type:'mirror',ariaLabel:'关系：'+f.edge.label,position,zIndex:3000,selected:mirrorId==='frontier:'+f.edge.id,data:{title:f.edge.label,relationId:f.edge.id,folded:true,targetTitle:allNodes.find(n=>n.id===f.target)?.title,onToggle:()=>toggleFold(f.edge.id,true),angle:35}};});
 // Persist automatic mirror positions too: folding changes visibility, never the layout.
 useEffect(()=>{
  if(!ready||!store||linking)return;
  const additions=[...activeMirrors,...frontierNodes.map(n=>({id:'mirror:'+String(n.data.relationId),edgeId:String(n.data.relationId),view:mirrorKey,position:n.position,angle:0,manual:false}))].filter(m=>!mirrors.some(old=>old.view===m.view&&old.edgeId===m.edgeId));
  if(additions.length)setMirrors(previous=>[...previous,...additions.filter(m=>!previous.some(old=>old.view===m.view&&old.edgeId===m.edgeId))]);
 },[ready,store,linking,activeMirrors,frontierNodes,mirrorKey,mirrors]);
 const frontierEdges=frontier.map(f=>({id:'frontier-ray:'+f.edge.id,type:'spectral',source:f.source,target:'frontier:'+f.edge.id,data:{relationId:f.edge.id}}));
 const flowNodes=[...litKnowledge,...mirrorNodes,...frontierNodes];
 function autoLayout(){setReveal(null);
  const nodes=linking?allNodes:candidateNodes,edges=linking?allEdges:candidateEdges;
  const l=balancedLayout(nodes,edges,explorationRoot);
  setManualPositions(ids=>ids.filter(id=>!nodes.some(n=>n.id===id||viewKey+':'+n.id===id)));
  if(prismMode==='refraction'&&!linking)setRefractedPositions(p=>({...p,...Object.fromEntries(Object.entries(l.prisms).map(([id,point])=>[viewKey+':'+id,point]))}));
  else setPositions(p=>({...p,...l.prisms}));
  setMirrors(ms=>[...ms.filter(m=>m.view!==mirrorKey),...edges.map(e=>({id:'mirror:'+e.id,edgeId:e.id,view:mirrorKey,position:l.mirrors[e.id],angle:0,manual:false,targetId:ms.find(m=>m.view===mirrorKey&&m.edgeId===e.id)?.targetId}))]);
  setLayoutEpoch(n=>n+1);setNotice('');
 }
 function placeMirror(){const e=opticalEdges.find(e=>e.id===edgeId)||opticalEdges.find(e=>e.source===focus||e.target===focus);if(!e){setNotice('先建立一条知识关系，它会自动显示为关系镜');return;}const m=activeMirrors.find(m=>m.edgeId===e.id);if(m){setMirrorId(m.id);setEdgeId(e.id);setDetailOpen(true);setPanel('detail');}}
 function openEditor(kind:'node'|'relation'|'publish'){editVersion.current=store?.contentVersion;setModal(kind);}
 function beginRelation(){editVersion.current=store?.contentVersion;setLinkPending(true);}
 async function readConflictLatest(){setBusy(true);setError('');try{
  const target=atlasId,r=await fetch('/api/atlas?id='+encodeURIComponent(target),{cache:'no-store'}),b=await r.json();
  if(!r.ok)throw Error(b.error||'无法读取最新图谱');if(currentAtlas.current!==target)return;
  setConflict(previous=>previous?{...previous,latest:b}:previous);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function adoptConflictLatest(){if(!conflict?.latest)return;setLocalBackup(previous=>[...previous,conflict.local]);setStore(conflict.latest);setConflict(null);setReviewOpen(false);setModal(null);setLinkPending(false);editVersion.current=undefined;setError('');setNotice('已切换到最新版本，请重新编辑；原本地提交副本已保留');}
 async function mutate(body:Record<string,unknown>,message:string){
  if(writeInFlight.current)return false;
  if(conflict){setReviewOpen(true);return false;}
  const target=atlasId,expectedVersion=(modal==='node'||modal==='relation'||modal==='publish'||linkPending)?editVersion.current:store?.contentVersion;
  const submission=body;writeInFlight.current=true;setBusy(true);setError('');
  try{
   const r=await fetch('/api/atlas?id='+encodeURIComponent(target),{method:'POST',headers:{'Content-Type':'application/json',...(expectedVersion?{'x-atlas-content-version':expectedVersion}:{})},body:JSON.stringify(submission)});
   const result=await r.json();if(currentAtlas.current!==target)return false;
   if(r.status===409||r.status===428||(r.status===400&&result.error==='内容版本已更新，请刷新页面后重试')){setConflict({local:structuredClone({submission,editing:editorContent.current})});setReviewOpen(true);setError(result.error);return false;}
   if(!r.ok)throw Error(result.error);await refresh();setNotice(message);setModal(null);return true;
  }catch(e){if(currentAtlas.current===target)setError(e instanceof Error?e.message:'操作失败');return false;}
  finally{writeInFlight.current=false;setBusy(false);}
 }
 function navigate(id:string,relationId?:string){setLocated(id);
  const n=allNodes.find(n=>n.id===id);if(!n)return;
  if(focus!==id)recordVisit();
  if(immersive||window.innerWidth<1200)closeExplorer();
  setDetailOpen(true);setMirrorId(null);setPickingMirror(false);setRedirectTarget('');setFocus(id);setLens(n.lens);setExpanded(false);setQuery('');setKind('全部类型');setPanel('detail');setEdgeId(null);setList(false);
  // A cross-map destination must exist in its native projection; do not fabricate a path.
  if(n.lens!==lens)setPrismMode('dispersion');
  setNavigationEdge(relationId||null);setReveal({id,epoch:++revealEpoch.current});
 }
 function selectGraphObject(n:{id:string;type?:string}){setNavigationEdge(null);if(pickingMirror&&mirrorId&&n.type!=='mirror'){connectMirror(mirrorId,n.id);return;}if(n.type==='mirror'){setMirrorId(n.id);setRedirectTarget('');setEdgeId(activeMirrors.find(m=>m.id===n.id)?.edgeId||(n.id.startsWith('frontier:')?n.id.slice(9):null));setPanel('detail');setDetailOpen(true);return;}setMirrorId(null);setDetailOpen(true);setFocus(n.id);setPanel('detail');setEdgeId(null);if(n.id!==focus)recordVisit();setNavigationEdge(null);}
 function openFeedback(){setDetailOpen(true);setFeedbackTarget('current');setPanel('feedback');}
 function switchLens(next:Lens){setLocated(null);setNavigationEdge(null);setReveal(null);setPrismMode('dispersion');setMirrorId(null);setLens(next);setKind('全部类型');setExpanded(false);setQuery('');setEdgeId(null);if(next!==lens)setLensSweep(n=>n+1);}
 function exportData(){if(!store)return;const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),...store},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='spectrum-atlas.json';a.click();URL.revokeObjectURL(url);}
 function newNode(){setForm({...emptyForm,id:crypto.randomUUID(),lens,x:200+Math.random()*400,y:100+Math.random()*300});openEditor('node');}
 async function saveNode(){if(!graph)return;const normalized={...form,sources:form.sources.map(s=>s.trim()).filter(Boolean)};const nodes=allNodes.some(n=>n.id===form.id)?allNodes.map(n=>n.id===form.id?normalized:n):[...allNodes,normalized];if(await mutate({action:'draft',nodes,relations:allEdges},'已保存为草稿，发布后访客可见')){setFocus(form.id);setLens(form.lens);}}
 async function saveRelation(){if(!graph)return;const relations=allEdges.some(e=>e.id===edgeForm.id)?allEdges.map(e=>e.id===edgeForm.id?edgeForm:e):[...allEdges,edgeForm];if(await mutate({action:'draft',nodes:allNodes,relations},'关系已加入草稿'))setLinkPending(false);}
 const targetId=feedbackTarget==='current'?(edgeId||selected?.id||'atlas'):feedbackTarget;
 const feedbackItems=(store?.feedback||[]).filter(f=>feedbackScope==='all'||f.target===targetId);
 const pendingChanges=store?.draft?graphChanges(store,store.draft):[];
 const relationCard=(e:Relation)=>{const other=allNodes.find(n=>n.id===(e.source===focus?e.target:e.source));if(!other)return null;return <button className="relation-card" key={e.id} onClick={()=>navigate(other.id,e.id)}><span className="relation-label">{e.label} <span>{lenses[other.lens].name}</span></span><strong><i style={{background:lensColor(other.lens)}}/>{other.title}<ArrowUpRight size={14}/></strong><p>{e.reason}</p></button>;};
 // Mode switches only change presentation. GraphCanvas keeps its key and owns its viewport.
 const exitImmersive=useCallback(()=>{
  setImmersive(false);
  setExplorerOpen(workbenchPanels.current.explorer);
  setDetailOpen(workbenchPanels.current.detail);
  requestAnimationFrame(()=>modeToggle.current?.focus());
 },[]);
 function toggleImmersive(){
  enableModeMotion(true);
  if(immersive){exitImmersive();return;}
  workbenchPanels.current={explorer:explorerOpen,detail:detailOpen};
  setExplorerOpen(false);setDetailOpen(false);setImmersive(true);
  document.querySelectorAll<HTMLDetailsElement>('.workspace-tools,.mirror-controls').forEach(element=>{element.open=false;});
 }
 const explorerDialog=explorerOpen&&(immersive||!wide);
 useEffect(()=>{
  if(!explorerDialog||modal||library||reviewOpen||showGuide)return;
  const current=document.getElementById('exploration-panel');if(!current)return;
  const background=Array.from(document.querySelectorAll<HTMLElement>('.observatory-workspace .topbar,.observatory-workspace .atlas-banner,.observatory-workspace .lens-bar,.observatory-workspace .canvas-section,.observatory-workspace .detail-panel,.observatory-workspace .spectrum-tools,.observatory-workspace .site-footer'))
   .map(element=>({element,inert:element.inert}));
  background.forEach(({element})=>{element.inert=true;});
  current.querySelector<HTMLInputElement>('input')?.focus();
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeExplorer();return;}
   if(event.key!=='Tab')return;
   const items=Array.from(current.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary,a[href]')).filter(el=>el.getClientRects().length>0);
   const first=items[0],last=items.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!current.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!current.contains(document.activeElement))){event.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',keydown,true);
  return()=>{document.removeEventListener('keydown',keydown,true);background.forEach(({element,inert})=>{element.inert=inert;});};
 },[explorerDialog,modal,library,reviewOpen,showGuide,closeExplorer,detailOpen]);
 useEffect(()=>{
  if(!immersive)return;
  const keydown=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||event.defaultPrevented||modal||library||reviewOpen||showGuide||explorerOpen)return;
   event.preventDefault();
   if(detailOpen)closeDetail();else exitImmersive();
  };
  document.addEventListener('keydown',keydown);
  return()=>document.removeEventListener('keydown',keydown);
 },[immersive,modal,library,reviewOpen,showGuide,explorerOpen,detailOpen,closeDetail,exitImmersive]);
 if(!store)return <div className="loading"><div className="prism-logo">△</div><h2>正在展开光谱</h2><p>{error||'读取本地知识库…'}</p>{error&&<><button onClick={()=>location.reload()}>重试</button><button onClick={()=>{location.href='/?atlas=official';}}>返回共享图谱</button></>}</div>;
 return <div ref={workspaceShell} className={`app-shell studio observatory-workspace ${immersive?'is-immersive':''} ${explorerOpen?'explorer-open':''} ${detailOpen?'has-detail':''} ${linking?'is-linking':''} ${pickingMirror?'is-picking':''}`} style={{'--lens':lensColor(lens)} as React.CSSProperties}>
 <a className="workspace-skip" href="#knowledge-workspace">跳至知识画布</a>
 <span className="mode-status" role="status">{immersive?'沉浸探索。可随时返回工作区。':'知识工作区'}</span>
 <header className="topbar"><a className="brand" href="/" aria-label="光谱首页"><span className="prism-logo">△</span><span>光谱 <small>AN OBSERVATORY OF KNOWLEDGE</small></span><span className="version">TRIMAP / 0.3</span></a><div className="header-actions"><button className="role-button" onClick={()=>setShowGuide(true)}><Compass size={14}/>使用指引</button><button className="role-button" onClick={()=>setLibrary(true)}><Layers size={14}/>图谱空间</button><span className="local-dot">知识探索空间</span><button className="icon-button" title="导出知识库" aria-label="导出知识库" onClick={exportData}><Download size={17}/></button><button className="role-button" onClick={async()=>{if(admin){await fetch('/api/session',{method:'DELETE'});setAdmin(false);await refresh();}else setModal('login');}}><Lock size={14}/>{admin?'维护者 · 退出':'维护者入口'}</button></div></header>
 <section className="intro"><div><div className="eyebrow">EMBODIED VISION · KNOWLEDGE OBSERVATORY</div><h1>同一束知识，<span>不同的看见。</span></h1><p>从视觉感知到机器人操作。选择一片滤光片，沿着关系探索。</p></div><button className="guide-button" onClick={()=>setShowGuide(!showGuide)}><Compass size={18}/>探索指南 <ArrowUpRight size={15}/></button></section>
 {showGuide&&<UsageGuide onClose={()=>setShowGuide(false)}/>}
 <section className="atlas-banner"><div><span>{store.meta.official?'共享样例':store.meta.owned?'我的图谱':'公开图谱'}</span><h1>{store.meta.title}</h1><small>{store.meta.ownerName} · {store.meta.isPublic?'公开已发布版本':'仅自己可见'}</small></div><div><button onClick={()=>setLibrary(true)}>浏览 / 创建图谱</button><button onClick={()=>{navigator.clipboard.writeText(location.origin+'/?atlas='+atlasId).then(()=>setNotice(store.meta.isPublic?'图谱链接已复制':'私有图谱链接已复制，其他访客暂不可查看')).catch(()=>setError('无法复制链接，请复制浏览器地址'));}}>复制链接</button></div></section>
 <nav className="lens-bar" aria-label="地图滤光片">{(Object.keys(lenses) as Lens[]).map((l,i)=><button key={l} className={`lens-tab ${lens===l?'active':''}`} aria-pressed={lens===l} style={{'--tab-color':lensColor(l)} as React.CSSProperties} onClick={()=>switchLens(l)}><span className="lens-number">0{i+1}</span><span><strong>{lenses[l].name}</strong><small>{lenses[l].en}</small></span><span className="lens-question">{lenses[l].question}</span><span className="lens-dot"/></button>)}</nav>
 <main className="workspace" id="knowledge-workspace" tabIndex={-1}><aside className="sidebar" id="exploration-panel" hidden={!explorerOpen} aria-label="搜索与探索" role={explorerDialog?'dialog':undefined} aria-modal={explorerDialog&&!modal&&!library&&!reviewOpen&&!showGuide?true:undefined} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeExplorer();}}}><div className="explorer-heading"><h2>探索范围</h2><button aria-label="收起探索区" onClick={closeExplorer}><X size={18}/></button></div><label className="search"><span className="search-label">搜索当前地图</span><Search size={15}/><input aria-label="搜索当前地图" placeholder="搜索当前地图" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="field-label">知识类型<select value={kind} onChange={e=>setKind(e.target.value)}><option>全部类型</option>{[...new Set((linking?allNodes:projection).map(n=>n.kind))].map(k=><option key={k}>{k}</option>)}</select></label>{filtering&&<section className="search-results" aria-label="搜索结果"><p role="status">匹配 {matches.length} 个知识{anchors.length>0?` · 保留 ${anchors.length} 个探索锚点`:''}</p>{matches.length===0?<p>没有匹配的知识。光源与焦点仅用于保留探索上下文，不计入结果。</p>:matches.map(n=><button key={n.id} onClick={()=>revealKnowledge(n.id)}>{n.title}<ArrowUpRight size={14}/></button>)}<button onClick={()=>{setQuery('');setKind('全部类型');}}>清除搜索与类型筛选</button></section>}<div className="side-divider"/><span className="section-label">探索模式</span><button className={`side-item ${!expanded?'chosen':''}`} onClick={()=>setExpanded(false)}><Layers size={16}/>整体结构<span>{allNodes.filter(n=>n.lens===lens).length}</span></button><button className={`side-item ${expanded?'chosen':''}`} onClick={()=>{if(selected?.lens!==lens){const first=allNodes.find(n=>n.lens===lens);if(first)setFocus(first.id);}setExpanded(true);}}><GitBranch size={16}/>聚焦关联</button><div className="side-divider"/><details className="exploration-trail"><summary>探索足迹</summary><div className="trail">{[...trail,focus].slice(-5).map((id,i)=><button key={`${id}-${i}`} onClick={()=>revealKnowledge(id)}><span>{String(i+1).padStart(2,'0')}</span>{allNodes.find(n=>n.id===id)?.title||'已移除节点'}<ChevronRight size={12}/></button>)}</div><button className="text-button" onClick={returnKnowledge} disabled={!trail.length}><ArrowLeft size={14}/>返回上一步</button></details><div className="sidebar-bottom"><div className="mini-spectrum"/><p>知识有边界，<br/>探索没有终点。</p><span>框架样例 · 内容待核实</span></div></aside>
 <section className="canvas-section" aria-label="知识画布" onKeyDownCapture={event=>{
  // Activate the same application selection as a click; React Flow retains arrow-key movement.
  if(event.key!=='Enter'&&event.key!==' ')return;
  const target=event.target;
  if(!(target instanceof HTMLElement)||!target.matches('.react-flow__node'))return;
  const node=flowNodes.find(item=>item.id===target.dataset.id);
  if(node){event.preventDefault();event.stopPropagation();selectGraphObject(node);}
 }}><div className="canvas-toolbar"><div><button ref={modeToggle} className="mode-toggle" aria-label={immersive?'返回工作区':'进入沉浸探索'} aria-pressed={immersive} onClick={toggleImmersive}>{immersive?<Minimize2 size={16}/>:<Maximize2 size={16}/>}<span className="mode-label">{immersive?'返回工作区':'沉浸探索'}</span><span className="mode-label-compact" aria-hidden="true">{immersive?'返回':'沉浸'}</span></button><button ref={explorerToggle} className="explorer-toggle" aria-expanded={explorerOpen} aria-controls="exploration-panel" onClick={()=>{enableExplorerMotion(true);setExplorerOpen(!explorerOpen);if(!explorerOpen)requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('#exploration-panel input')?.focus());}}><Search size={16}/>探索</button><span className="live-dot"/> {lenses[lens].en} <span className="muted">/ {visible.length} 个节点 · {opticalEdges.length} 条关系</span></div><div><button aria-label={detailOpen?'收起阅读面板':'打开阅读面板'} aria-expanded={detailOpen} aria-controls="knowledge-reading" onClick={()=>setDetailOpen(!detailOpen)}><SlidersHorizontal size={16}/><span className="reading-toggle-label">阅读</span></button><button className={!list?'active-toggle':''} onClick={()=>setList(false)}>图谱</button><button className={list?'active-toggle':''} onClick={()=>setList(true)}>列表</button>{canEdit&&<button className="add-button" onClick={newNode}><Plus size={14}/>节点</button>}</div></div>
 {canEdit&&<div className="draft-bar"><span>{store.draft?'正在预览未发布草稿':store.meta.owned?'个人编辑 · 当前为已发布内容':'维护模式 · 当前为已发布内容'}</span><button onClick={()=>{setEdgeForm({id:crypto.randomUUID(),source:selected?.id||allNodes[0]?.id||'',target:allNodes.find(n=>n.id!==(selected?.id||allNodes[0]?.id))?.id||'',label:'关联',reason:''});setLinking(true);beginRelation();}}>建立关系</button><button onClick={()=>mutate({action:'draft',nodes:allNodes.map(n=>({...n,...(positions[n.id]||{})})),relations:allEdges},'布局已保存为草稿')}>保存当前布局</button>{store.draft&&<><button onClick={()=>mutate({action:'discard'},'草稿已丢弃')}>丢弃草稿</button><button className="publish" onClick={()=>openEditor('publish')}>审核发布</button></>}</div>}
 {filtering&&<div className="filter-status" role="status">{matches.length===0?'没有匹配的知识':`找到 ${matches.length} 个匹配知识`}{anchors.length>0&&<span>另保留 {anchors.length} 个探索锚点，未计入结果</span>}<button onClick={()=>{setQuery('');setKind('全部类型');}}>清除筛选</button></div>}<div className="canvas-content">{lensSweep>0&&<span key={lensSweep} className="gel-sweep" style={{'--gel':lensColor(lens)} as React.CSSProperties} aria-hidden="true"/>}{visible.length===0?<div className="empty-state"><Search size={28}/><h3>没有匹配的知识</h3><p>换一个关键词，或清除筛选后继续探索。</p><button onClick={()=>{setQuery('');setKind('全部类型');setExpanded(false);}}>清除筛选</button></div>:list?<div className="node-list">{(filtering?matches:visible).map(n=><button key={n.id} onClick={()=>revealKnowledge(n.id)}><span className="node-kind">{n.kind} · {n.status}</span><h3>{n.title}<ArrowUpRight size={17}/></h3><p>{n.summary}</p></button>)}</div>:<GraphCanvas fitScope={JSON.stringify([atlasId,lens,prismMode,explorationRoot,kind,query,expanded,linking])} onViewChange={snapshot=>{camera.current=snapshot;}} key={`${lens}-${expanded}-${linking}-${prismMode}-${layoutEpoch}`} reveal={reveal} onRevealHandled={epoch=>setReveal(previous=>previous?.epoch===epoch?null:previous)} nodes={flowNodes} edges={[...flowEdges,...frontierEdges]} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.02} maxZoom={1.8} onNodeMouseEnter={(_,n)=>{if(n.type==='mirror')setHoveredEdge(String(n.data.relationId||activeMirrors.find(m=>m.id===n.id)?.edgeId||''));}} onNodeMouseLeave={()=>setHoveredEdge(null)} onNodeClick={(_,n)=>selectGraphObject(n)} onNodeDragStart={(_,n)=>{setNavigationEdge(null);setPickingMirror(false);setRedirectTarget('');if(n.type==='mirror'){setMirrorId(n.id);setEdgeId(activeMirrors.find(m=>m.id===n.id)?.edgeId||(n.id.startsWith('frontier:')?n.id.slice(9):null));}else{setMirrorId(null);setEdgeId(null);setFocus(n.id);}}} onNodeDragStop={(_,n)=>{if(n.type==='mirror'){if(n.id.startsWith('frontier:')){const id=n.id.slice(9);setMirrors(ms=>[...ms.filter(m=>!(m.edgeId===id&&m.view===mirrorKey)),{id:'mirror:'+id,edgeId:id,view:mirrorKey,position:n.position,angle:0,manual:true}]);}else updateMirror(n.id,{position:n.position});return;}setManualPositions(ids=>[...new Set([...ids,prismMode==='refraction'&&!linking?viewKey+':'+n.id:n.id])]);if(prismMode==='refraction'&&!linking){setRefractedPositions(p=>({...p,[viewKey+':'+n.id]:n.position}));return;}setPositions(p=>({...p,[n.id]:{x:n.position.x-(linking?['domain','ecology','cognition'].indexOf(allNodes.find(item=>item.id===n.id)?.lens||lens)*1150:0),y:n.position.y}}));}}  nodesConnectable={(canEdit&&linking)||!!mirrorId} connectionRadius={35} onPaneClick={()=>{setDetailOpen(false);setPickingMirror(false);}} onConnect={connection=>{if(connection.source?.startsWith('mirror:')&&connection.target){connectMirror(connection.source,connection.target);return;}if(!canEdit)return;if(!connection.source||!connection.target||connection.source===connection.target)return;const existing=allEdges.find(e=>e.source===connection.source&&e.target===connection.target);setEdgeForm(existing?{...existing}:{id:crypto.randomUUID(),source:connection.source,target:connection.target,label:'关联',reason:''});beginRelation();}} deleteKeyCode={null} colorMode="dark"><Background color="#3b3b51" gap={24} size={1}/></GraphCanvas>}
 <div className="canvas-caption"><span>△</span>拖动探索空间 · 点击节点色散 · 沿关联折射<button onClick={()=>setPositions({})}>重置布局</button></div></div>
 <footer className="canvas-footer"><span><i style={{background:lensColor(lens)}}/>当前滤光片：{lenses[lens].name}</span><span>节点颜色随观察视角变化</span></footer></section>
 {/* The modal explorer temporarily owns focus; retain the requested reading state for its return. */}
 <ReadingPanel open={detailOpen&&!explorerDialog} reading={panel==='detail'} title={selectedEdge?.label||selected?.title||'知识详情'} selectionKey={atlasId+':'+(selectedEdge?.id||selected?.id||'')} summary={selectedEdge?(selectedEdge.reason||'尚未填写关系说明'):(selected?.summary||'选择一个节点开始探索。')} category={selectedEdge?'关系依据':`${selected?.kind||'知识'} · ${selected?.status||''}`} overlayOpen={!!modal||library||reviewOpen||showGuide} onClose={closeDetail} onLocate={locateCurrent} onBack={returnKnowledge} canGoBack={trail.length>0}><div className="detail-tabs"><button onClick={closeDetail} title="关闭详情" aria-label="关闭详情"><X size={15}/></button><button className={panel==='detail'?'active':''} onClick={()=>setPanel('detail')}><SlidersHorizontal size={14}/>知识详情</button><button className={panel==='feedback'?'active':''} onClick={openFeedback}><MessageSquare size={14}/>反馈</button><button className={panel==='history'?'active':''} onClick={()=>setPanel('history')} title="版本记录" aria-label="版本记录"><History size={16}/></button></div><div className="detail-scroll">
 {panel==='detail'&&(selectedEdge?<><div className="eyebrow">RELATION / 关系依据</div><h2>{selectedEdge.label}</h2><p className="detail-summary">{allNodes.find(n=>n.id===selectedEdge.source)?.title} → {allNodes.find(n=>n.id===selectedEdge.target)?.title}</p><p className="body-text">{selectedEdge.reason||'尚未填写关系说明'}</p><button className="text-button" onClick={()=>setEdgeId(null)}>返回节点详情</button><button className="text-button" onClick={openFeedback}>反馈这条关系</button>{canEdit&&<><button className="text-button" onClick={()=>{setEdgeForm({...selectedEdge});openEditor('relation');}}>编辑关系</button><button className="danger text-button" onClick={()=>mutate({action:'draft',nodes:allNodes,relations:allEdges.filter(e=>e.id!==selectedEdge.id)},'关系移除已保存为草稿').then(ok=>{if(ok){setEdgeId(null);setMirrorId(null);}})}>从草稿移除此关系</button></>}</>:selected?<><div className="detail-kicker"><span>{selected.kind}</span><span className="status">{selected.status}</span></div><h2>{selected.title}</h2><p className="detail-summary">{selected.summary}</p><nav className="reading-sections" aria-label="知识阅读章节">{[['knowledge-body','正文'],['knowledge-related','关联'],['knowledge-sources','依据']].map(([id,title])=><button key={id} onClick={()=>{const area=document.querySelector('.detail-scroll'),target=document.getElementById(id);if(area&&target)area.scrollTop+=target.getBoundingClientRect().top-area.getBoundingClientRect().top-12;}}>{title}</button>)}</nav><p id="knowledge-body" className="body-text">{selected.body}</p>{selected.lens!==lens&&<div className="context-note">保留了上一视角的知识焦点。你可以沿下方关联进入当前地图，或<button onClick={()=>switchLens(selected.lens)}>回到它所在的地图</button>。</div>}
 <div id="knowledge-related" className="detail-section-title"><span>色散 <small>同图关联</small></span><button onClick={()=>{setLens(selected.lens);setExpanded(true);}}>聚焦 <GitBranch size={13}/></button></div>{same.length?same.map(relationCard):<p className="muted small">暂无当前视角的直接关联。</p>}
 <div className="detail-section-title"><span>折射 <small>跨图探索</small></span><ArrowUpRight size={15}/></div>{cross.length?cross.map(relationCard):<p className="muted small">暂无跨图关联。维护者可以建立新的关系。</p>}
 <div id="knowledge-sources" className="detail-section-title"><span>来源与依据</span><span>{selected.sources.length}</span></div>{selected.sources.length?selected.sources.map((s,i)=>/^https?:\/\//i.test(s)?<a className="source" key={i} href={s} target="_blank" rel="noreferrer">{new URL(s).hostname}<ArrowUpRight size={13}/></a>:<p className="small" key={i}>{s}</p>):<p className="muted small">待补充可靠来源。样例说明不能作为事实证据。</p>}
 <div className="node-actions"><button onClick={openFeedback}><MessageSquare size={14}/>提出反馈</button>{canEdit&&<button onClick={()=>{setForm(structuredClone(selected));openEditor('node');}}>编辑节点</button>}</div>
 </>:<div className="empty-state"><p>选择一个节点开始探索。</p></div>)}
 {panel==='feedback'&&<><div className="eyebrow">CONVERSATION / 共同完善</div><h2>让知识继续生长</h2><label className="field-label">具体反馈对象<select value={feedbackTarget} onChange={e=>setFeedbackTarget(e.target.value)}><option value="current">当前选择：{selectedEdge?`关系 · ${selectedEdge.label}`:selected?.title||'整个图谱'}</option><option value="atlas">整个图谱</option><optgroup label="节点">{allNodes.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</optgroup><optgroup label="关系">{allEdges.map(e=><option key={e.id} value={e.id}>{allNodes.find(n=>n.id===e.source)?.title} → {e.label} → {allNodes.find(n=>n.id===e.target)?.title}</option>)}</optgroup></select></label><form onSubmit={async e=>{e.preventDefault();if(await mutate({action:'feedback',target:targetId,text:feedbackText,author,category:feedbackCategory,suggestion},'反馈已保存')){setFeedbackText('');setSuggestion('');}}}><label className="field-label">问题类型<select value={feedbackCategory} onChange={e=>setFeedbackCategory(e.target.value)}>{['内容错误','关系疑问','来源缺失','改进建议','使用问题'].map(c=><option key={c}>{c}</option>)}</select></label><input placeholder="你的称呼（可选，会随反馈展示）" maxLength={60} value={author} onChange={e=>setAuthor(e.target.value)}/><textarea required maxLength={2000} placeholder="指出具体疑问、关系或依据，也可以提出新知识建议。" value={feedbackText} onChange={e=>setFeedbackText(e.target.value)}/><textarea maxLength={2000} placeholder="建议如何修改？可附来源或复现步骤（可选）" value={suggestion} onChange={e=>setSuggestion(e.target.value)}/><button className="primary-button" disabled={busy}><Send size={14}/>提交具体问题</button></form><div className="detail-section-title"><span>反馈与回应</span><select aria-label="反馈筛选" value={feedbackScope} onChange={e=>setFeedbackScope(e.target.value as 'all'|'target')}><option value="target">当前对象</option><option value="all">全部反馈</option></select></div>{feedbackItems.length===0&&<p className="muted small">还没有反馈，欢迎留下第一个问题。</p>}{feedbackItems.map(f=><article className="feedback-card" key={f.id}><div><span>{f.author}</span><small>{f.status}</small></div><button className="feedback-target" onClick={()=>{const n=allNodes.find(n=>n.id===f.target);if(n)navigate(n.id);else{const e=allEdges.find(e=>e.id===f.target);if(e){navigate(e.source);setEdgeId(e.id);}}}}><small className="muted">{f.category||'建议'} · {f.targetTitle||allNodes.find(n=>n.id===f.target)?.title||allEdges.find(e=>e.id===f.target)?.label||'图谱'} · {new Date(f.createdAt).toLocaleDateString('zh-CN')}</small></button><p>{f.text}</p>{f.suggestion&&<blockquote>建议：{f.suggestion}</blockquote>}{f.response&&<blockquote>维护回应：{f.response}</blockquote>}{canEdit&&<form onSubmit={e=>{e.preventDefault();const el=e.currentTarget.elements.namedItem('response') as HTMLInputElement;mutate({action:'respond',id:f.id,response:el.value},'回应已保存');}}><input name="response" defaultValue={f.response} required placeholder="核实过程与处理说明"/><button disabled={busy}>保存回应</button></form>}</article>)}</>}
 {panel==='history'&&<><div className="eyebrow">EVOLUTION / 认识的轨迹</div><h2>版本与更新</h2><p className="small muted">每次发布记录修改原因。恢复历史内容会先创建草稿，审核后再发布。</p>{!store.revisions.length&&<div className="history-empty"><History size={28}/><p>初始结构 · v0.1</p><small>尚未发布内容修改</small></div>}{store.revisions.map((v,i)=><article className="feedback-card" key={v.id}><small className="muted">更新 {store.revisions.length-i} · {new Date(v.date).toLocaleString('zh-CN')}</small><p>{v.reason}</p>{v.changes&&<ul className="change-list">{v.changes.map((c,i)=><li key={i}>{c}</li>)}</ul>}{canEdit&&<button onClick={()=>mutate({action:'restore',id:v.id},'更新前的版本已恢复到草稿')}>恢复本次更新前内容为草稿</button>}</article>)}</>}
 </div></ReadingPanel></main>
 <div className="spectrum-tools" role="toolbar" aria-label="光谱工具栏"><div className="tool-main">{immersive&&<div className="immersive-selection"><span>{chosenMirror?'当前关系':'当前知识'}</span><button onClick={()=>{setDetailOpen(true);setPanel('detail');}}>{selectedEdge?.label||selected?.title||'选择知识节点'}<ArrowUpRight size={16}/></button></div>}<button className="workbench-action" onClick={autoLayout}>自动布局</button><button className={`workbench-action ${prismMode==='dispersion'?'tool-active':''}`} onClick={()=>{setPrismMode('dispersion');setLinking(false);setExpanded(false);setMirrorId(null);}}>色散</button><button disabled={!selected} className={`workbench-action ${prismMode==='refraction'?'tool-active':''}`} onClick={()=>{setPrismMode('refraction');setLinking(false);setExpanded(false);setQuery('');setKind('全部类型');setMirrorId(null);}}>折射</button><details className="workspace-tools" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary>探索工具</summary><div className="workspace-tool-menu" onClick={e=>{if((e.target as HTMLElement).closest('button')){const details=e.currentTarget.closest('details');if(details){details.open=false;details.querySelector('summary')?.focus();}}}}>{immersive&&<><button onClick={autoLayout}>自动布局</button><button aria-pressed={prismMode==='dispersion'} onClick={()=>{setPrismMode('dispersion');setLinking(false);setExpanded(false);setMirrorId(null);}}>色散 · 同图关联</button><button disabled={!selected} aria-pressed={prismMode==='refraction'} onClick={()=>{setPrismMode('refraction');setLinking(false);setExpanded(false);setQuery('');setKind('全部类型');setMirrorId(null);}}>折射 · 跨图探索</button></>}<button onClick={()=>{if(selected?.lens===lens)setRoots(r=>({...r,[lens]:selected.id}));else setNotice('请选择当前地图中的知识作为光源');}}>设为光源</button><button className={allRelations?'tool-active':''} onClick={()=>setAllRelations(value=>!value)}>{allRelations?'全部关系':'主路径'} · {secondaryCount} 条补充关联</button><button onClick={()=>{const old=parseExploration(readLocal('spectrum-layout-backup:'+atlasId));if(!old){setNotice('暂无旧布局备份');return;}applyExploration({...old,layoutVersion:LAYOUT_VERSION,manualPositions:[...Object.keys(old.positions),...Object.keys(old.refractedPositions)],mirrors:old.mirrors.map(m=>({...m,manual:true}))});setLayoutEpoch(n=>n+1);setNotice('已恢复旧布局；如仍拥挤可点击自动布局');}}>恢复旧布局</button><button onClick={()=>{setLocated(null);setFolds(previous=>({...previous,[foldKey]:{}}));}}>收起至两层</button><button onClick={placeMirror}>关系镜</button><button onClick={saveExploration}>保存探索</button><button onClick={restoreExploration}>恢复探索</button><button onClick={()=>setLibrary(true)}><Layers size={15}/>图谱空间</button><button onClick={()=>setList(!list)}>{list?'图谱':'列表'}</button><button onClick={()=>setPositions({})}>重置布局</button><button onClick={()=>{setDetailOpen(true);setPanel('history');}}><History size={14}/>更新</button><button onClick={openFeedback}><MessageSquare size={14}/>反馈</button>{canEdit&&<><button onClick={newNode}><Plus size={14}/>节点</button><button className={linking?'tool-active':''} onClick={()=>{setLinking(!linking);setLinkPending(false);setExpanded(false);setQuery('');setKind('全部类型');}}><GitBranch size={15}/>{linking?'退出连线':'拖动连线'}</button><button disabled={busy} onClick={()=>mutate({action:'draft',nodes:allNodes.map(n=>({...n,...(positions[n.id]||{})})),relations:allEdges},'布局已保存为草稿')}>保存布局</button>{store.draft&&<><button disabled={busy} onClick={()=>mutate({action:'discard'},'草稿已丢弃')}>丢弃草稿</button><button className="tool-active" onClick={()=>openEditor('publish')}>审核发布</button></>}</>}<span className="optical-path">光源（光线表示探索方向）：{allNodes.find(n=>n.id===root)?.title||'未设置'}{prismMode==='refraction'&&!path?' · 无连通上游路径':''}</span><span className="tool-status">{store.draft?'草稿预览 · 未发布':store.meta.title}</span></div></details></div>{chosenMirror&&<details className="mirror-controls"><summary>关系镜 · {mirrorRelation?.label}</summary><div className="mirror-inspector"><strong>关系：{mirrorRelation?.label}</strong><button className={pickingMirror?'tool-active':''} onClick={()=>setPickingMirror(!pickingMirror)}>{pickingMirror?'点击目标棱镜…':'选择目标棱镜'}</button><span>拖动镜子右侧出射点到目标，自动连接与调角</span><select aria-label="重定向目标" value={chosenMirror.targetId||''} onChange={e=>{if(e.target.value)connectMirror(chosenMirror.id,e.target.value);}}><option value="">或在此选择目标</option>{allNodes.filter(n=>n.id!==incomingNode).map(n=><option value={n.id} key={n.id}>{n.title} · {lenses[n.lens].name}</option>)}</select><button onClick={()=>updateMirror(mirrorId!,{targetId:undefined})}>还原原光路</button>{canEdit&&<button disabled={!(redirectTarget||suggestedTarget)} onClick={()=>{const target=redirectTarget||suggestedTarget;if(!target||!mirrorRelation)return;setEdgeForm({id:mirrorRelation.id,source:incomingNode,target,label:'',reason:''});setLinking(true);beginRelation();setNotice('请确认新关系名称与依据，保存后仅进入草稿');}}>重定向为关系草稿</button>}{canEdit&&<button onClick={()=>{if(!chosenMirror)return;mutate({action:'draft',nodes:allNodes,relations:allEdges.filter(e=>e.id!==chosenMirror.edgeId)},'关系已从草稿移除').then(ok=>{if(ok){setMirrorId(null);setEdgeId(null);}});}}>删除关系草稿</button>}</div></details>}{linking&&<div className="link-instructions">从节点右侧的 + 拖到目标左侧连接点；当前显示全部维度，可直接建立跨图关系。<button onClick={()=>{setDetailOpen(true);setPanel('detail');}}>查看详情</button></div>}{linking&&linkPending&&<form className="inline-relation" onSubmit={e=>{e.preventDefault();saveRelation();}}><span>{allNodes.find(n=>n.id===edgeForm.source)?.title} → {allNodes.find(n=>n.id===edgeForm.target)?.title}</span><input required aria-label="关系名称" placeholder="关系：依赖、采用、检验…" value={edgeForm.label} onChange={e=>setEdgeForm({...edgeForm,label:e.target.value})}/><input required aria-label="关系依据" placeholder="为什么关联？填写依据或标明待核实" value={edgeForm.reason} onChange={e=>setEdgeForm({...edgeForm,reason:e.target.value})}/><button disabled={busy} className="tool-active">保存关系草稿</button><button type="button" onClick={()=>setLinkPending(false)}>取消</button></form>}</div>
 <footer className="site-footer"><span>光谱 / Spectrum Atlas</span><span>领域 × 生态 × 认知 <span className="footer-spectrum"/></span><span>本地原型 · 所有示例待团队核实</span></footer>
 {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}{error&&<div className="error-toast" role="alert">{error}<button onClick={()=>setError('')} aria-label="关闭错误"><X size={15}/></button></div>}
 {library&&<Suspense fallback={<LoadingDialog close={()=>setLibrary(false)}/>}><AtlasLibrary current={store.meta} onSelect={selectAtlas} onClose={()=>setLibrary(false)} onChanged={refresh}/></Suspense>}
 {modal&&<div className="modal-backdrop" onClick={()=>setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-label="维护操作" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal(null)} aria-label="关闭窗口"><X size={20}/></button>
 {modal==='login'&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const b=await r.json();if(!r.ok)throw Error(b.error);setAdmin(true);setPassword('');await refresh();setModal(null);setNotice('已进入维护模式');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><div className="eyebrow">MAINTAINER ACCESS</div><h2>维护这束知识</h2><p className="muted small">本地开发默认口令见项目 README。维护者可编辑、审核和发布内容。</p><label>维护口令<input autoFocus type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary-button" disabled={busy}>进入维护空间</button></form>}
 {modal==='node'&&<form onSubmit={e=>{e.preventDefault();saveNode();}}><div className="eyebrow">KNOWLEDGE / DRAFT</div><h2>{allNodes.some(n=>n.id===form.id)?'编辑知识节点':'添加知识节点'}</h2><label>标题<input autoFocus required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="form-row"><label>所属视角<select value={form.lens} onChange={e=>setForm({...form,lens:e.target.value as Lens})}>{Object.entries(lenses).map(([k,v])=><option key={k} value={k}>{v.name}</option>)}</select></label><label>类型<input required value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}/></label></div><label>简要解释<input required maxLength={250} value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/></label><label>详细内容<textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label><label>来源链接（每行一个）<textarea value={form.sources.join('\n')} onChange={e=>setForm({...form,sources:e.target.value.split('\n')})}/></label><label>核实状态<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as KnowledgeNode['status']})}><option>待核实</option><option>已核实</option></select></label><div className="form-actions">{allNodes.some(n=>n.id===form.id)&&<button type="button" className="danger" onClick={()=>mutate({action:'draft',nodes:allNodes.filter(n=>n.id!==form.id),relations:allEdges.filter(e=>e.source!==form.id&&e.target!==form.id)},'节点及其关联已从草稿移除')}>移除节点与关联</button>}<button className="primary-button" disabled={busy}>保存草稿</button></div></form>}
 {modal==='relation'&&<form onSubmit={e=>{e.preventDefault();saveRelation();}}><div className="eyebrow">CONNECTION / DRAFT</div><h2>建立有依据的关系</h2><label>起点<select value={edgeForm.source} onChange={e=>setEdgeForm({...edgeForm,source:e.target.value})}>{allNodes.map(n=><option key={n.id} value={n.id}>{n.title} · {lenses[n.lens].name}</option>)}</select></label><label>终点<select value={edgeForm.target} onChange={e=>setEdgeForm({...edgeForm,target:e.target.value})}>{allNodes.map(n=><option key={n.id} value={n.id}>{n.title} · {lenses[n.lens].name}</option>)}</select></label><label>关系含义<input required value={edgeForm.label} onChange={e=>setEdgeForm({...edgeForm,label:e.target.value})} placeholder="例如：依赖、检验、提供实现"/></label><label>成立依据与待核实之处<textarea required value={edgeForm.reason} onChange={e=>setEdgeForm({...edgeForm,reason:e.target.value})}/></label><button className="primary-button" disabled={busy}>保存关系草稿</button></form>}
 {modal==='publish'&&<form onSubmit={e=>{e.preventDefault();mutate({action:'publish',reason:publishReason},'新版本已发布').then(ok=>ok&&setPublishReason(''));}}><div className="eyebrow">REVIEW / PUBLISH</div><h2>发布一次认识更新</h2><p className="muted small">草稿包含 {allNodes.length} 个节点、{allEdges.length} 条关系。发布后访客将看到新内容，旧内容保留为历史快照。</p><div className="review-summary"><strong>发布前变更检查</strong>{pendingChanges.length?<ul className="change-list">{pendingChanges.map((c,i)=><li key={i}>{c}</li>)}</ul>:<p className="small muted">没有内容差异，仅创建新版本记录。</p>}<p className="small muted">待核实节点：{allNodes.filter(n=>n.status==='待核实').length} · 无来源节点：{allNodes.filter(n=>!n.sources.length).length}</p></div><label>修改了什么？依据与原因是什么？<textarea required autoFocus value={publishReason} onChange={e=>setPublishReason(e.target.value)}/></label><button className="primary-button" disabled={busy}>确认发布本地版本</button></form>}
 </section></div>}
 {conflict&&!reviewOpen&&<div className="error-toast" role="alert"><span>图谱已被其他操作更新，本地编辑仍保留。</span><button onClick={()=>setReviewOpen(true)}>核对最新版本</button></div>}
 {conflict&&reviewOpen&&<Suspense fallback={<LoadingDialog close={()=>setReviewOpen(false)}/>}><ConflictReview local={conflict.local} latest={conflict.latest} busy={busy} onRead={readConflictLatest} onAdopt={adoptConflictLatest} onClose={()=>setReviewOpen(false)}/></Suspense>}
 {localBackup.length>0&&<details style={{position:'fixed',bottom:8,left:8,zIndex:4000,maxWidth:'80vw',background:'#171722',padding:12}}><summary>保留的本地修改副本（可复制）</summary><textarea aria-label="本地修改副本" readOnly rows={8} value={JSON.stringify(localBackup,null,2)}/><button onClick={()=>setLocalBackup([])}>已保存副本，关闭</button></details>}
 </div>;
}
