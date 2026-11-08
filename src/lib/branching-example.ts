import type {Store,KnowledgeNode} from './model';
const make=(id:string,title:string,x:number,y:number):KnowledgeNode=>({id,title,x,y,lens:'domain',kind:'光路演示',summary:'用于验证真实关系与彩色光路的一一对应。',body:'这是交互测试样例，不是研究结论。',sources:[],status:'待核实'});
export const branchingExample:Store={nodes:[
 make('task','光源 · 视觉任务',0,300),
 make('splitter','视觉感知 · 四路分支',400,300),
 make('detect','目标检测',900,0),
 make('segment','实例分割',900,220),
 make('depth','深度估计',900,440),
 make('pose','位姿估计',900,660)
],relations:[
 {id:'demo-input',source:'task',target:'splitter',label:'需要感知',reason:'白色入射光连接任务与视觉感知。'},
 ...['detect','segment','depth','pose'].map((target,i)=>({id:`demo-branch-${i}`,source:'splitter',target,label:['识别目标','分离轮廓','估计距离','定位姿态'][i],reason:'独立的真实关系，对应一条彩色出射光路及一面关系镜。'}))
],draft:null,feedback:[],revisions:[]};
