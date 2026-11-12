import type {KnowledgeNode,Relation,Lens} from './model';
const trt='https://docs.nvidia.com/deeplearning/tensorrt/latest/performance/best-practices.html';
const batch='https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html';
const ros='https://docs.ros.org/en/rolling/Tutorials/Demos/Real-Time-Programming.html';
const card=(id:string,title:string,lens:Lens,summary:string,body:string,sources:string[],x:number,y:number):KnowledgeNode=>({id,title,lens,kind:lens==='cognition'?'Infra 研究问题':lens==='ecology'?'Infra 工具资源':'AI Infra',summary,body,sources,status:'待核实',x,y});
export const infraNodes:KnowledgeNode[]=[
 card('infra-stack','AI Infra · 实时推理系统','domain','把视觉模型变成可测量、可部署、可持续运行的机器人能力。','AI Infra 连接模型、运行时、算力和控制系统。主线不是只比较模型推理速度，而是明确一次观测何时产生、何时被处理、动作何时执行。应同时记录任务成功率、端到端延迟、长尾抖动与内存条件。本组卡片为学习框架，不代表已完成设备实验。',[trt,ros],100,100),
 card('infra-e2e','端到端延迟预算','domain','拆分采集、预处理、排队、推理、传输和动作执行耗时。','模型耗时只是闭环的一段。给各阶段输入输出加时间戳，明确异步流水线与时钟同步边界。报告测量对象、设备、模型版本、精度、预热和样本量；均值无法代替截止时间的满足程度。',[trt,ros],300,100),
 card('infra-memory','显存与内存预算','domain','权重、激活、运行时工作区和并发会共同占用内存。','先测量峰值及稳定态，再比较输入分辨率、batch、精度和模型变更。模型能加载不代表能在目标并发下稳定推理。设备型号、功耗模式及其他进程是实验条件，不能省略。',[trt],500,100),
 card('infra-precision','低精度与量化取舍','domain','用精度和任务表现验证换取的时延及内存收益。','FP16、INT8 等配置的收益依赖设备、算子支持和转换流程。量化需要按工具要求准备代表性数据与验证；不能以参数更少或位宽更低直接推断控制成功率提高。先跑同条件基线，再比较误差、速度、内存和失败类型。',[trt],700,100),
 card('infra-scheduling','排队与批处理调度','domain','吞吐最大化和单次控制请求的低延迟可能冲突。','动态 batching 通过等待更多请求提升吞吐，等待也会消耗延迟预算。Triton 文档建议用性能分析工具比较 batch 与排队时间配置。机器人控制需要先说明请求频率、时效和截止时间，再选调度策略，不照搬服务端吞吐参数。',[batch],900,100),
 card('infra-jitter','实时性与长尾抖动','domain','稳定满足时间约束，需要观察最慢情况和调度行为。','实时性关注截止时间而不只是“运行很快”。内存分配、阻塞和执行调度可能引入不可预测的等待。记录延迟分布和超时比例；对超时、旧观测和设备故障定义应用层降级与停止策略。',[ros],1100,100),
 card('infra-benchmark','可复现的推理评测','domain','固定硬件、模型、输入、精度、预热与测量边界。','将首次加载、预热、稳定推理分开，报告样本量和测量方法。离线 benchmark 和在线闭环实验分别回答性能与任务可靠性问题。没有同条件基线，不把某工具宣称的加速倍数当成项目结论。',[trt,batch],1300,100),
 card('infra-tensorrt','TensorRT · 推理优化运行时','ecology','核查模型转换、设备支持、精度及性能测量条件。','官方最佳实践提供性能基线、内存预算与推理优化入口。是否适用于本项目，取决于目标硬件、模型算子、转换链路和验证结果。不是所有模型在所有设备上都自动加速。',[trt],100,400),
 card('infra-triton','Triton · 推理服务与调度','ecology','用模型实例与调度配置组织推理请求。','以动态 batching 文档为起点，理解并发、批大小、排队延迟和吞吐的关系。它是部署候选工具，不意味着机器人必须把控制请求发送到远程推理服务。',[batch],400,400),
 card('infra-ros','ROS 2 · 实时系统学习入口','ecology','从截止时间、阻塞与内存分配学习实时设计约束。','ROS 2 实时编程教程用于理解系统层影响，不等于安装 ROS 2 就获得硬实时保证。应结合操作系统、执行器、驱动和硬件平台验证。',[ros],700,400),
 card('infra-speed-question','模型更快，闭环一定更可靠吗？','cognition','同时比较推理加速、延迟分布和任务成功率。','假设：优化运行时减少推理耗时后，闭环可能受益。待验证：采集、队列、传输或动作是否成为主瓶颈？控制其他条件，分别记录分阶段耗时、总时延和任务失败。不能用一次离线测速证明因果。',[trt,ros],100,700),
 card('infra-batch-question','吞吐提升是否牺牲控制时效？','cognition','检查 batch 等待是否让输入观测在执行时已经过期。','比较禁用批处理和不同等待配置；记录吞吐、排队时间、长尾延迟、超时与任务成功率。接受哪种取舍应由任务的截止时间和错误后果决定，不由单一吞吐指标决定。',[batch],400,700),
 card('infra-budget-question','如何定义设备上的可部署性？','cognition','从能加载模型，走向可持续运行和可复现实验。','在目标设备上记录峰值内存、功耗与温度条件、延迟分布和任务结果；验证持续运行及异常恢复。只有在明确资源与任务约束后，才能判断方案是否可部署。本项目尚未给出实测结论。',[trt,ros],700,700)
];
const rel=(id:string,source:string,target:string,label:string,reason:string):Relation=>({id:'infra-rel-'+id,source,target,label,reason});
export const infraRelations:Relation[]=[
 rel('task','task','infra-stack','依赖运行基础设施','机器人视觉能力需要在目标算力和时间预算下运行。'),
 ...['infra-e2e','infra-memory','infra-precision','infra-scheduling','infra-jitter','infra-benchmark'].map((target,i)=>rel('core-'+i,'infra-stack',target,'拆解系统约束','按测量边界、资源和时间约束逐项分析部署问题。')),
 rel('latency','infra-e2e','latency','区分测量边界','模型推理耗时不能直接替代端到端延迟。'),
 rel('device','infra','infra-memory','约束资源预算','设备和运行环境决定可用内存及部署条件。'),
 rel('feedback','infra-jitter','feedback','影响闭环时效','不稳定等待可能影响反馈与动作的时效，需要实验。'),
 rel('precision-tool','infra-precision','infra-tensorrt','候选优化工具','通过官方文档核查精度配置与模型转换。'),
 rel('benchmark-tool','infra-benchmark','infra-tensorrt','提供评测入口','工具能力需在相同实验条件下验证。'),
 rel('schedule-tool','infra-scheduling','infra-triton','提供调度机制','批处理等待和吞吐取舍可从动态调度文档学习。'),
 rel('jitter-tool','infra-jitter','infra-ros','提供实时编程入口','学习阻塞、内存分配和调度对时间约束的影响。'),
 rel('speed-q','infra-e2e','infra-speed-question','提出验证问题','比较离线推理耗时与闭环成功率的关系。'),
 rel('batch-q','infra-scheduling','infra-batch-question','检验排队代价','吞吐提升的同时需核验控制时效。'),
 rel('budget-q','infra-memory','infra-budget-question','定义部署验收','内存、时延与持续运行共同约束可部署性。'),
 rel('existing-q','infra-speed-question','question','细化已有研究问题','用系统分阶段测量解释更快是否更可靠。'),
 rel('experiment','infra-benchmark','experiment','要求保留实验记录','记录环境、模型和失败配置以支持复现。')
];
