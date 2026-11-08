import type {KnowledgeNode,Relation} from './model';
export function graphChanges(before:{nodes:KnowledgeNode[];relations:Relation[]},after:{nodes:KnowledgeNode[];relations:Relation[]}){
 const changes:string[]=[];
 for(const [label,oldItems,newItems] of [['节点',before.nodes,after.nodes],['关系',before.relations,after.relations]] as const){
  for(const item of newItems){const old=oldItems.find(x=>x.id===item.id);const title='title' in item?item.title:item.label;if(!old)changes.push(`新增${label}：${title}`);else if(JSON.stringify(old)!==JSON.stringify(item))changes.push(`修改${label}：${title}`);}
  for(const item of oldItems)if(!newItems.some(x=>x.id===item.id))changes.push(`移除${label}：${'title' in item?item.title:item.label}`);
 }
 return changes;
}
