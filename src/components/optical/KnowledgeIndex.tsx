'use client';

import {useLayoutEffect, useRef, useState} from 'react';
import {lenses, type KnowledgeNode, type Relation} from '@/lib/model';

export type RecordKey = {kind:'node'|'relation'; id:string} | {kind:'index'};
type Visit = {key:RecordKey; scroll:number; focus:string|null};
type Props = {initial:RecordKey; nodes:KnowledgeNode[]; relations:Relation[]; onClose:()=>void; onLocate:(id:string)=>void};

export default function KnowledgeIndex({initial,nodes,relations,onClose,onLocate}:Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const history = useRef<Visit[]>([]);
  const restoring = useRef<Visit|null>(null);
  const [key,setKey] = useState(initial);
  const [query,setQuery] = useState('');
  const node = key.kind==='node' ? nodes.find(item=>item.id===key.id) : undefined;
  const relation = key.kind==='relation' ? relations.find(item=>item.id===key.id) : undefined;
  const linked = node ? relations.filter(item=>item.source===node.id||item.target===node.id) : [];
  useLayoutEffect(()=>{dialog.current?.showModal();},[]);
  useLayoutEffect(()=>{
    const panel=dialog.current;
    if(!panel)return;
    const visit=restoring.current;
    const trigger=visit?.focus?panel.querySelector<HTMLElement>('[data-entry="'+CSS.escape(visit.focus)+'"]'):null;
    (trigger || (key.kind==='index'?search.current:heading.current))?.focus({preventScroll:true});
    panel.scrollTop=visit?.scroll||0;
    restoring.current=null;
  },[key]);
  function open(next:RecordKey) {
    history.current.push({key,scroll:dialog.current?.scrollTop||0,focus:(document.activeElement as HTMLElement)?.dataset.entry||null});
    setKey(next);
  }
  function back(){
    const visit=history.current.pop();
    if(visit){restoring.current=visit;setKey(visit.key);}
  }
  const rows=[
    ...nodes.map(n=>({kind:'node' as const,id:n.id,title:n.title,category:n.kind})),
    ...relations.map(r=>({kind:'relation' as const,id:r.id,title:r.label,category:'关系镜'})),
  ].filter(r=>(r.title+' '+r.category).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <dialog ref={dialog} id="library" aria-labelledby="dialog-title" onClose={onClose}>
    <header className="dialog-head"><div className="reader-heading">
      {(node||relation)&&<p className="record-meta">{node?[lenses[node.lens].name,node.kind,node.status].join(' · '):'关系镜'}</p>}
      <h2 ref={heading} id="dialog-title" tabIndex={-1}>{node?.title||relation?.label||'知识索引'}</h2></div>
      {!!history.current.length&&<button onClick={back}>← 返回</button>}<button onClick={()=>dialog.current?.close()}>关闭 ×</button></header>
    <div id="dialog-body">{node ? <div className="record-layout"><div className="record-text">
      <p className="record-lead">{node.summary}</p><p className="body-copy">{node.body}</p><section className="record-sources"><h3>来源</h3>
      {node.sources.length?node.sources.map((s,i)=>/^https?:\/\//i.test(s)?<a className="source-link" key={i} href={s} target="_blank" rel="noopener noreferrer">{s}</a>:<p key={i}>{s}</p>):<p>此条目尚未附来源。</p>}</section>
      <button className="locate-record" onClick={()=>{dialog.current?.close();onLocate(node.id);}}>在图中定位 ↗</button></div>
      <section className="record-links"><h3>全部关联 · {linked.length}</h3>{linked.map(r=><button key={r.id} className="rel-row" data-entry={'relation:'+r.id} onClick={()=>open({kind:'relation',id:r.id})}><span>{r.label}</span><span aria-hidden="true">↗</span></button>)}</section></div>
    :relation ? <div className="record-layout"><div><h3>关系依据</h3><p className="body-copy">{relation.reason}</p></div><section className="record-links"><h3>关联节点</h3>
      {[relation.source,relation.target].map((id,i)=><button key={i} className="library-row endpoint-row" data-entry={'node:'+id} onClick={()=>open({kind:'node',id})}><small>{i?'目标':'起点'}</small>{nodes.find(n=>n.id===id)?.title}</button>)}</section></div>
    :<><input ref={search} id="query" aria-label="搜索知识标题、类型或关系" placeholder="搜索知识标题、类型或关系" value={query} onChange={e=>setQuery(e.target.value)}/><p id="count" role="status">共 {rows.length} 个条目</p>
      {rows.map(r=><button key={r.kind+':'+r.id} data-entry={r.kind+':'+r.id} className="library-row" onClick={()=>open({kind:r.kind,id:r.id})}>{r.title}<small>{r.category}</small></button>)}</>}</div>
  </dialog>;
}
