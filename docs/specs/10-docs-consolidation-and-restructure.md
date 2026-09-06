# Spec: 文档体系整合与重构 —— 消除规范冲突并建立全局知识图谱

> Triage label: `ready-for-agent`

## Problem Statement

随着个人博客与 Steam 游戏画廊（Gallery）功能的持续演进，项目内积累了领域术语表、架构决策记录（9 份 ADR）、功能规范（9 份 Spec）、操作手册、写作规范以及根目录下未入库的风格指南等多达 20 余份指引性文档。然而，这些文档目前处于自发分散生长的状态，暴露出了四个显著问题：
1. **规范相互冲突**：入库的技术写作指南（`docs/blog-writing-guide.md`）罗列了大量的可选 frontmatter 控制字段，而根目录下的写作风格指南（`我的博客写作风格.md`）却严格规定“除 3 个基础字段外一律不许添加”，导致维护者与 AI 写作时面临矛盾标准；
2. **操作指引未以新架构为主干**：运维手册（`docs/steam-gallery-ops.md`）虽然最新引入了交互式更新控制台（`npm run updatedata`），但正文仍充斥着零散的旧命令教学，且与 `README.md` 的代码提交与检查流程大段重复；
3. **架构与规范资产缺乏索引总览**：9 个 ADR 与 9 个 Spec 散落在子目录中，缺乏状态矩阵（已交付/待办/演进中）与演进路线图（Roadmap），新进入的开发者无法一览系统全貌；
4. **工程编码标准未成文**：项目中关于“严禁类型断言绕过”、“六阶梯词汇单源引用”、“测试覆盖外部行为”、“客户端脚本与模板解耦”等关键工程纪律仅存在于 commit 历史和 AI 记忆中，缺少统一的工程编码规范。

## Solution

对全站的非博客指引性文档进行结构化重组与内容整合，构建**层次分明、单源权威、无矛盾、无冗余的统一文档中枢**：
1. **统一博客文章写作与风格规范**：将技术排版检查与个人写作风格指纹（H1 hook、`\- ` 评测段落、三段式结语、高频加粗与分隔线、严苛 frontmatter 纪律）合并为单一权威的《博客写作与排版规范》，消除规范分歧；
2. **现代化操作运维手册**：以 `npm run updatedata`（Mission Control）为主线全面重构《游戏画廊与日常运维手册》，旧命令降级为底层参考，消除与 `README.md` 之间的提交说明重复；
3. **建立文档中枢与决策路线图索引**：在 `docs/README.md` 建立全局文档中枢，提供文档地图，并整合 ADR 决策矩阵与 Specs 路线图清单（将未完成的 Specs 06-08 转化为演进蓝图）；
4. **沉淀工程与编码规范**：提炼《工程与编码规范》，明确类型安全、单源化架构、测试准则与 Astro 组件开发契约。

## User Stories

1. As a blog maintainer, I want a single authoritative writing guide, so that I don't have to reconcile contradictory rules about frontmatter fields and formatting across multiple files.
2. As a blog maintainer, I want the operations guide to put `npm run updatedata` front and center, so that I have one standard and easy workflow for all daily data maintenance.
3. As a blog maintainer, I want git commit and deploy checklists to live in only one place, so that updating the pre-push check command doesn't require modifying multiple markdown files.
4. As a developer or agent exploring the repository, I want a `docs/README.md` documentation map, so that I can immediately understand where to find terminology, operational guides, architecture decisions, and roadmap specs.
5. As a developer, I want an ADR index matrix, so that I can quickly see what architectural decisions have been made, which ones have been superseded, and what context justifies them.
6. As a developer, I want a unified roadmap tracking active and planned specs, so that I can see the future blueprint of the project at a glance without crawling closed vs open issue threads.
7. As a developer, I want clear, documented coding standards, so that I write code consistent with the existing codebase conventions (such as play-status vocabulary reuse and coordinator patterns).
8. As a reviewer, I want documentation to use canonical CONTEXT.md domain vocabulary consistently throughout, so that terms like "Overview list" and "Play Status" are never referred to by informal nicknames.

## Implementation Decisions

- **规范融合（写作维度）**：将 `docs/blog-writing-guide.md` 与根目录写作风格文档的核心要点融合成单一权威文档。严格固化“3 基础字段（title/description/pubDate）为铁律”，将特殊字段（如仅限游戏评测的长评 hero banner 与 sidebar 配置）明确规定为受控白名单特例，彻底消除规则冲突。
- **运维手册重构（操作维度）**：将 `docs/steam-gallery-ops.md` 第一大节直接重塑为“数据维护中心（`npm run updatedata`）全功能操作指南”，原 6 个分散脚本的运行细节收归该中心选项解析；将提交流程精简为交叉引用至 `README.md`。
- **文档中枢建立（索引维度）**：创建 `docs/README.md`，建立四大核心板块导览：
  - 📖 内容创作：博客写作与排版规范、写作风格指南
  - 🛠️ 日常运维：游戏画廊运维手册、自动部署与数据管线
  - 🏛️ 领域与架构：`CONTEXT.md` 术语表、`docs/adr/` 架构决策矩阵表（含 0001 至 0009 的决策速查）
  - 🗺️ 演进路线图：Specs 状态与未来规划蓝图（已交付 01-05 & 09，待办演进 06-08）
- **工程标准成文（研发维度）**：新建《工程与编码规范》（`docs/coding-standards.md`），明确记录：
  - 类型安全纪律：严禁 `as any`，强制编译期类型自恰；
  - 单源化规范：业务状态必须引用 `src/lib/play-status.ts`，徽章颜色统一由全局样式定义；
  - 测试规范：测试只测外部行为，杜绝破坏性文件重命名副作用；
  - 前端架构契约：Astro 模板保持声明式纯静态，客户端交互统一委托协调器。
- **领域术语保持**：严格遵循 CONTEXT.md 规范，继续使用 游戏画廊 (Gallery)、Overview 列表 (Overview list)、数据同步 (Sync)、注释文件 (annotations)、游玩状态 (Play Status)。

## Testing Decisions

- **好测试的标准**：指引性文档属于静态参考，测试标准为结构完整性与引用有效性——所有文档间的相互超链接（相对路径）、`package.json` 指令名引用、示例代码块语法均真实有效且能在静态检查中通过。
- **测试模块**：文档超链接与代码示例有效性验证。
- **测试先例**：项目中现有的 `npm test` 以及 `astro check`。
- **架构缝**：文档目录结构与超链接网状引用的边界。

## Out of Scope

- 不修改现有博客文章正文内容（`src/content/docs/blog/*.md`）。
- 不改动任何前端 Astro 组件的实现代码或业务逻辑。
- 不改动已交付的 9 份 ADR 既有历史结论（仅对其建立索引表）。

## Further Notes

- 完成本 Spec 将使项目的工程与写作规范由“隐式经验/零散文件”全面升级为“体系化治理”，极大便利后续自动化 Agent 与人类维护者的长期协作。
