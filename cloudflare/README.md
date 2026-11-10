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
