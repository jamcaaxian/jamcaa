# Jamcaa 文档站与国际化基准研究

## 1. 目的、边界与证据等级

本文为 Jamcaa 文档站重构提供一份可直接转化为信息架构、视觉规范与国际化验收标准的研究基线。研究对象包括 Astro 官方网站与文档、React 官方文档、Apple Human Interface Guidelines 与 Design Resources、IETF BCP 47、WHATWG HTML、MDN，以及 Google Search Central 的国际化搜索实现指南。

本文区分三类信息：

- **规范事实**：由 RFC、WHATWG HTML 等规范定义，实施时不得用产品偏好替代。
- **官方观察**：来自 Astro、React、Apple 等第一方产品和设计文档，用于建立行业基准。
- **Jamcaa 建议**：结合 Jamcaa 当前文档站、现有架构决策和维护成本得出的产品选择，不声称为外部规范。

本文不引入任何依赖。内容身份现遵循 [ADR-0029](../adr/0029-content-variants-are-separate-localized-identities.md)：每个 Locale 版本是独立 Entry 或 Page，并通过 Translation Set 关联；该 ADR 已取代 [ADR-0009](../adr/0009-ui-only-localization.md)。本文同时记录文档站 URL、页面语言、翻译关系与体验验收基线。

## 2. 执行摘要

| 主题         | Jamcaa 建议                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档信息架构 | 采用 Astro 的“首页分层导流”与 React 的“Learn / Reference 分工”：全局导航下明确分为 **Docs/Guides、Tutorials/Learn、Reference**，不要把教程、概念解释和 API 清单混成一棵目录。Astro 的入口组织见 [Getting Started](https://docs.astro.build/en/getting-started/) 与 [Tutorial](https://docs.astro.build/en/tutorial/0-introduction/)，React 的分工见 [Learn](https://react.dev/learn) 与 [API Reference](https://react.dev/reference/react)。                                                                                                                                                                                                       |
| 页面外壳     | 桌面端采用“顶部全局导航 + 左侧章节导航 + 中央正文 + 右侧页内目录”，移动端把两侧导航收进抽屉或弹层；长文末尾必须有 Previous/Next 与页面操作。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 首页         | 用一句价值主张、三个至五个能力支柱、可信证据、主要入口和一个明确的 Get Started 行动构成；避免把首页做成文章流。Astro 首页采用清晰定位、能力证明和开始入口，[Astro 官方首页](https://astro.build/) 可作为基准。                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 教学内容     | 教程必须以可完成的项目或任务为主线，章节开头说明学习结果，正文提供可复制示例，末尾给出完成检查与下一步。React 的章节式教学见 [Learn](https://react.dev/learn)、[Tic-Tac-Toe Tutorial](https://react.dev/learn/tutorial-tic-tac-toe)；Astro 的单项目教程见 [Build your first Astro Blog](https://docs.astro.build/en/tutorial/0-introduction/)。                                                                                                                                                                                                                                                                                                    |
| Reference    | 每个 API/配置项固定采用“摘要 → 签名或类型 → 参数 → 返回值 → 注意事项 → 用法 → 故障排除”的顺序，并提供稳定锚点。React 的完整范例见 [`useState` reference](https://react.dev/reference/react/useState)，Astro 的分类参考见 [Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/)、[API Reference](https://docs.astro.build/en/reference/api-reference/)、[Template Directives Reference](https://docs.astro.build/en/reference/directives-reference/) 与 [Error Reference](https://docs.astro.build/en/reference/error-reference/)。                                                                             |
| 搜索         | 搜索属于全局文档外壳，而不是某个栏目；结果按当前语言优先，并显示栏目、标题、摘要和面包屑。首版可以复用现有搜索能力，不需要为“交互式文档搜索”引入新依赖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Apple 风格   | 使用语义色令牌和克制的强调色；透明材料只承担导航、工具栏、浮层等功能层级，不铺在阅读正文后；排版优先系统字体、清晰层级与文本缩放；动效必须短、可中断，并尊重减少动态效果偏好。官方依据分别见 Apple 的 [Color](https://developer.apple.com/design/human-interface-guidelines/color)、[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)、[Typography](https://developer.apple.com/design/human-interface-guidelines/typography)、[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) 与 [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)。 |
| 平台语言标识 | 正式 locale ID 固定为 `zh-Hans-CN` 与 `en-US`；HTML `lang`、`hreflang`、配置和日志均使用这一规范大小写。两者均是 RFC 5646 明示的有效示例，见 [RFC 5646 Appendix A](https://www.rfc-editor.org/rfc/rfc5646.html#appendix-A)。                                                                                                                                                                                                                                                                                                                                                                                                                       |
| URL 语言段   | URL 使用唯一的小写键 `zh-hans-cn` 与 `en-us`，例如 `/zh-hans-cn/docs/...`、`/en-us/docs/...`；URL 键与 locale ID 分开存储。BCP 47 的比较不区分大小写，但 URL 的唯一写法属于 Jamcaa 自己的去重策略，依据见 [RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)。                                                                                                                                                                                                                                                                                                                                                                                |
| 默认入口     | 两种语言都使用显式前缀；根路径 `/` 作为语言选择与 `x-default` 入口。可以根据已保存的用户选择跳转，但不得因浏览器语言偏好把用户从一个明确的本地化 URL 强制赶走。Google 对 `x-default` 的用途说明见 [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions#xdefault)。                                                                                                                                                                                                                                                                                                                            |
| Canonical    | 每个实际页面使用绝对、自引用、同语言的 canonical；中文翻译不能 canonical 到英文原页。WHATWG 定义 canonical 为当前文档的首选 URL，见 [link type canonical](https://html.spec.whatwg.org/multipage/links.html#link-type-canonical)；Google 的实施建议见 [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)。                                                                                                                                                                                                                                                                                 |
| `hreflang`   | 只列出真实存在且内容等价的版本；每页包含自身与全部等价版本，关系必须互相回链，并使用绝对 URL。Google 的要求见 [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)。                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 缺失翻译     | 不得在中文 URL 下直接重写出英文正文。首选返回本地化的“该翻译尚不可用”页面和英文原文链接；如果选择跳转，必须跳到真实英文 URL，让 canonical 与 HTML `lang` 保持诚实。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## 3. 文档站信息架构基准

### 3.1 Astro：发现路径与完整参考

**官方观察**

1. Astro 首页先说明产品适用对象与核心价值，再用能力、生态和开始入口建立信任，而不是把站点首页等同于文档目录。[Astro 官方首页](https://astro.build/)
2. Astro 的 Getting Started 把安装、编辑器设置、项目结构、教程、指南与参考分成不同入口，使首次访问者不必先理解整棵导航树。[Astro Getting Started](https://docs.astro.build/en/getting-started/)
3. Astro 教程围绕完成一个博客展开，按单元推进并持续显示学习进度，适合建立从零到成品的连续路径。[Astro Tutorial](https://docs.astro.build/en/tutorial/0-introduction/)
4. Astro 把配置、运行时 API、模板指令和错误分别维护成不同参考域，避免一份超长 API 页承担所有检索任务。[Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/)、[API Reference](https://docs.astro.build/en/reference/api-reference/)、[Template Directives Reference](https://docs.astro.build/en/reference/directives-reference/)、[Error Reference](https://docs.astro.build/en/reference/error-reference/)
5. Astro 原生 i18n 配置把受支持 locale、默认 locale、默认前缀、根路径重定向和缺失路由 fallback 作为明确选项，而不是散落在页面组件中。[Astro Internationalization Guide](https://docs.astro.build/en/guides/internationalization/)、[i18n Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/#i18n)

**可迁移结论**

- 首页负责定位和分流，Docs 首页负责选择学习路径，具体章节负责传授内容。
- Reference 必须按使用者查找问题的方式分区，而不是完全照源码目录排列。
- 导航、搜索、语言、主题、版本和社区链接属于全局外壳。
- i18n 的 locale 清单、URL 规则、fallback 与页面元数据应由一个中心契约生成，不能由每页自由拼接。

### 3.2 React：教学层与 API 层分工

**官方观察**

1. React 将 Learn 与 Reference 明确拆开：Learn 按概念和任务组织，Reference 按 API 组织。[React Learn](https://react.dev/learn)、[React API Reference](https://react.dev/reference/react)
2. Learn 章节通常在开头列出将学到的内容，并用 Note、Pitfall、Deep Dive、练习和可运行示例形成多层解释。[Describing the UI](https://react.dev/learn/describing-the-ui)、[Adding Interactivity](https://react.dev/learn/adding-interactivity)
3. React 教程先处理开发环境和目标，再通过连续步骤完成可运行成品，最后给出进一步挑战。[Tic-Tac-Toe Tutorial](https://react.dev/learn/tutorial-tic-tac-toe)
4. API 页不是只有签名；`useState` 页面同时提供参数、返回值、注意事项、常见用法、更新对象/数组的配方和故障排除。[`useState` reference](https://react.dev/reference/react/useState)

**可迁移结论**

- 用户“第一次理解”与“回来查一个精确答案”是两种任务，必须有不同页面形态。
- 教学块应成为可复用内容原语：Learning outcomes、Note、Pitfall、Deep Dive、Exercise、Solution、Troubleshooting。
- 代码示例首要要求是可复制、可理解和可定位；交互式沙盒属于后续增强，不应为了模仿 React 而立即引入依赖。

### 3.3 建议的一级栏目

| 栏目      | 用户问题                                 | 内容边界                                                               |
| --------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Home      | “Jamcaa 是什么，为什么值得使用？”        | 产品定位、核心能力、可信证据、快速入口、生态与版本状态。               |
| Docs      | “我要完成某项工作，应该怎么做？”         | 安装、配置、部署、内容建模、认证、存储、搜索、主题、插件等任务型指南。 |
| Tutorials | “我能否跟着一步步做出一个完整站点？”     | 有起点、目标、连续步骤、检查点和最终成品的项目式课程。                 |
| Reference | “这个 API、配置、类型或错误到底是什么？” | 完整、稳定、可深链的技术契约；不承担长篇概念教学。                     |
| Search    | “我知道关键词，但不知道它在哪个栏目？”   | 全站检索；默认限定当前语言，结果显示所属栏目与路径。                   |

`Guides` 可以作为 Docs 内的页面类型，不必再增加一个一级导航项。`Concepts` 可以在 Docs 中形成明确分组；只有内容规模足够大时才升级为一级栏目。

## 4. 页面能力矩阵

| 能力             | 基准事实                                                                                                                                                                                                 | Jamcaa 验收标准                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 全局 Header      | Astro 和 React 的文档入口持续提供品牌、主要栏目与全局工具；参考 [Astro Docs](https://docs.astro.build/en/getting-started/) 与 [React Learn](https://react.dev/learn)。                                   | 任意文档页都能一跳到 Home、Docs、Tutorials、Reference、Search、语言切换、主题切换和仓库入口。当前栏目具有文本之外的可辨认状态。                                    |
| 首页 Hero        | Astro 首页用简洁定位与 Get Started 形成首要行动。[Astro](https://astro.build/)                                                                                                                           | 首屏只有一个主标题、一段说明、一个主要行动和最多一个次要行动；不把发布文章列表放在价值主张之前。                                                                   |
| Docs Landing     | Astro Getting Started 为不同任务提供入口。[Getting Started](https://docs.astro.build/en/getting-started/)                                                                                                | 展示“新用户”“站点作者”“平台扩展者”“部署维护者”等路径，每条路径说明先决条件和预计结果。                                                                             |
| 左侧导航         | Astro 的指南/参考与 React Learn 均按章节层级组织页面；参考 [Astro Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/) 与 [React Learn](https://react.dev/learn)。   | 显示当前页、父分组和相邻页面；分组可折叠但不能隐藏当前位置；键盘可操作；移动端进入抽屉。                                                                           |
| 面包屑           | 多层文档需要同时表达栏目与页面位置。该项是 Jamcaa 的导航建议。                                                                                                                                           | 除 Home 外的内容页显示可点击面包屑；结构与 URL、左侧导航一致。                                                                                                     |
| 右侧 TOC         | React 长文提供页内目录，API 页有稳定的小节结构；参考 [`useState`](https://react.dev/reference/react/useState)。                                                                                          | 桌面端固定显示二、三级标题；滚动时标出当前小节；移动端折叠；标题锚点可复制并在聚焦时不被固定 Header 遮挡。                                                         |
| Search           | Astro 与 React 均把搜索放在文档全局外壳；参考 [Astro Docs](https://docs.astro.build/en/getting-started/) 与 [React Reference](https://react.dev/reference/react)。                                       | 支持键盘打开、输入即反馈、方向键浏览、Esc 关闭；结果包含语言、栏目、标题、摘要和面包屑；空结果提供改写建议。                                                       |
| 教学结果         | React Learn 章节显式说明学习目标；Astro Tutorial 按项目进度推进。[React Learn](https://react.dev/learn)、[Astro Tutorial](https://docs.astro.build/en/tutorial/0-introduction/)                          | 每个教程单元开头列出 2–5 个可验证结果，末尾列出完成检查、下一单元和完整代码状态。                                                                                  |
| 代码示例         | React 的教学与 Reference 将示例放在概念或 API 附近；参考 [Adding Interactivity](https://react.dev/learn/adding-interactivity) 与 [`useState`](https://react.dev/reference/react/useState)。              | 示例显示语言、文件名、复制按钮和必要上下文；错误示例必须说明为什么错；长代码使用局部滚动而非撑破页面。                                                             |
| Reference 元数据 | Astro 配置参考标明类型、默认值和版本等信息；参考 [Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/)。                                                             | API/配置项顶部统一显示所属包、稳定性、签名或类型、默认值、引入版本和相关项；所有项有永久锚点。                                                                     |
| Previous/Next    | Astro 教程和参考提供顺序导航；参考 [Astro Tutorial](https://docs.astro.build/en/tutorial/0-introduction/) 与 [Configuration Reference](https://docs.astro.build/en/reference/configuration-reference/)。 | 顺序型内容末尾显示上一页/下一页标题和所属分组；Reference 索引页可省略。                                                                                            |
| 页面操作         | Astro 文档页提供编辑/翻译等贡献入口；参考 [Astro Docs](https://docs.astro.build/en/getting-started/)。                                                                                                   | 内容末尾提供“编辑此页”“报告问题”“翻译此页”；链接携带页面身份，不能只指向仓库首页。                                                                                 |
| Footer           | 官方文档站通常在全局页尾承担社区、法律和项目状态链接；此项为 Jamcaa 产品建议。                                                                                                                           | 包含版本、许可证、贡献、行为准则、安全、状态与社区入口；不重复整棵文档导航。                                                                                       |
| 响应式           | Apple 要求界面适应不同设备、输入方式与辅助需求，见 [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)。                                                        | 在 320、375、390、768 CSS px 与桌面宽度下无视口级横向滚动；表格、代码和导航有明确小屏方案，并继续遵守 [ADR-0021](../adr/0021-sites-are-responsive-by-default.md)。 |

## 5. 建议的页面模板

### 5.1 Home

1. **Hero**：一句产品定位、一个主要行动、一个次要行动。
2. **Capability pillars**：最多五项，用结果而不是内部模块名表达。
3. **Proof**：部署目标、开放协议、运行时、测试或真实站点等可验证证据。
4. **Choose your path**：第一次安装、内容建模、扩展平台、部署上线。
5. **Featured guide / release**：只放一个当前最重要入口，不做新闻瀑布流。
6. **Community and project status**：仓库、贡献、版本与许可证。

### 5.2 Docs / Guide

- 标题下先回答“何时使用本指南”和“完成后得到什么”。
- 前置条件、步骤、验证和故障排除分开书写。
- 任何命令都说明运行目录、预期结果与失败入口。
- 结尾链接到相关概念、Reference 和下一项任务。

### 5.3 Tutorial unit

- 单元目标和先决状态。
- 本单元最终可观察结果。
- 小步操作，每一步都有即时验证。
- 常见偏差或 Pitfall。
- 完成检查、最终代码状态、下一单元。

### 5.4 Reference item

1. 一句话摘要。
2. 签名、类型或配置形状。
3. 参数/属性。
4. 返回值或副作用。
5. 默认值和稳定性。
6. Caveats。
7. 常见用法与反例。
8. Troubleshooting。
9. Related APIs。

### 5.5 Search results

- 输入框始终保留查询词。
- 默认只展示当前 locale 的内容；允许显式切换“全部语言”。
- 每条结果显示栏目、标题、摘要和路径，不仅显示标题。
- 跨语言结果必须显示语言徽标，避免用户误入另一语言。
- 空结果提供拼写、同义词和栏目入口，而不是只有“无结果”。

## 6. Apple 风格在文档站中的落地

### 6.1 色彩

**官方事实**

- Apple 建议使用能随环境和外观变化的语义颜色，并在浅色、深色和更高对比度环境中检查结果。[Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- 颜色不应成为传达状态或含义的唯一方式；辅助形状、文字和图标仍需可辨认。[Apple HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)、[Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Apple 的无障碍指导引用了文本对比度基准：常规小文本至少 4.5:1，较大或较粗文本至少 3:1。[Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

**Jamcaa 建议**

- 继续以运行时语义令牌表达背景、前景、边框、强调、成功、警告和危险，不允许页面直接硬编码品牌色；与 [ADR-0016](../adr/0016-the-theme-adjusts-a-configured-accent.md) 一致。
- Accent 只服务主要行动、当前导航、链接和关键状态，不给大面积阅读背景上色。
- 当前导航、错误和成功状态同时使用文字、图标或结构变化；不使用“只有红/绿不同”的反馈。
- 代码高亮、图表和示例截图都要单独检查浅色、深色和高对比度表现。

### 6.2 材料与层级

**官方事实**

- Apple 将材料视为建立层级和区分功能层的手段，透明或玻璃效果必须保证上层内容清晰，材料厚度应适应背景复杂度与可读性需求。[Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)

**Jamcaa 建议**

- 玻璃/半透明只用于 Header、侧栏、搜索面板、Popover、移动导航和浮动工具条。
- 正文、代码、表格和长表单使用稳定的实色阅读面；不要让滚动文字长期透过正文背景。
- 忙碌背景上优先加实、加边界或取消透明，而不是继续提高模糊半径。
- 层级首先靠布局、间距和排版建立；阴影和透明只是辅助。

### 6.3 排版

**官方事实**

- Apple 要求优先保证可读性，避免在小字号使用过轻字重，并用字号、字重、颜色和行距建立层级。[Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- Apple 建议控制字体数量，并在合适场景使用系统字体；Apple 的系统可变字体支持适应字号的 optical sizing。[Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)、[Apple Design Resources](https://developer.apple.com/design/resources/)
- 界面应支持文本放大和内容重排，不应因文字变大而截断关键信息。[Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

**Jamcaa 建议**

- 正文使用系统字体栈；代码使用系统等宽字体栈，不为品牌感牺牲中文字符覆盖和加载速度。
- Display、H1、H2、正文、说明文字与代码只建立少量稳定层级；不用过多相近字号制造噪声。
- 大标题收紧行距和字距，正文保持舒适行距；中文段落避免过窄行宽和过紧行距。
- 使用 `rem`/`em` 驱动字号和关键间距；浏览器文本缩放至 200% 时，导航、TOC、表格和代码操作仍可用。

### 6.4 无障碍

**官方事实**

- Apple 建议让内容可被辅助技术理解、支持键盘与不同输入方式、提供足够大的交互目标，并让用户能放大文本。[Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

**Jamcaa 建议**

- 每页提供跳过导航链接、唯一 H1、语义 landmarks、可见焦点和正确标题层级。
- 搜索、目录、折叠分组、代码复制、主题和语言切换均可完全用键盘操作。
- 粗指针环境的主要交互目标约为 44×44 CSS px；视觉图标可以更小，但命中区域不能随之缩小。
- 图标按钮必须有可访问名称；不能把 tooltip 当作唯一名称。
- 所有重要截图提供替代文本，复杂图示在正文给出等价说明。

### 6.5 动效

**官方事实**

- Apple 要求动效服务于反馈、空间关系和理解，并允许用户保持控制；应尊重“减少动态效果”偏好，以更温和的过渡替代大幅移动、弹跳、深度变化或动态模糊。[Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion)、[Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Web 可通过 `prefers-reduced-motion` 媒体特性响应减少动态效果偏好。[MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

**Jamcaa 建议**

- 高频阅读操作接近零动画：目录定位、代码复制、筛选和分页优先即时反馈。
- 搜索面板、移动导航和 Popover 可使用短促淡入与轻微位移；起点必须与触发控件保持空间关系。
- 任何关闭中的面板都可立即重新打开，不因动画锁住输入。
- `prefers-reduced-motion: reduce` 下取消弹跳、视差和大范围位移，保留短淡化或直接切换。
- 不使用循环装饰动画、全屏移动背景或只为“高级感”存在的滚动特效。

## 7. BCP 47 规范基线

### 7.1 标签结构与有效性

**规范事实**

- RFC 5646 的常规标签顺序为 `language[-script][-region][-variant...][-extension...][-privateuse]`，子标签使用 ASCII 连字符 `-` 分隔。[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)
- 比较语言标签时不区分大小写；推荐展示形式是语言小写、文字系统首字母大写、字母地区大写，例如 `zh-Hans-CN`、`en-US`。[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)
- “语法良好”不等于“注册有效”；子标签的有效性、弃用和 `Preferred-Value` 来自 IANA Language Subtag Registry。[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)、[IANA Language Subtag Registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry)
- 规范化需要用注册表的首选值替换已弃用或 grandfathered 形式，并对比较双方采取一致策略。[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)、[RFC 4647 §3.2](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.2)
- 标签应精确到能区分实际内容，但不要加入没有区分价值的子标签。[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)、[RFC 4647 §4.1](https://www.rfc-editor.org/rfc/rfc4647.html#section-4.1)

“完整语言标签”因此不是“尽可能塞入所有子标签”，而是“使用规范、有效且足以描述实际语言内容的完整身份”。例如 IANA 的 `en` 记录把 `Latn` 列为 `Suppress-Script`，所以 `en-Latn-US` 没有必要；`en-US` 已足够表达美国英语。[IANA Language Subtag Registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry)、[RFC 4647 §4.1](https://www.rfc-editor.org/rfc/rfc4647.html#section-4.1)

### 7.2 Jamcaa 的两个正式 locale

| 字段                | 简体中文                                                           | 美国英语                                                                  |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Canonical locale ID | `zh-Hans-CN`                                                       | `en-US`                                                                   |
| URL key             | `zh-hans-cn`                                                       | `en-us`                                                                   |
| HTML `lang`         | `zh-Hans-CN`                                                       | `en-US`                                                                   |
| HTML `hreflang`     | `zh-Hans-CN`                                                       | `en-US`                                                                   |
| 含义                | Chinese + Simplified Han + China                                   | English + United States                                                   |
| IANA 记录           | `zh` 为 Chinese，`Hans` 为 Han (Simplified variant)，`CN` 为 China | `en` 为 English，`US` 为 United States；`Latn` 是 `en` 的 Suppress-Script |

RFC 5646 Appendix A 直接列出 `zh-Hans-CN`（Chinese, Simplified script, mainland China）和 `en-US`（English as used in the United States）作为示例。[RFC 5646 Appendix A](https://www.rfc-editor.org/rfc/rfc5646.html#appendix-A) 相关子标签的注册状态见 [IANA Language Subtag Registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry)。

**Jamcaa 决定建议**

1. 内部正式身份只使用 `zh-Hans-CN` 与 `en-US`；不得把 `zh`、`zh-CN`、`en` 当成第三、第四个 locale。
2. 元数据和配置使用规范大小写；URL 使用固定小写键，二者通过显式表映射。
3. 比较输入时不区分大小写；输出时永远回到正式 ID 或固定 URL key。
4. 接受边界可以兼容用户输入的下划线形式，例如 `zh_Hans_CN`，但必须先转为连字符并验证，不能原样存储或输出。
5. `en-US` 采用美国英语拼写、标点与术语；`zh-Hans-CN` 采用中国大陆简体中文习惯。不同 locale 的风格指南应独立维护。

### 7.3 规范化管线

建议所有入口共用以下顺序：

1. **读取**：接收 URL key、用户设置、请求头或内容元数据。
2. **清理边界格式**：去除首尾空白；只在兼容入口将 `_` 转为 `-`。
3. **语法验证**：不接受空子标签、非法字符或错误顺序。
4. **注册表规范化**：应用 IANA `Preferred-Value`，并统一语言/文字/地区的推荐大小写。[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)
5. **产品别名映射**：把允许的范围映射到 Jamcaa 支持的两个正式 locale；该层是产品策略，不是 BCP 47 自动推断。
6. **输出**：页面语言元数据输出 canonical locale ID；路由输出固定 URL key。

## 8. 语言匹配与 fallback

### 8.1 RFC 4647 能做什么

**规范事实**

- RFC 4647 定义 Filtering 与 Lookup：Filtering 返回零个或多个匹配标签，Lookup 返回一个最佳标签或应用定义的默认值。[RFC 4647 §3](https://www.rfc-editor.org/rfc/rfc4647.html#section-3)
- 匹配必须不区分大小写；语言优先列表按优先级或权重依次处理。[RFC 4647 §2.3](https://www.rfc-editor.org/rfc/rfc4647.html#section-2.3)
- Basic Filtering 允许较短范围匹配以该范围和连字符开头的更长标签，例如 `de-DE` 可匹配 `de-DE-1996`。[RFC 4647 §3.3.1](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.3.1)
- Lookup 的方向不同：它从请求的最具体范围逐步移除右侧子标签，寻找当前范围的匹配；RFC 示例说明 `de-CH` 可以得到 `de-CH` 或 `de`，但不会得到更具体的 `de-CH-1996`。[RFC 4647 §3.4](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.4)
- 所有请求范围都失败后，应用必须定义 no-match 行为；默认值只能在整个优先列表处理完后计算。[RFC 4647 §3.4.1](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.4.1)
- RFC 4647 明确允许应用提供预处理或配置映射，并以 `zh-Hans` 与 `zh-CN` 的关联为例；这种映射必须被记录清楚。[RFC 4647 §3.2](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.2)

这意味着：当可用标签只有 `en-US` 时，纯 Lookup 的范围 `en` 不会自动向上扩展到 `en-US`；当可用标签只有 `zh-Hans-CN` 时，`zh-Hans` 和 `zh-CN` 也需要 Jamcaa 的显式映射。BCP 47 规定标签与匹配机械规则，但不会替 Jamcaa 决定文化上合适的翻译 fallback。[RFC 4647 §3.2](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.2)、[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html)

### 8.2 Jamcaa 的支持范围映射

| 请求范围                             | 结果                                           | 理由                                                                                                   |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `zh-Hans-CN`                         | `zh-Hans-CN`                                   | 精确支持。                                                                                             |
| `zh-Hans`                            | `zh-Hans-CN`                                   | 显式产品映射：支持的简体中文地区版本只有中国大陆。                                                     |
| `zh-CN`                              | `zh-Hans-CN`                                   | 显式产品映射：为中国地区请求补全 Jamcaa 的简体文字系统身份。                                           |
| `zh`                                 | `zh-Hans-CN`                                   | 仅当请求者明确给出通用 `zh` 范围时使用；这是“唯一受支持中文 locale”的产品 fallback。                   |
| `zh-Hant`、`zh-TW`、`zh-HK`、`zh-MO` | 不映射到简体中文                               | 文字系统或地区明确指向繁体中文语境，自动切到简体会错误表达偏好。转到语言选择页或继续处理下一优先范围。 |
| `en-US`                              | `en-US`                                        | 精确支持。                                                                                             |
| `en`                                 | `en-US`                                        | 显式产品映射：唯一受支持的英语 locale。                                                                |
| 其他 `en-*`                          | `en-US`                                        | 可作为文档站的英语家族 fallback，但必须先让更高优先级的其他请求范围完成匹配。                          |
| `*`、未知或无请求                    | `/` 语言选择页；必须选一个界面文案时用 `en-US` | 选择页保留用户控制；`en-US` 是当前文档内容和开放源码受众下的最终 UI 默认值。                           |

映射必须作用于“语言选择”，不能改写内容自身的语言标签。例如英文页面仍是 `en-US`，不能因为它由一个 `en-GB` 请求选中就输出 `lang="en-GB"`。

### 8.3 建议的协商顺序

1. 明确 URL locale：最高优先级，直接使用，绝不根据浏览器偏好改写。
2. 用户主动保存的 locale：仅用于访问 `/` 或无 locale 的内部入口。
3. `Accept-Language` 优先列表：按权重处理每个范围，先精确匹配，再应用上表的明确映射。
4. 没有支持项：保留在 `/` 语言选择页；必须返回单一 UI 文案时使用 `en-US`。

`Accept-Language` 可能暴露独特偏好组合，RFC 4647 提醒这类范围可被用于识别或跟踪用户；Jamcaa 不应为了普通语言选择长期保存完整原始请求头。[RFC 4647 §5](https://www.rfc-editor.org/rfc/rfc4647.html#section-5)

### 8.4 测试矩阵

| 输入                                             | 预期                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| 显式 `/zh-hans-cn/docs/...` + 浏览器偏好 `en-US` | 留在中文 URL，不自动跳走。                                          |
| 显式 `/en-us/docs/...` + 浏览器偏好 `zh-CN`      | 留在英文 URL，不自动跳走。                                          |
| `/` + 已保存 `zh-Hans-CN`                        | 可跳转到 `/zh-hans-cn/`。                                           |
| `/` + `Accept-Language: zh-CN, en-US;q=0.8`      | 如果启用自动协商，选择 `zh-Hans-CN`；否则在选择页优先显示中文选项。 |
| `/` + `Accept-Language: zh-Hant`                 | 不跳到简体中文；显示语言选择页。                                    |
| `/` + `Accept-Language: en-GB, en;q=0.8`         | 如果启用自动协商，通过显式英语家族 fallback 选择 `en-US`。          |
| `/` + `Accept-Language: fr-FR`                   | 显示语言选择页；必须选择单一 UI 时使用 `en-US`。                    |
| URL `/ZH-Hans-CN/...` 或 `/zh-Hans-cn/...`       | 重定向到唯一小写 URL `/zh-hans-cn/...`。                            |

## 9. URL、`canonical`、`hreflang` 与 HTML `lang`

### 9.1 URL 契约

**Jamcaa 建议**

```text
/
/zh-hans-cn/
/zh-hans-cn/docs/...
/zh-hans-cn/tutorials/...
/zh-hans-cn/reference/...
/en-us/
/en-us/docs/...
/en-us/tutorials/...
/en-us/reference/...
```

- 两个 locale 都带前缀，避免默认语言页面同时存在有前缀与无前缀两个身份。
- locale 段只接受固定小写 URL key；其他大小写和已声明别名重定向到唯一形式。
- 首版在两个语言版本中使用相同的稳定 ASCII 页面 slug，简化翻译关系、链接检查与迁移。
- 页面翻译关系必须由稳定页面身份维护，而不是仅靠替换 URL 字符串；这样以后允许本地化 slug 时仍能生成正确 alternate 集合。
- `/` 是语言选择与 `x-default` 入口。最稳妥的基线是返回可索引的语言选择页；如果按已保存选择或请求头跳转，应使用非永久跳转，并且只发生在无 locale 入口。

Astro 的官方 i18n 路由同样把 locale、默认 locale、默认前缀和根路径重定向作为中心配置；这支持“由一个路由契约生成所有页面行为”的方向，但 Jamcaa 不需要因此采用 Astro 或新增依赖。[Astro Internationalization Guide](https://docs.astro.build/en/guides/internationalization/)、[Astro i18n Recipe](https://docs.astro.build/en/recipes/i18n/)

### 9.2 HTML `lang`

**规范事实**

- HTML `lang` 声明元素内容及其文本属性的主要语言，值必须是有效 BCP 47 标签或空字符串；空字符串表示语言未知。[WHATWG: The `lang` attribute](https://html.spec.whatwg.org/multipage/dom.html#attr-lang)、[MDN: `lang`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang)
- 未设置 `lang` 的元素通常继承父元素语言，因此文档根元素应明确声明实际页面语言；外语片段可以在局部覆盖。[WHATWG: The `lang` attribute](https://html.spec.whatwg.org/multipage/dom.html#attr-lang)
- 用户代理可以用语言信息选择发音、字体、字典和控件文案；正确声明页面及片段语言对辅助技术发音尤其重要。[MDN: `lang`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang)

**Jamcaa 规则**

- 中文正文页使用 `<html lang="zh-Hans-CN">`；英文正文页使用 `<html lang="en-US">`。
- `lang` 描述实际输出内容，不描述用户请求、URL 参数或理想翻译。
- 页面中的整段外语内容在容器上声明自己的 `lang`；品牌名、短代码标识或单个技术词通常无需逐个标记。
- 根语言选择页不得使用 `lang="x-default"`；它应选择页面实际主要文案语言，例如 `en-US`，并给中文选项局部标记 `lang="zh-Hans-CN"`。

### 9.3 `hreflang` 与 alternate

**规范事实**

- HTML `hreflang` 是对链接目标资源语言的提示，使用 BCP 47 标签；它是 advisory，目标资源自身的语言声明仍是权威。[WHATWG: `hreflang`](https://html.spec.whatwg.org/multipage/links.html#attr-hyperlink-hreflang)、[MDN: `<link>` `hreflang`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#hreflang)、[MDN: `<a>` `hreflang`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#hreflang)
- `rel="alternate"` 配合不同 `hreflang` 表达当前文档的翻译版本。[WHATWG: link type alternate](https://html.spec.whatwg.org/multipage/links.html#link-type-alternate)
- Google 要求每个本地化页面列出自身及所有真实等价版本，并要求这些版本互相回链；URL 应为完整绝对 URL。[Google: Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- Google 把 HTML `<head>`、HTTP header 和 sitemap 视为等价的 `hreflang` 实现方式，同时实现多种方式不会带来额外排名收益，反而增加维护风险。[Google: Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- Google 的 `x-default` 表示未匹配语言的默认或语言选择入口；它不描述页面的实际内容语言，不能成为 Jamcaa locale ID 或 HTML `lang`。[Google: `x-default`](https://developers.google.com/search/docs/specialty/international/localized-versions#xdefault)

**Jamcaa 规则**

- 首版只在 HTML `<head>` 生成 alternate，不同时维护 sitemap/HTTP header 版本。
- 仅当对应语言页面真实存在且主体内容等价时发出 alternate。
- 每个 alternate 集合都包含当前页自身。
- 中文页和英文页必须输出同一组 URL，形成双向关系。
- `hreflang` 使用 `zh-Hans-CN` 与 `en-US`，URL 使用各自小写 URL key。
- 所有存在本地化集群的页面额外指向 `/` 的 `x-default`。

### 9.4 Canonical

**规范事实**

- WHATWG 将 `rel="canonical"` 定义为当前文档的首选 URL，用于表达多个 URL 中的规范地址。[WHATWG: link type canonical](https://html.spec.whatwg.org/multipage/links.html#link-type-canonical)
- Google 建议使用绝对 canonical URL、在有效 `<head>` 中声明、自引用，并让 canonical 与重定向、sitemap、内部链接和 `hreflang` 保持一致。[Google: Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- 对本地化页面，canonical 通常应与页面使用相同语言；真实翻译不应全部 canonical 到一个其他语言页面。[Google: Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- `canonical` 与 `alternate hreflang` 承担不同职责，应使用独立 `<link>` 元素。[Google: Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

**Jamcaa 规则**

- 每个页面 self-canonical 到当前 locale 的唯一小写绝对 URL。
- canonical 不包含查询参数或片段，除非未来某项页面身份规范明确要求。
- 中文翻译 canonical 到中文 URL，英文原文 canonical 到英文 URL。
- 大小写、尾斜杠或历史路径的重定向目标必须与 canonical 一致。
- 内部导航和搜索结果只生成规范 URL，不依赖 canonical 修补内部重复链接。

### 9.5 完整元数据示例

以下域名和路径仅用于说明契约：

```html
<html lang="zh-Hans-CN">
    <head>
        <link rel="canonical" href="https://docs.example.com/zh-hans-cn/docs/content-model/" />
        <link rel="alternate" hreflang="zh-Hans-CN" href="https://docs.example.com/zh-hans-cn/docs/content-model/" />
        <link rel="alternate" hreflang="en-US" href="https://docs.example.com/en-us/docs/content-model/" />
        <link rel="alternate" hreflang="x-default" href="https://docs.example.com/" />
    </head>
</html>
```

如果英文等价页不存在，则删除 `en-US` alternate；不能指向英文栏目首页、机器翻译占位页或一篇“差不多相关”的文章。

Astro 的 `site` 配置用于生成 sitemap 和 canonical origin，且可通过 `Astro.site` 构造绝对 canonical URL；这是“部署 origin 必须集中配置”的可迁移原则。[Astro `site` configuration](https://docs.astro.build/en/reference/configuration-reference/#site)

## 10. 缺失翻译与内容 fallback

### 10.1 必须区分三种 fallback

| 层级       | 允许的 fallback                                                                        | 禁止行为                                                   |
| ---------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 界面文案   | 非关键文案可以 `zh-Hans-CN → en-US`；关键导航、错误、表单与可访问名称应有完整翻译。    | 让英文 fallback 字符串在中文页面中大量出现而没有语言标记。 |
| 页面路由   | 中文页面不存在时返回中文“翻译尚不可用”页面，并链接真实英文 URL；也可明确跳到英文 URL。 | 在中文 URL 下渲染完整英文正文。                            |
| 搜索与推荐 | 默认只搜索当前语言；可提供显式“包含英文结果”。                                         | 把英文结果伪装成中文结果，或不显示语言。                   |

Google 指出：如果只有导航或模板被翻译而主体内容保持相同，本地化 URL 可能被视为重复页面；因此 Jamcaa 不应把“翻译了外壳”当成一份可加入 `hreflang` 集群的完整翻译。[Google: Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)

### 10.2 推荐的缺页行为

1. 请求 `/zh-hans-cn/docs/example/`，中文翻译不存在。
2. 返回中文界面的 404 或明确的 unavailable 状态，说明该页尚未翻译。
3. 提供英文原文 `/en-us/docs/example/` 的直接链接，并给链接标记 `hreflang="en-US"`。
4. 当前不存在的中文页面不发出 self-canonical，也不进入英文页面的 alternate 集合。
5. 语言切换器显示“English available”，而不是把用户悄悄送回英文首页。

如果产品选择重定向，则目标必须是英文原文 URL，目标页输出 `<html lang="en-US">` 和英文 self-canonical；不能保留中文 URL 再只改 `lang`。

### 10.3 与现有内容模型的关系

现有 [ADR-0029](../adr/0029-content-variants-are-separate-localized-identities.md) 将 Locale 纳入内容身份，并以 Translation Set 关联等价版本。因此：

- 每个 Locale 版本拥有独立字段、发布状态、slug 或 Page address，普通更新与 Revision Restore 不改变 Locale 或 Translation Set 身份。
- Entry Summary、Search、Former Address、Feed 和分页 Cursor 均按 Locale 分区，不能跨语言复用。
- Alternate 只从同一 Translation Set 中真实存在且已发布的版本生成，不能根据 slug 或路径猜测翻译关系。
- 缺失版本不会回退渲染另一 Locale 的正文；当前管理端仍未提供完整的版本创建、Locale 选择与 Translation Set 关联流程。

## 11. 实施顺序建议

1. **固定 IA 与页面类型**：先完成 Home、Docs、Tutorials、Reference、Search 的导航和模板契约。
2. **统一页面元数据模型**：标题、描述、栏目、顺序、TOC、canonical identity、可编辑源位置。
3. **建立语言注册表**：只登记 `zh-Hans-CN`/`zh-hans-cn` 与 `en-US`/`en-us`，集中导出转换函数。
4. **让现有英文站诚实化**：当前英文页面先统一输出 `lang="en-US"` 与 self-canonical；没有中文翻译时不输出中文 alternate。
5. **增加根语言选择页**：`/` 成为稳定 `x-default`，明确链接两个 locale 首页；中文站未上线前只展示可用语言。
6. **接入界面消息目录**：导航、搜索、错误、表单和可访问名称先达到完整覆盖。
7. **落实翻译内容身份**：按 ADR-0029 使用独立 Locale 版本与 Translation Set，并只为真实已发布版本输出 reciprocal `hreflang`。
8. **最后增强搜索与贡献体验**：语言范围、翻译入口、页面反馈、版本筛选；无需为了首版采用新的前端搜索依赖。

## 12. 验收清单

### IA 与导航

- [ ] Home、Docs、Tutorials、Reference、Search 职责清楚，内容不重复堆叠。
- [ ] 所有内容页有全局 Header、左侧导航、面包屑、TOC、Previous/Next 和页面操作中适用的部分。
- [ ] 搜索可由键盘完整操作，并显示结果所属栏目与语言。
- [ ] 教程有学习结果、可验证步骤、完成检查和最终产物。
- [ ] Reference 有统一顺序、稳定锚点、类型/默认值/注意事项和 Troubleshooting。
- [ ] 320、375、390、768 CSS px 和桌面宽度均无视口级横向滚动。

### Apple 风格与无障碍

- [ ] 所有颜色来自语义令牌，Accent 不成为大面积阅读背景。
- [ ] 小文本达到 4.5:1，大号或粗体文本达到 3:1；状态不只靠颜色。
- [ ] 透明材料只用于功能 chrome，正文和代码保持稳定实色背景。
- [ ] 浏览器文本放大 200% 后无关键内容截断或操作丢失。
- [ ] 键盘焦点可见，搜索、TOC、折叠导航和语言切换可完全键盘操作。
- [ ] `prefers-reduced-motion: reduce` 下无弹跳、视差和大范围位移。

### Locale 与 URL

- [ ] 唯一 canonical locale ID 是 `zh-Hans-CN` 与 `en-US`。
- [ ] 唯一 URL key 是 `zh-hans-cn` 与 `en-us`。
- [ ] 大小写、下划线或别名输入在边界规范化，输出永远使用唯一形式。
- [ ] 显式 locale URL 不被浏览器语言偏好重定向。
- [ ] `zh-Hant`、`zh-TW`、`zh-HK`、`zh-MO` 不自动映射到 `zh-Hans-CN`。
- [ ] `/` 是稳定语言选择/`x-default` 入口。

### HTML 与搜索元数据

- [ ] 每个实际页面的 `<html lang>` 描述真实内容语言。
- [ ] 每个页面有绝对、自引用、同语言 canonical。
- [ ] 每个 `hreflang` 集群只包含真实、等价、可索引页面。
- [ ] 每页包含自身 alternate，所有等价页互相回链。
- [ ] `x-default` 只用于 alternate，不作为 locale ID 或 HTML `lang`。
- [ ] 中文翻译不 canonical 到英文原文。
- [ ] 中文 URL 不渲染完整英文正文；缺失翻译有明确 unavailable 流程。
- [ ] 内部链接、搜索结果、重定向和 canonical 使用相同规范 URL。

## 13. 官方来源索引

### 文档站基准

- Astro homepage: https://astro.build/
- Astro Getting Started: https://docs.astro.build/en/getting-started/
- Astro Tutorial: https://docs.astro.build/en/tutorial/0-introduction/
- Astro Internationalization Guide: https://docs.astro.build/en/guides/internationalization/
- Astro i18n Recipe: https://docs.astro.build/en/recipes/i18n/
- Astro Configuration Reference: https://docs.astro.build/en/reference/configuration-reference/
- Astro API Reference: https://docs.astro.build/en/reference/api-reference/
- Astro Template Directives Reference: https://docs.astro.build/en/reference/directives-reference/
- Astro Error Reference: https://docs.astro.build/en/reference/error-reference/
- React Learn: https://react.dev/learn
- React Tic-Tac-Toe Tutorial: https://react.dev/learn/tutorial-tic-tac-toe
- React Describing the UI: https://react.dev/learn/describing-the-ui
- React Adding Interactivity: https://react.dev/learn/adding-interactivity
- React API Reference: https://react.dev/reference/react
- React `useState` Reference: https://react.dev/reference/react/useState

### Apple 设计

- Apple HIG Color: https://developer.apple.com/design/human-interface-guidelines/color
- Apple HIG Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple HIG Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple HIG Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple HIG Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple Design Resources: https://developer.apple.com/design/resources/

### 语言与 HTML 规范

- RFC 5646 — Tags for Identifying Languages: https://www.rfc-editor.org/rfc/rfc5646.html
- RFC 4647 — Matching of Language Tags: https://www.rfc-editor.org/rfc/rfc4647.html
- IANA Language Subtag Registry: https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
- WHATWG HTML `lang`: https://html.spec.whatwg.org/multipage/dom.html#attr-lang
- WHATWG HTML `hreflang`: https://html.spec.whatwg.org/multipage/links.html#attr-hyperlink-hreflang
- WHATWG HTML alternate: https://html.spec.whatwg.org/multipage/links.html#link-type-alternate
- WHATWG HTML canonical: https://html.spec.whatwg.org/multipage/links.html#link-type-canonical
- MDN HTML `lang`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang
- MDN `<a>` `hreflang`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#hreflang
- MDN `<link>` `hreflang`: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/link#hreflang
- Google localized versions: https://developers.google.com/search/docs/specialty/international/localized-versions
- Google canonicalization: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
