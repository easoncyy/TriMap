import type {KnowledgeNode,Relation,Lens} from './model';
const trt='https://docs.nvidia.com/deeplearning/tensorrt/latest/performance/best-practices.html';
const batch='https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html';
const ros='https://docs.ros.org/en/rolling/Tutorials/Demos/Real-Time-Programming.html';
// 来源复核日期：2026-11-12。滚动文档未固定版本；链接不是实机验证证据。
const asyncSource='https://huggingface.co/blog/async-robot-inference';
const card=(id:string,title:string,lens:Lens,summary:string,body:string,sources:string[],x:number,y:number):KnowledgeNode=>({id,title,lens,kind:lens==='cognition'?'Infra 研究问题':lens==='ecology'?'Infra 工具资源':'AI Infra',summary,body,sources,status:'待核实',x,y});
export const infraNodes:KnowledgeNode[]=[
 card('infra-async','异步推理与动作队列','domain','让下一段动作的计算与当前动作的执行并行，并检查观测与动作的时效。','同步执行可能在等待推理时暂停；异步执行把动作预测和执行解耦，客户端消费动作队列时计算下一段动作。需记录观测时间戳、动作片段覆盖时长、推理及通信耗时、队列余量和动作更新方式。并行不保证队列永不耗尽，也不保证旧动作适用于变化后的现场；应定义超时、过期动作与失联时的暂停或接管规则。LeRobot 官方 2025-07-10 文章提供一个实现案例，不代表所有策略支持同一接口或本组已验证收益。具体接口以选定版本为准。',[asyncSource,ros],1500,100),
 card('infra-stack','AI Infra · 实时推理系统','domain','把视觉模型变成可测量、可部署、可持续运行的机器人能力。','AI Infra 连接模型、运行时、算力和控制系统。主线不是只比较模型推理速度，而是明确一次观测何时产生、何时被处理、动作何时执行。应同时记录任务成功率、端到端延迟、长尾抖动与内存条件。本组卡片为学习框架，不代表已完成设备实验。',[trt,ros],100,100),
 card('infra-e2e','端到端延迟预算','domain','拆分采集、预处理、排队、推理、传输和动作执行耗时。','模型耗时只是闭环的一段。给各阶段输入输出加时间戳，明确异步流水线与时钟同步边界。报告测量对象、设备、模型版本、精度、预热和样本量；均值无法代替截止时间的满足程度。',[trt,ros],300,100),
 card('infra-memory','显存与内存预算','domain','权重、激活、运行时工作区和并发会共同占用内存。','先测量峰值及稳定态，再比较输入分辨率、batch、精度和模型变更。模型能加载不代表能在目标并发下稳定推理。设备型号、功耗模式及其他进程是实验条件，不能省略。',[trt],500,100),
 card('infra-precision','低精度与量化取舍','domain','用精度和任务表现验证换取的时延及内存收益。','FP16、INT8 等配置的收益依赖设备、算子支持和转换流程。量化需要按工具要求准备代表性数据与验证；不能以参数更少或位宽更低直接推断控制成功率提高。先跑同条件基线，再比较误差、速度、内存和失败类型。',[trt],700,100),
 card('infra-scheduling','排队与批处理调度','domain','吞吐最大化和单次控制请求的低延迟可能冲突。','动态 batching 通过等待更多请求提升吞吐，等待也会消耗延迟预算。Triton 文档建议用性能分析工具比较 batch 与排队时间配置。机器人控制需要先说明请求频率、时效和截止时间，再选调度策略，不照搬服务端吞吐参数。',[batch],900,100),
 card('infra-jitter','实时性与长尾抖动','domain','稳定满足时间约束，需要观察最慢情况和调度行为。','实时性关注截止时间而不只是“运行很快”。内存分配、阻塞和执行调度可能引入不可预测的等待。记录延迟分布、P95/P99 和超时比例；这些统计量不能单独证明最坏情况上界或硬实时保证。对超时、旧观测和设备故障定义应用层降级与停止策略。',[ros],1100,100),
 card('infra-benchmark','可复现的推理评测','domain','固定硬件、模型、输入、精度、预热与测量边界。','将首次加载、预热、稳定推理分开，报告样本量和测量方法。离线 benchmark 和在线闭环实验分别回答性能与任务可靠性问题。没有同条件基线，不把某工具宣称的加速倍数当成项目结论。',[trt,batch],1300,100),
 card('infra-tensorrt','TensorRT · 推理优化运行时','ecology','核查模型转换、设备支持、精度及性能测量条件。','官方最佳实践提供性能基线、内存预算与推理优化入口。是否适用于本项目，取决于目标硬件、模型算子、转换链路和验证结果。不是所有模型在所有设备上都自动加速。',[trt],100,400),
 card('infra-triton','Triton · 推理服务与调度','ecology','用模型实例与调度配置组织推理请求。','以动态 batching 文档为起点，理解并发、批大小、排队延迟和吞吐的关系。它是部署候选工具，不意味着机器人必须把控制请求发送到远程推理服务。',[batch],400,400),
 card('infra-ros','ROS 2 · 实时系统学习入口','ecology','从截止时间、阻塞与内存分配学习实时设计约束。','ROS 2 实时编程教程用于理解系统层影响，不等于安装 ROS 2 就获得硬实时保证。应结合操作系统、执行器、驱动和硬件平台验证。',[ros],700,400),
 card('infra-speed-question','模型更快，闭环一定更可靠吗？','cognition','同时比较推理加速、延迟分布和任务成功率。','当前判断：模型更快可能有益，但不充分保证闭环可靠。依据：端到端流程还包含采集、排队、通信和执行；官方运行时与实时编程资料提供测量和约束的背景，并非本组因果实验。未知：具体任务的瓶颈和时效要求。验证计划：固定任务、策略、设备及环境，比较分阶段耗时、总时延、超时和成功率。修正条件：若推理加速后总时延或成功率无改善，应调整瓶颈判断。尚无本组实测结果。',[trt,ros],100,700),
 card('infra-batch-question','吞吐提升是否牺牲控制时效？','cognition','检查 batch 等待是否让输入观测在执行时已经过期。','当前判断：吞吐提升可能付出排队等待代价，是否可接受取决于任务时效。依据：Triton 动态批处理文档说明批大小与排队等待配置。未知：本任务请求频率、可容忍观测年龄和截止时间。验证计划：比较禁用批处理及不同等待配置，记录吞吐、排队、P95/P99、超时和成功率。修正条件：若目标配置在任务截止时间内提高吞吐且不损害任务表现，则可接受该配置；不能推广至所有负载。尚未执行本组实验。',[batch],400,700),
 card('infra-budget-question','如何定义设备上的可部署性？','cognition','从能加载模型，走向可持续运行和可复现实验。','当前判断：能加载模型只是必要检查之一，可部署性还取决于时间、资源和任务约束。依据：运行时性能资料与 ROS 2 实时教程提供资源及时间约束背景，不构成目标设备验收。未知：目标设备、功耗模式、持续负载和可接受失败范围。验证计划：记录峰值内存、温度及功耗条件、延迟分布、任务结果，并测试持续运行和异常恢复。修正条件：若持续负载下越过预算或无法恢复，应撤回可部署判断并调整方案。本项目尚未给出实测结论。',[trt,ros],700,700)
];
const rel=(id:string,source:string,target:string,label:string,reason:string):Relation=>({id:'infra-rel-'+id,source,target,label,reason});
export const infraRelations:Relation[]=[
 rel('async-core','infra-stack','infra-async','衔接预测与执行','异步执行是候选系统方案，不是所有机器人必须采用的架构。'),
 rel('async-feedback','infra-async','feedback','约束反馈时效','依据异步推理案例，动作更新需结合新观测，检查队列和旧动作时效。'),
 rel('async-resource','infra-async','lerobot','参考异步实现','参见异步推理卡片的官方文章；接口及策略兼容性须按选定版本核实。'),
 rel('boundary-budget','app-boundary','infra-e2e','约束时间预算','工程分析建议：将任务运行条件转成可测量的时间要求，具体预算待任务验证。'),
 rel('handover-timeout','app-handover','infra-jitter','要求超时处置','工程分析建议：接管与恢复流程应覆盖超时、旧观测和失联；并非已经验证的安全保证。'),
 rel('evaluation-benchmark','app-evaluation','infra-benchmark','定义系统验收','工程分析建议：将任务验收要求对应到测量边界、负载和系统指标，仍需闭环任务评价。'),
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
