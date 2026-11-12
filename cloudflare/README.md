# Cloudflare Pages 部署

正式地址：https://trimap-spectrum-atlas.pages.dev

前端直接复用 src/components，通过 esbuild 构建；API 使用 Pages advanced-mode Worker，复用原 API 流程，通过薄层 Request/Response 适配连接 D1。原 Next.js + 本地 SQLite 保留。

## 部署与更新

在 cloudflare 目录运行 `npm ci`、`npm run build`，然后执行 `node node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name trimap-spectrum-atlas --branch main`。固定 Wrangler 4.92.0；较新版本的 Pages 命令可能自动迁移到 Workers/OpenNext，不要无意升级。

D1 配置在 wrangler.jsonc，数据库结构在 migrations。首次部署运行 `node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote`。应用使用比较更新检查并发冲突，失败后刷新重试。种子数据只做 INSERT OR IGNORE，不覆盖用户内容。

VISITOR_SECRET、MAINTAINER_PASSWORD 是 Pages secrets，不得提交源码。部署时均生成随机值；维护者使用前需在 Cloudflare 的 Pages 项目设置中将 MAINTAINER_PASSWORD 替换成自己掌握的强口令，再重新部署。访客创建自己的图谱不需要维护者口令。更换 VISITOR_SECRET 会使已有匿名归属 Cookie 失效。

公开网站不依赖 ChatGPT 登录。没有上传本地数据库或个人内容。当前未实现维护登录限流，随机长口令不得替换成默认本地弱口令；后续可接入 Cloudflare 防护。不要记录 Cookie、口令或个人资料。

## 已验证与限制

线上已验证页面、种子读取、访客 Cookie、创建私有图谱、草稿、发布、反馈、D1 持久化和跨访客隔离。测试产生一份独立私有图谱「Pages 部署验证」。未进行浏览器视觉验收；未验证中国大陆各运营商的无代理可达性。pages.dev 默认域名不构成大陆访问保证，后续建议绑定自有域名并实测。

部署目录 dist、Wrangler 本地状态和 .dev.vars 不提交。更新原 API 时应同步检查 cloudflare/atlas.ts、atlases.ts、session.ts 的适配版本。

## Infra 发布验收

AI Infra 层负责构建可复现性、部署版本追踪、数据库连通性及上线验证；知识内容由对应方向通过独立 PR 维护。

PR 的 `Verify Infra and Pages` 工作流安装锁定依赖，运行类型、单元测试及 Pages 构建，无部署权限和云端密钥。合并后从最新 main 构建，使用 `pages deploy ... --branch main --commit-hash <完整SHA>` 部署。

构建内嵌 Git HEAD，`/api/health` 对 D1 只执行 SELECT 1，返回 revision；未配置或数据库异常时返回 503，不泄露底层错误。`release.json` 同样记录版本。入口脚本和样式设置 no-cache，避免更新后命中旧固定文件名。

上线后运行 `npm run smoke -- https://trimap-spectrum-atlas.pages.dev <完整SHA>`，只读检查页面、D1、部署版本、共享图谱及匿名权限。Node 24 在代理环境可使用 `NODE_USE_ENV_PROXY=1` 及 HTTPS_PROXY。健康检查不是性能基准，也不代替完整写入流程和浏览器验收。

部署更新代码不会覆盖 D1 已存在的共享知识。仓库 seed 的新增卡片需按内容审核流程导入草稿、审核发布，不能通过重置数据库同步。出现问题可在 Cloudflare Pages 回滚到先前成功部署；回滚代码不回滚 D1 内容，数据库变更另行评估。

## 同步仓库新增知识

`npm run build` 只更新代码，不更新已有 D1 知识。内容 PR 合并后，在有 D1 授权的机器上运行 `node cloudflare/sync-content.mjs`（可从任意工作目录启动绝对路径脚本）。工具只补充共享地图中缺少 ID 的节点和关系，保存历史快照、保留反馈及已有修改；如有草稿，同步补齐其中的新增内容。执行前的完整状态备份保存在被 Git 忽略的 `cloudflare/.wrangler/content-backups/`，不要上传。

重复执行不会新增重复内容；写入使用原状态比较保护并发更新，遇冲突重读重试。同 ID 的卡片文字更新不自动覆盖线上编辑，需要单独审核。私人图谱和复制图谱不会被修改。

2026-11-12 已同步应用层新增卡片：正式共享图谱为 31 个节点、37 条关系，其中新增 20 个节点、25 条关系，保留更新前历史。通过正式域名 API 验证，重复执行无变更。

## 固定标签与退役样例

文字固定在所属物体附近，自动布局通过增加物体间距与考虑固定标签区域减少遮挡，不再独立移动文字。迁移 0002 只删除 id=example-branching-v1 且 owner=system 的旧演示；初始化不再创建该样例，用户个人复制及其他地图不受影响。

本轮新增 Infra 内容与镜面折叠，发布顺序：构建部署（停止创建演示样例）→ 应用迁移 0002 → 执行 sync-content.mjs → smoke 验证版本及 Infra 卡片，并确认 /api/atlases 不再返回系统演示。

固定 Wrangler 的本地模拟器不支持当前线上兼容日期；本地预览可显式传 `pages dev dist --compatibility-date 2026-05-22`，仅改变本地模拟日期，不修改线上配置。
