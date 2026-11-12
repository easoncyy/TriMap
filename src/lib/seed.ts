import {visionNodes, visionRelations} from './vision-content';
import type {Store, KnowledgeNode} from './model';
import {infraNodes,infraRelations} from './infra-content';
import {applicationNodes, applicationRelations} from './application-content';
const node=(id:string,title:string,kind:string,lens:KnowledgeNode['lens'],summary:string,x:number,y:number,body=summary,sources:string[]=[]):KnowledgeNode=>({id,title,kind,lens,summary,body,sources,status:'待核实',x,y});
export const seed:Store={nodes:[
node('task','桌面抓放','典型任务','domain','从看见目标，到可靠地完成一次抓取与放置。',420,220,'贯穿三张地图的示例任务。先理解感知、计算与操作的整体联系。当前所有内容为框架样例，尚未形成团队实验结论。'),
node('vision','视觉感知','核心能力','domain','识别物体，并获取操作所需的信息。',110,80),
node('latency','推理延迟','系统指标','domain','从输入观测到获得模型输出所需的时间。',730,90,'推理延迟只是端到端延迟的一部分，不能直接等同于控制周期。需要明确测量边界、设备、精度与批大小。'),
node('feedback','闭环反馈','技术方法','domain','执行后重新观察，依据偏差调整后续动作。',170,390),
node('course','课程与学习入口','学习路径','domain','连接能力、基础知识与真实课程。',730,380,'待补充适用专业、年级的培养方案和课程大纲。不得只凭课程名称推断覆盖内容。'),
node('lerobot','LeRobot','开源框架','ecology','机器人学习的数据、策略与训练评测工具。',120,100,'官方文档是核查工具能力与运行条件的入口；具体版本、策略和任务兼容性需进一步核实。',['https://huggingface.co/docs/lerobot/']),
node('libero','LIBERO','评测资源','ecology','用于研究机器人操作和知识迁移的基准。',600,100,'用作实践候选资源，是否采用需先验证环境和策略能否匹配。',['https://github.com/Lifelong-Robot-Learning/LIBERO']),
node('infra','部署与算力','资源条件','ecology','硬件、运行环境与工具链共同限制可行方案。',350,350),
node('question','更快一定更可靠吗？','研究问题','cognition','推理延迟下降，会不会改善抓放任务表现？',360,100,'当前为待检验问题。离线测速不能证明闭环任务成功率提高，应控制任务、策略和环境条件。'),
node('comparison','控制变量比较','思考方法','cognition','固定其他条件，只改变一个明确因素。',80,350),
node('experiment','实验与失败记录','实践案例','cognition','保留配置、输入输出、结果与异常。',650,350,'尚无真实实验结果。后续记录设备、模型版本、种子、任务、次数和失败类型，避免用演示代替评价。'),
...applicationNodes,
...infraNodes,
...visionNodes
],relations:[
{id:'r1',source:'vision',target:'task',label:'提供感知',reason:'抓放任务需要获取目标与环境信息。'},
{id:'r2',source:'latency',target:'task',label:'形成时间约束',reason:'观测与动作之间的等待可能影响任务；具体影响需要实验。'},
{id:'r3',source:'feedback',target:'task',label:'支持修正',reason:'后续观测用于调整执行。'},
{id:'r4',source:'course',target:'vision',label:'提供学习入口',reason:'课程对应关系待依据培养方案核查。'},
{id:'r5',source:'lerobot',target:'libero',label:'提供集成入口',reason:'参见 LeRobot 的 LIBERO 文档，使用前核查版本与条件。'},
{id:'r6',source:'infra',target:'lerobot',label:'约束运行',reason:'策略运行需要匹配硬件与软件环境。'},
{id:'r7',source:'lerobot',target:'task',label:'候选实现工具',reason:'是否用于该具体任务尚待验证。'},
{id:'r8',source:'infra',target:'latency',label:'影响指标',reason:'设备和推理配置会影响耗时。'},
{id:'r9',source:'question',target:'latency',label:'检验影响',reason:'研究问题将延迟与任务表现联系起来。'},
{id:'r10',source:'comparison',target:'question',label:'组织验证',reason:'避免多个变量同时变化导致归因困难。'},
{id:'r11',source:'experiment',target:'question',label:'提供证据',reason:'这是待执行的证据收集计划，并非已有结论。'},
{id:'r12',source:'experiment',target:'libero',label:'候选实验环境',reason:'待完成兼容性与资源验证。'},
...applicationRelations,
...infraRelations,
...visionRelations
],draft:null,feedback:[],revisions:[]};
