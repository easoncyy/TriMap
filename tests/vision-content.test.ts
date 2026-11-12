import {test} from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import type {KnowledgeNode, Relation, Store} from '../src/lib/model.ts';
import {validateGraph} from '../src/lib/model.ts';
import {lightPath, opticalView} from '../src/lib/optics.ts';
import {graphChanges} from '../src/lib/diff.ts';
import * as applicationContent from '../src/lib/application-content.ts';
import * as infraContent from '../src/lib/infra-content.ts';
import {visionNodes, visionRelations} from '../src/lib/vision-content.ts';

// Test the actual seed without changing its extensionless bundler imports.
// Transpile ONLY this pure content file in memory. The allowed runtime
// dependencies are the actual application, infra and vision content; no storage/server module, I/O
// capability or database is supplied to the evaluator. This is not a DB fixture.
const seedDependencies = {
  './application-content': {...applicationContent},
  './infra-content': {...infraContent},
  './vision-content': {visionNodes, visionRelations},
};
function readCurrentSeed(dependencies = seedDependencies): Store {
  const file = new URL('../src/lib/seed.ts', import.meta.url);
  const source = readFileSync(file, 'utf8');
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    fileName: 'seed.ts',
  });
  const exports: {seed?: Store} = {};
  runInNewContext(outputText, {
    exports,
    require(specifier: string) {
      assert.ok(Object.hasOwn(dependencies, specifier), 'Unexpected seed dependency; review before enabling it in this test');
      return dependencies[specifier as keyof typeof dependencies];
    },
  }, {timeout: 1000, filename: 'seed.ts'});
  assert.ok(exports.seed, 'The real seed must export a Store');
  return structuredClone(exports.seed);
}

const seed = readCurrentSeed();
// Exercise the integrated export itself; appending the pack again would hide
// missing integration and create duplicates. A pre-edit fingerprint below
// independently verifies the remaining original Store, including lifecycle data.
const combined = seed;
const visionNodeIds = new Set(visionNodes.map(n => n.id));
const visionRelationIds = new Set(visionRelations.map(e => e.id));
const original: Store = {
  ...seed,
  nodes: seed.nodes.filter(n => !visionNodeIds.has(n.id)),
  relations: seed.relations.filter(e => !visionRelationIds.has(e.id)),
};
const nodeKeys = ['id', 'title', 'kind', 'lens', 'summary', 'body', 'sources', 'status', 'x', 'y'].sort();
const relationKeys = ['id', 'source', 'target', 'label', 'reason'].sort();
const expectedExternalIds = [
  'task', 'vision', 'feedback', 'lerobot', 'libero', 'question', 'comparison', 'experiment',
  'app-specialized-training', 'app-handover', 'app-evaluation', 'app-gap-check',
].sort();
const sections = [
  '所属模块', '概念定义', '输入与输出', '核心技术原理', '代表性方法或模型',
  '机器人操作用途', '技术局限与成立条件', '评测方式', '可靠来源与核验', '尚待核实的问题', '本组状态',
];
const normalize = (text: string) => text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');

const revisedIds = new Set([
  'vision-depth-estimation', 'vision-object-pose-6d', 'vision-visuomotor-policy', 'vision-failure-detection',
]);
// Captured before Phase 2.1 edits. Only reviewed URL pinning is normalized:
// this freezes the complete PASS cards and all other relation prose, not just keywords.
const passBaseline: Record<string, string> = {
  "vision-object-detection": "e108bab443e0bf5c762fd703b0feff11bae31a7c7a21b681701d2d5984684029",
  "vision-instance-segmentation": "447c80b66b3c1570d13b9f7623110768c7c512a623b6706ecde16956b42c7db5",
  "vision-open-vocabulary": "351aa7881a4fe4a03ee96f56156463b0403db4f14c0b864ee6ba839204756df2",
  "vision-foundation-models": "5d294749a60176b9bd8e392be90c20b8b9a3d53457d1f980bc69c788fb16b86a",
  "vision-point-cloud-processing": "06bb1efc6d8e123418d608645086171381c1ae14daa9b6265c23adc2d746144c",
  "vision-3d-reconstruction": "0990a7868bfc63e17c39da3315383da7e7aae7748a31c4b7866571c295c8cfb2",
  "vision-imitation-learning": "07bf02c6c7f2a83e7745865fd57f167723041dac2c3bb3d7baf6f38ca253494c",
  "vision-grasp-pose": "1e9cc2ce5716872b0ce479151c5bbaa602f97a357d5937b234a5c0a32bfe0508",
  "vision-vla": "49d6e6575c70044630d9cbc96ff2c07e680b1e275f5366b6cbc5dd8a1af2edfc",
  "vision-visual-servoing": "c037c2ab2e7298edb362392ec4a14b0c4bebc114dc060eb8773bb197a9e2c950",
  "vision-visual-feedback": "a28933b8fa26403bc030e9ae2b5bad62fc535f2aee0eb99f4671e87cbfd30daf",
  "vision-action-correction": "e0640074ff00be568cba50c5407fb8b7592f9de89fd7dcfd9dfd04cffdb2deeb"
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unpinPaperUrls = (text: string) => text
  .replace(/https:\/\/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})v\d+/g, 'https://arxiv.org/abs/$1');
function section(id: string, name: string): string {
  const node = visionNodes.find(n => n.id === id);
  assert.ok(node, id);
  const paragraph = node.body.split('\n\n').find(p => p.startsWith(name + '：'));
  assert.ok(paragraph, id + ': ' + name);
  return paragraph;
}

function assertUnique(items: string[], description: string) {
  assert.equal(new Set(items).size, items.length, description);
}

function assertRelationships(nodes: KnowledgeNode[], relations: Relation[]) {
  validateGraph(nodes, relations);
  const meanings = relations.map(e => JSON.stringify([e.source, e.target, normalize(e.label)]));
  assertUnique(meanings, 'Duplicate directed relationship meaning');
  for (const e of relations) {
    assert.ok(e.reason.trim(), `Missing reason: ${e.id}`);
  }
}

test('vision v1 has sixteen unique, unverified domain cards in four equal modules', () => {
  assert.equal(visionNodes.length, 16);
  assertUnique(visionNodes.map(n => n.id), 'Duplicate vision node ID');
  const counts = new Map<string, number>();
  for (const n of visionNodes) {
    assert.match(n.id, /^vision-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(n.lens, 'domain');
    assert.equal(n.status, '待核实');
    const module = n.summary.split('｜')[0];
    counts.set(module, (counts.get(module) ?? 0) + 1);
    assert.ok(n.body.startsWith(`所属模块：${module}\n\n`));
  }
  assert.deepEqual(Object.fromEntries(counts), {
    '视觉感知': 4, '三维空间理解': 4, '视觉动作学习': 4, '闭环视觉控制': 4,
  });
});

test('exported records fit the current model exactly and round-trip as JSON', () => {
  assert.doesNotThrow(() => validateGraph(visionNodes, []));
  for (const n of visionNodes) {
    assert.deepEqual(Object.keys(n).sort(), nodeKeys);
    for (const key of ['title', 'kind', 'summary', 'body'] as const) assert.ok(n[key].trim(), `${n.id}.${key}`);
    assert.ok(n.title.length <= 120 && n.summary.length <= 250, 'Respect the current editor limits');
  }
  for (const e of visionRelations) assert.deepEqual(Object.keys(e).sort(), relationKeys);
  assert.deepEqual(JSON.parse(JSON.stringify({visionNodes, visionRelations})), {visionNodes, visionRelations});
});

test('each card includes substantive content, provenance and explicit review limits', () => {
  for (const n of visionNodes) {
    const paragraphs = n.body.split('\n\n');
    for (const section of sections) {
      const matches = paragraphs.filter(p => p.startsWith(`${section}：`));
      assert.equal(matches.length, 1, `${n.id}: missing or repeated ${section}`);
      assert.ok(matches[0].slice(section.length + 1).trim(), `${n.id}: empty ${section}`);
    }
    const provenance = paragraphs.find(p => p.startsWith('可靠来源与核验：'))!;
    assert.match(provenance, /查阅日期：\d{4}-\d{2}-\d{2}/);
    assert.match(provenance, /范围：/);
    assert.match(provenance, /核验情况：/);
    if (revisedIds.has(n.id)) {
      assert.match(provenance, /已查阅全文并定点核对/);
      assert.match(provenance, /未复现/);
    } else if (n.sources.some(url => !url.includes('open3d.org') && !url.includes('huggingface.co'))) {
      assert.match(provenance, /尚未进行全文核验/);
    }
    assert.match(n.body, /未开展本组复现或实机验证/);
  }
});

test('sources are specific first-party HTTPS references with in-card attribution', () => {
  const paths: Record<string, RegExp> = {
    'arxiv.org': /^\/(abs|pdf)\/\d{4}\.\d{4,5}v[1-9]\d*$/,
    'proceedings.mlr.press': /^\/v\d+\/[a-z0-9]+\.html$/,
    'www.open3d.org': /^\/docs\/0\.19\.0\/(tutorial\/.+|python_api\/open3d\.geometry\.PointCloud)\.html$/,
    'huggingface.co': /^\/docs\/lerobot\/(il_robots|libero)$/,
    'www-cvr.ai.uiuc.edu': /^\/~seth\/ResPages\/pdfs\/ChaHut06\.pdf$/,
  };
  for (const n of visionNodes) {
    assert.ok(n.sources.length > 0, n.id);
    assertUnique(n.sources, `${n.id}: repeated source`);
    for (const source of n.sources) {
      const url = new URL(source);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username + url.password + url.search, '');
      assert.ok(paths[url.hostname]?.test(url.pathname), `${n.id}: unreviewed source ${source}`);
      assert.ok(n.body.includes(source), `${n.id}: source is not attributed in the card`);
    }
  }
  // URL structure and attribution are deterministic tests, not proof of link
  // availability or scientific correctness. Those require manual source review.
});

test('new identities and titles do not recreate shared-seed content', () => {
  assertUnique(combined.nodes.map(n => n.id), 'Vision node collides with current seed');
  assertUnique(combined.relations.map(e => e.id), 'Vision relation collides with current seed');
  assertUnique(combined.nodes.map(n => normalize(n.title)), 'Duplicate shared knowledge title');
  for (const id of expectedExternalIds) {
    assert.ok(original.nodes.some(n => n.id === id), `Existing anchor removed: ${id}`);
    assert.ok(!visionNodes.some(n => n.id === id), `Anchor recreated: ${id}`);
  }
  // branching-example.ts is a different atlas with deliberately repeated topic
  // names for interaction testing; its demo IDs are not shared knowledge anchors.
});

test('all 32 relations resolve against the real seed with exactly the reviewed external anchors', () => {
  assert.equal(visionRelations.length, 32);
  const local = new Set(visionNodes.map(n => n.id));
  const external = new Set<string>();
  for (const e of visionRelations) {
    assert.match(e.id, /^vision-rel-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(local.has(e.source) || local.has(e.target), 'Do not add unrelated existing-to-existing edges');
    for (const id of [e.source, e.target]) if (!local.has(id)) external.add(id);
  }
  assert.deepEqual([...external].sort(), expectedExternalIds);
  assertRelationships(combined.nodes, combined.relations);
  assertUnique(visionRelations.map(e => JSON.stringify([e.source, e.target])), 'Parallel duplicate vision relationship');
});

test('every relation has technical evidence and references a reviewed source of an endpoint', () => {
  const nodes = new Map(combined.nodes.map(n => [n.id, n]));
  for (const e of visionRelations) {
    assert.ok(e.label.trim() && e.reason.trim(), e.id);
    assert.match(e.reason, /依据：https:\/\//);
    assert.match(e.reason, /核验边界：/);
    const evidence = e.reason.match(/https:\/\/[A-Za-z0-9./_~:-]+/g) ?? [];
    assert.ok(evidence.length, e.id);
    const endpointSources = [...nodes.get(e.source)!.sources, ...nodes.get(e.target)!.sources];
    for (const url of evidence) assert.ok(endpointSources.includes(url), `${e.id}: unattributed evidence ${url}`);
  }
});

test('content validation detects a removed anchor, duplicate meaning and missing reason', () => {
  assert.throws(() => assertRelationships(combined.nodes.filter(n => n.id !== 'lerobot'), combined.relations));
  const edge = visionRelations[0];
  assert.throws(() => assertRelationships(combined.nodes, [...combined.relations, {...edge, id: 'another-id'}]));
  assert.throws(() => assertRelationships(combined.nodes, [{...edge, reason: '  '}]));
});

test('each new domain card is reachable from task without inventing cross-map connections', () => {
  const nodes = combined.nodes.filter(n => n.lens === 'domain');
  const ids = new Set(nodes.map(n => n.id));
  const edges = combined.relations.filter(e => ids.has(e.source) && ids.has(e.target));
  for (const n of visionNodes) {
    assert.ok(lightPath(nodes, edges, 'task', n.id), `Unreachable domain card: ${n.id}`);
  }
  for (const anchor of ['task', 'vision', 'feedback']) {
    assert.ok(visionRelations.some(e => e.source === anchor || e.target === anchor), `Missing anchor connection: ${anchor}`);
  }
});

test('dispersion stays within the lens and refraction preserves only the path and direct cross-links', () => {
  const focus = 'vision-imitation-learning';
  const dispersion = opticalView(combined.nodes, combined.relations, 'domain', 'task', focus, 'dispersion');
  assert.ok(dispersion.nodes.every(n => n.lens === 'domain'));
  assert.ok(!dispersion.edges.some(e => e.id === 'vision-rel-imitation-lerobot'));
  const refraction = opticalView(combined.nodes, combined.relations, 'domain', 'task', focus, 'refraction');
  assert.deepEqual(refraction.path?.nodes, ['task', 'vision-visuomotor-policy', focus]);
  assert.deepEqual(new Set(refraction.edges.map(e => e.id)), new Set([
    'vision-rel-policy-task', 'vision-rel-imitation-policy', 'vision-rel-imitation-lerobot',
  ]));
  assert.ok(!refraction.nodes.some(n => n.id === 'libero'), 'Do not recursively expand LeRobot neighbors');
  const failure = opticalView(combined.nodes, combined.relations, 'domain', 'task', 'vision-failure-detection', 'refraction');
  assert.ok(failure.path);
  assert.ok(failure.edges.some(e => e.id === 'vision-rel-failure-experiment'));
  const lookup = new Map(combined.nodes.map(n => [n.id, n.lens]));
  assert.equal(visionRelations.filter(e => lookup.get(e.source) !== lookup.get(e.target)).length, 8);
});

test('seed integration preserves the original Store and appends exactly the reviewed content', t => {
  // SHA-256 of JSON.stringify(actual seed export), captured before Phase 3.1.
  // Deliberate future edits to the shared seed require reviewing this baseline.
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/content-integration.json', import.meta.url), 'utf8'));
  assert.equal(digest(baseline.legacyStore), '74fa2ff0869dd237d61f4acc78fc1a81cd9cb2a90d0293bddc6ebf52064c693e',
    'Frozen Phase 3.1 baseline changed');
  // Field-level approved deltas and all retained records are independently checked
  // in content-integration.test.ts; do not freeze a superseded whole-seed hash.
  assert.deepEqual(seed.nodes, [...original.nodes, ...visionNodes]);
  assert.deepEqual(seed.relations, [...original.relations, ...visionRelations]);
  const oldNodeIds = new Set(original.nodes.map(n => n.id));
  const oldRelationIds = new Set(original.relations.map(e => e.id));
  assert.deepEqual(seed.nodes.filter(n => !oldNodeIds.has(n.id)), visionNodes);
  assert.deepEqual(seed.relations.filter(e => !oldRelationIds.has(e.id)), visionRelations);
  assert.deepEqual(seed.nodes.filter(n => applicationContent.applicationNodes.some(a => a.id === n.id)),
    applicationContent.applicationNodes);
  assert.deepEqual(seed.relations.filter(e => applicationContent.applicationRelations.some(a => a.id === e.id)),
    applicationContent.applicationRelations);
  const changes = graphChanges(original, seed);
  assert.equal(changes.length, visionNodes.length + visionRelations.length);
  assert.ok(changes.every(change => change.startsWith('新增')));
  assert.deepEqual(seed, readCurrentSeed());
  t.diagnostic(`Actual seed: nodes ${original.nodes.length} + ${visionNodes.length} = ${seed.nodes.length}; relations ${original.relations.length} + ${visionRelations.length} = ${seed.relations.length}`);
});

test('content stays pure while the seed explicitly includes the reviewed vision pack', () => {
  const content = readFileSync(new URL('../src/lib/vision-content.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('vision-content.ts', content, ts.ScriptTarget.Latest, true);
  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement)) {
      assert.equal(statement.importClause?.isTypeOnly, true, 'Content must only import types');
      assert.equal((statement.moduleSpecifier as ts.StringLiteral).text, './model');
    }
  }
  assert.deepEqual(seed.nodes.filter(n => visionNodeIds.has(n.id)), visionNodes);
  assert.deepEqual(seed.relations.filter(e => visionRelationIds.has(e.id)), visionRelations);
  assert.equal(seed.draft, null);
});

test('repeated seed evaluation is idempotent and never mutates shared content modules', () => {
  // Reuse the same dependency objects across fresh module evaluations to catch
  // push/splice accumulation, rather than hiding it behind fresh cloned imports.
  const shared = structuredClone(seedDependencies);
  const before = structuredClone(shared);
  const first = readCurrentSeed(shared);
  for (let attempt = 0; attempt < 10; attempt++) {
    const again = readCurrentSeed(shared);
    assert.deepEqual(again, first);
    assertUnique(again.nodes.map(n => n.id), 'Repeat initialization duplicated nodes');
    assertUnique(again.relations.map(e => e.id), 'Repeat initialization duplicated relations');
    assertRelationships(again.nodes, again.relations);
    assertUnique(again.relations.map(e => JSON.stringify([e.source, e.target])), 'Repeat initialization duplicated endpoints');
  }
  assert.deepEqual(shared, before, 'Seed evaluation must not mutate its dependencies');
  assert.deepEqual(first, seed);
});

test('seed integration keeps lifecycle fields and approved vision source unchanged', () => {
  const {nodes, relations, ...lifecycle} = seed;
  const {nodes: oldNodes, relations: oldRelations, ...oldLifecycle} = original;
  assert.deepEqual(lifecycle, oldLifecycle);
  assert.deepEqual(lifecycle, {draft: null, feedback: [], revisions: []});
  // The full original Store fingerprint above also detects a lifecycle change.
  // No database or publish/restore API is invoked in these source-only tests.
  const content = readFileSync(new URL('../src/lib/vision-content.ts', import.meta.url));
  assert.equal(createHash('sha256').update(content).digest('hex'),
    '862fd5e62d471fb8bc294e76b4ab41c534ef4e33b280db0fd538fcf6202b3327');
});

test('all paper sources use the exact reviewed versions; documentation stays separately identified', () => {
  const sources = [...new Set(visionNodes.flatMap(n => n.sources))];
  const papers = sources.filter(url => !url.includes('open3d.org') && !url.includes('huggingface.co'));
  assert.deepEqual(papers.sort(), [
    'https://arxiv.org/abs/2005.12872v3',
    'https://arxiv.org/abs/1703.06870v3',
    'https://arxiv.org/abs/2303.05499v5',
    'https://arxiv.org/abs/2304.07193v2',
    'https://arxiv.org/abs/2304.02643v1',
    'https://arxiv.org/abs/2406.09414v2',
    'https://arxiv.org/abs/2312.08344v2',
    'https://arxiv.org/abs/2108.03298v2',
    'https://arxiv.org/abs/2103.14127v1',
    'https://arxiv.org/pdf/2303.04137v5',
    'https://arxiv.org/abs/2406.09246v3',
    'https://arxiv.org/abs/2410.00371v1',
    'https://proceedings.mlr.press/v139/radford21a.html',
    'https://proceedings.mlr.press/v87/ebert18a.html',
    'https://www-cvr.ai.uiuc.edu/~seth/ResPages/pdfs/ChaHut06.pdf',
  ].sort());
  assert.equal(sources.length, 21, '20 original references plus the reviewed Open3D projection API');
  for (const id of ['vision-imitation-learning', 'vision-visuomotor-policy']) {
    assert.match(section(id, '可靠来源与核验'), /文档未固定软件版本，实施时须另行锁定/);
  }
});

test('B1 distinguishes geometry and depth representation before metric back-projection', () => {
  const id = 'vision-depth-estimation';
  const definition = section(id, '概念定义');
  assert.match(definition, /轴向深度 Z 是点在相机光轴方向的坐标/);
  assert.match(definition, /沿成像射线的距离是点到相机光心的距离，二者通常不相等/);
  assert.match(definition, /相对深度描述未确定物理尺度/);
  assert.match(definition, /相对逆深度.*尺度和偏移不确定性/);
  assert.match(definition, /米制深度.*仍须注明是 Z 还是射线距离/);
  assert.match(section(id, '输入与输出'), /基础模型输出相对逆深度.*米制监督微调/);
  assert.match(section(id, '技术局限与成立条件'), /未经尺度、偏移及表示转换的相对逆深度不能直接用于 Open3D 的 Z 深度反投影/);
  assert.match(section(id, '技术局限与成立条件'), /不能假定简单取倒数即可获得米制 Z/);
  assert.match(section(id, '核心技术原理'), /z=d\/depth_scale/);
  assert.match(section(id, '机器人操作用途'), /米制射线距离须先.*转换为 Z/);
  assert.ok(visionNodes.find(n => n.id === id)!.sources.includes(
    'https://www.open3d.org/docs/0.19.0/python_api/open3d.geometry.PointCloud.html'));
});

test('B4 preserves FoundationPose model, reference, initialization and detector assumptions', () => {
  const id = 'vision-object-pose-6d';
  const io = section(id, '输入与输出');
  assert.match(io, /当前 RGB-D、相机内参和目标二维定位信息/);
  assert.match(io, /CAD／网格模型路线.*几何.*外观/);
  assert.match(io, /无 CAD 路线.*深度、相机参数和物体位姿/);
  assert.match(io, /不能由任意参考照片直接建立完整物体表示/);
  assert.match(section(id, '核心技术原理'), /初始位姿假设.*精化、评分与选择/);
  assert.match(section(id, '核心技术原理'), /跟踪使用上一帧位姿.*首帧需初始位姿/);
  assert.match(section(id, '技术局限与成立条件'), /外部 Mask R-CNN 检测.*漏检或误检/);
  assert.match(section(id, '评测方式'), /分别报告 CAD／网格与无 CAD.*单帧估计与连续跟踪/);
  assert.match(section(id, '评测方式'), /YCBInEOAT.*真值初始位姿与估计模块初始化.*YCB-Video.*真值初始位姿/);
  assert.match(section(id, '评测方式'), /默认跟踪丢失后不重新初始化/);
});

test('C3 binds the 15-task claim to v5 and separates observation and execution settings', () => {
  const id = 'vision-visuomotor-policy';
  const methods = section(id, '代表性方法或模型');
  assert.match(methods, /固定引用 arXiv v5.*15 项任务/);
  assert.match(methods, /仿真中.*视觉／状态配置.*BlockPush、Kitchen 使用状态观测/);
  assert.match(methods, /实机实验.*Egg Beater、Mat Unrolling、Shirt Folding 三项双臂实验/);
  assert.match(methods, /不能将所有结果归为纯视觉策略表现/);
  assert.doesNotMatch(methods, /十二项|12 项/);
  assert.match(section(id, '评测方式'), /按视觉或状态观测、仿真或实机、单臂或双臂分别报告/);
  assert.ok(visionNodes.find(n => n.id === id)!.sources.includes('https://arxiv.org/pdf/2303.04137v5'));
});

test('D3 separates detection, prediction, diagnosis and anomaly with AHA metric limits', () => {
  const id = 'vision-failure-detection';
  const definition = section(id, '概念定义');
  assert.match(definition, /失败检测.*当前或已经发生/);
  assert.match(definition, /失败预测.*未来明确时间范围/);
  assert.match(definition, /失败诊断分析导致失败的原因/);
  assert.match(definition, /异常检测.*异常不一定是任务失败/);
  assert.match(definition, /自然语言解释本身不能证明因果诊断正确/);
  assert.match(section(id, '输入与输出'), /子任务语言描述.*按时间、视角组织的关键帧/);
  assert.match(section(id, '输入与输出'), /截至当前子任务.*白色图块.*Yes／No.*自然语言解释/);
  const evaluation = section(id, '评测方式');
  assert.match(evaluation, /AHA 测试集、ManiSkill-Fail 仿真数据与 RoboFail 真实失败数据/);
  assert.match(evaluation, /Binary Success.*标注的一致性，不是机器人实际执行成功率/);
  assert.match(evaluation, /ROUGE-L.*不能单独证明因果诊断正确/);
  assert.match(section(id, '技术局限与成立条件'), /不能证明连续视频实时预测或可靠因果诊断已经实现/);
});

test('the twelve PASS cards are byte-equivalent records apart from paper URL pinning', () => {
  const retained = visionNodes.filter(n => !revisedIds.has(n.id));
  assert.deepEqual(retained.map(n => n.id).sort(), Object.keys(passBaseline).sort());
  for (const n of retained) {
    assert.equal(digest(JSON.parse(unpinPaperUrls(JSON.stringify(n)))), passBaseline[n.id], n.id);
  }
});

test('all reviewed relation IDs and endpoints survive; only relation 6 prose can change', () => {
  assert.equal(digest(visionRelations.map(({reason, ...edge}) => edge)),
    'e62bc717cb86d600e514f8c13fe33790e6356af5d241d1baf0de2a6fec55bce6', 'Reviewed topology, order and labels must stay unchanged');
  const untouched = visionRelations.filter(e => e.id !== 'vision-rel-depth-point-cloud');
  assert.equal(digest(JSON.parse(unpinPaperUrls(JSON.stringify(untouched)))),
    '5279749fca6fc4be90217a1e0760ee9f06f314c2b97fe1aebb95bec19784f293', 'Only paper URL pinning is allowed in the other 31 reasons');
  const projection = visionRelations.find(e => e.id === 'vision-rel-depth-point-cloud')!;
  assert.match(projection.reason, /米制射线距离须先转换为 Z/);
  assert.match(projection.reason, /未经尺度、偏移及表示转换的相对逆深度不能直接作为米制 Z 输入/);
  assert.match(projection.reason, /python_api\/open3d.geometry.PointCloud.html/);
});
