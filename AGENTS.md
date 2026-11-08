<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 项目交接说明

## 目标与现状

TriMap「光谱」是面向具身视觉知识的本地三维度图谱原型。先读 README.md 了解启动、权限、数据、交互及当前限制。领域、生态、认知是共享知识结构的不同视角；演示知识需要核实，不应包装成已验证的研究结论。

## 代码入口

- `src/components/Atlas.tsx`：主界面状态、探索和维护交互；`GraphCanvas.tsx` 负责画布，`OpticalNodes.tsx` 和 `SpectralEdge.tsx` 负责视觉对象与光路。
- `src/lib/model.ts`：节点、关系与校验；`optics.ts`：视角和光路；`layout.ts`：自动布局；`storage.ts`：SQLite、迁移和事务；`auth.ts`：权限；`diff.ts`：版本差异；`seed.ts`：样例。
- `src/app/api/`：图谱内容、图谱空间和会话接口；`src/app/globals.css`：主题与响应式样式；`tests/`：单元和接口集成测试。

## 不可破坏的产品语义

- 每个知识节点是棱镜，每条可见知识关系对应一面可选中、可拖动并展示关系详情的镜子；光线只负责展示知识流，不把关系文字重新放回光线上。
- 默认色散呈现同图关系；折射围绕选中节点展示跨图关系和可达的光源上游路径。不凭空制造不存在的关联。
- 拖动关系镜不能连带移动知识棱镜；保留互斥选择和精确拖动。自动布局要考虑节点、镜子的间距与偏折效果，允许手动微调，不承诺任意复杂图零交叉。
- 个人探索、镜子目标预览和浏览器布局不能静默修改正式关系。修改知识要遵循权限检查、草稿、审核发布和版本记录。
- 用户角色为访客和维护者。访客可反馈，并可管理自己创建的图谱；维护者有管理权限。不要仅依靠前端隐藏控件实施权限控制。
- 艺术表达延续深色留白、精细几何与克制光谱；视觉升级不能牺牲文字可读性、探索路径或减少动态效果的支持。

## 数据与隐私

- `data/atlas.sqlite` 和旧版 `data/store.json` 是用户本地数据，修改迁移或存储时保留兼容和事务语义。不要为测试清空、覆盖或提交真实数据；测试应使用独立临时数据库。
- 不要把真实姓名、邮箱、个人资料、密钥、Cookie、`.env.local` 或数据库写入示例、文档、日志和提交。使用中性虚构示例；提交前检查差异和 Git 作者配置。不要擅自改写仓库历史或强制推送。
- 访客归属依赖签名 Cookie，跨浏览器或清除 Cookie 后不能假定身份可恢复。图谱公开范围仅限当前服务实例；部署到公网需要另行完善安全和运维。

## 工作与验证

- 保留用户已有的未提交更改，先检查工作区；变更前阅读相关代码及适用的 Next.js 本地文档。
- 按改动运行适当检查：`npm run typecheck`、`npm test`、`npm run build`；接口或权限改动还应在构建后运行 `npm run test:integration`。集成测试使用 3101 端口和临时数据库。
- 开发服务运行时可通过 `ATLAS_BUILD_DIR=.next-verify` 隔离生产构建目录；使用 PowerShell 时设置 `$env:ATLAS_BUILD_DIR='.next-verify'`。
- 图谱交互或视觉变更应在浏览器中检查节点拖动、关系镜拖动与选中、色散／折射、自动布局及不同屏幕尺寸；记录未能验证的部分。
- 如需提交，核查差异是否包含本地数据或个人信息；根据用户要求决定是否推送或部署。
- 用户面向的中文 Markdown 中，加粗标记外与相邻文字之间留空格；不需要强调时优先使用普通文本。
