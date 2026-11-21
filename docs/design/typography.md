# 光谱字体系统

本规范记录已确认的本地预览方案。字体通过 `src/app/typography.css` 的角色变量使用；保留现有星图、阅读结构和所有知识数据。

| 角色 | 字体 / CSS token | 字重与尺寸 |
|---|---|---|
| 光谱品牌、图谱主标题 | 猫啃网故障宋 / `--type-glitch-display` | 原生 900；品牌 23–30px，标题 26–38px |
| 共享样例、图谱归属辅助信息 | 猫啃网故障黑 / `--type-glitch-ui` | 原生 900 |
| 顶部操作、探索范围、三视角、工具栏 | 金字社统方体 / `--type-explorer` | 400；控件 14px，窄屏 12–13px |
| 普通知识与关系标签 | 乐米月萤宋（回退 IBM Plex Sans SC） / `--type-graph` | 400；桌面 15px，手机 14px |
| 选中展开标签及元信息 | 金字社统方体 / `--type-explorer` | 400；标题 17px，手机 16px；元信息 12px |
| 阅读面板 | 思源宋体 / `--type-editorial` | 400；正文 16–18px，行高 1.85，手机 1.8 |
| 英文展示 | Cormorant Garamond / `--type-latin-display` | 原生直体或斜体 500 |
| 其他 UI、数字与回退 | Space Grotesk + MiSans / `--type-ui` | 400/500；正文 15px，行高 1.6 |
| 次级展示与品牌回退 | 朱雀仿宋 / `--type-display` | 400 |

画布常规缩放档位相差 1.25 倍。以 14px 标题为基准，每档变化 1px，在 12～17px 之间连续插值。其他字号按相同比例变化。相机移动和静止后的布局使用同一函数，避免停止缩放时字号突然改变。界面禁用合成字重；不把艺术字体推广到整篇正文。

## 来源与许可

- 乐米月萤宋由杭州乐米网络科技有限公司制作。本项目使用原始 TTF 同源加载。项目方确认已取得网页嵌入及公开分发授权。[随包说明](../../public/optical/type/licenses/lemi-yueying-song.txt)

- 金字社统方体、猫啃网故障黑和故障宋来自用户提供的字体包，随包 SIL OFL 1.1 允许嵌入和派生。WOFF2 派生版使用 `Spectrum Graph Labels`、`Spectrum Glitch Sans`、`Spectrum Glitch Serif` 名称，保留原版权信息及许可证。参见 [字体目录](../../public/optical/type/) 中各 `*OFL.txt`。
- IBM Plex Sans SC 来自用户提供的 IBM Plex 1.1.0 字体包。保留官方 Regular/Medium WOFF2 分片原件，仅调整 CSS 路径与加载策略；许可为 [SIL OFL 1.1](../../public/optical/type/ibm-plex-sc/LICENSE.txt)。当前普通图谱标签使用 Regular。
- [朱雀仿宋 v0.212](https://github.com/TrionesType/zhuque/releases/tag/v0.212)、[思源宋体 CN 2.003](https://github.com/adobe-fonts/source-han-serif)、[Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond)、[Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) 使用 OFL；派生字体使用 Observatory 名称。固定来源、字重及覆盖见 [原字体审计](typography-preview/coverage.json)。
- MiSans 使用小米官方预生成 WOFF2 原件，未转换或子集化。官方 [协议](https://hyperos.mi.com/font/zh/download/) 和 [FAQ](https://hyperos.mi.com/font/zh/faq/) 允许注明后嵌入软件，不允许改编和单独再分发。本软件使用 MiSans 字体，使用指引中也保留此说明。112 个文件的 [来源与 SHA-256](typography-preview/MiSans-provenance.json) 已复核。
- 许可原文随资源保留于 [licenses](../../public/optical/type/licenses/)。字体作为应用资源提供，不做独立字体下载产品。

## 加载与覆盖

Next 和 Pages 均加载 `faces.css`、`role-faces.css`、`ibm-plex-sc/faces.css`，同源托管，采用 `font-display: swap` 与 Unicode 按需分片。字体完成加载后重新测量图谱标签。

故障字体常用字符优先加载；其余字符拆分为每片至多 4096 码点，避免单文件超过 Pages 限制。新旧字符集合一致，最大字体文件 4,423,000 bytes。当前 61 个节点、94 条关系标题的 334 个非空白字符均被统方体和 IBM Plex 覆盖。统方体总覆盖 29,511 字符，IBM Plex SC Regular 覆盖 29,285 字符；不声称覆盖完整 Unicode，缺字仍按角色回退。见 [当前覆盖检查](font-verification.json)。

更换月萤宋前的无缓存浏览器检查包含首屏和生态视角；1440px 流程还打开知识阅读。累计字体传输约 3.84–4.47 MB，详见 [请求统计](browser-verification.json)。这是字体文件原始字节累计，不是首屏耗时或公网性能保证。完整字体库较大，但浏览器不会一次下载全部分片；后续可在保持任意用户标题覆盖的前提下继续优化常用字符分片。

## 页面验证

[桌面 1440px](screenshots/next-1440.png) · [1024px](screenshots/next-1024.png) · [390px](screenshots/next-390.png) · [320px](screenshots/next-320.png) · [知识阅读](screenshots/reading-3734.png)

普通节点使用乐米月萤宋，选中标签的统方体与探索控件形成呼应；故障宋只用于展示层。点阵和故障字体的风格较强，这是已确认的视觉选择。低分辨率屏幕上的细小点阵文字、字体加载时的短暂回退，仍需真实设备验收。
