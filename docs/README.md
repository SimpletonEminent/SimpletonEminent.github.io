# 📚 博客系统文档中枢 (Documentation Hub)

欢迎查阅本项目的核心技术与内容指引文档。本项目围绕 **Astro + Starlight** 搭建个人知识博客，并深度集成了自动化同步的 **Steam 游戏画廊（Gallery）**。

为了确保系统可维护、规范统一且便于人机协作，项目所有指引性文档按以下四个核心维度进行治理：

---

## 📖 一、内容创作与排版 (Content Creation)

* **[博客文章写作与排版规范](blog-writing-guide.md)**  
  全站内容创作的唯一权威准则。
  * **风格指纹**：详细定义“教程类”（步骤 `N/M`、编号列表、排坑结语）与“游戏评测类”（段落前缀 `\- `、煽情 H1、三段式致谢收束）的标志性风格。
  * **Frontmatter 铁律**：确立极简 3 字段标准（`title`, `description`, `pubDate`），并规范游戏长评的受控白名单特例（`hero`, `sidebar.badge`）。
  * **排版细节**：H1 hook 句与正式 title 的区分、高频粗体与分割线规范、发布前检查清单。

---

## 🛠️ 二、日常运维与部署 (Operations & Maintenance)

* **[Steam 游戏画廊与日常运维手册](steam-gallery-ops.md)**  
  画廊日常运行、数据维护与排错指南。
  * **Mission Control 总控台**：以 **`npm run updatedata`** 交互式菜单为统一主线，轻松调度新游戏元数据抓取、单款评测打标、年份预填、CSV 批量编辑与全量成就检查。
  * **数据管线全景**：阐明自动时长（`steam_games.json`）、静态成就（`steam_achievements.json`）与人工策展（`steam_annotations.json`）的三层解耦架构。
  * **常见排错清单**：网络限流保护、国区锁区游戏处理与本地证书配置。
* **[代码提交与部署手动流程](../README.md#提交与推送手动流程)**  
  代码与数据改动推送到 GitHub 的权威门禁清单。

---

## 🏛️ 三、领域术语与架构决策 (Domain & Architecture)

* **[领域术语表 (CONTEXT.md)](../CONTEXT.md)**  
  博客与画廊领域的规范用语与反义词（Avoid 清单），定义了画廊、游戏数据、游玩时长、数据同步、六阶梯游玩状态、段位、短评、长评等核心概念。
* **架构决策记录 (ADRs Index)**  
  记录系统历次关键技术决策的背景、权衡与历史修订：

| ADR 编号 | 决策标题 | 核心结论与收益 | 当前状态 |
|:---:|---|---|:---:|
| **[0001](adr/0001-gallery-styles-use-starlight-css-variables.md)** | 画廊样式采用 Starlight CSS 变量 | 放弃全局 Tailwind，改用 `--sl-color-*` 保证全宽网格与主题明暗切换原生贴合 | ✅ 已交付 |
| **[0002](adr/0002-steam-sync-via-actions-cron-and-static-json.md)** | 数据抓取采用 GitHub Actions 定时同步 | 零后端服务，每天通过 GitHub Actions 抓取并落盘为本地静态 JSON 文件 | ✅ 已交付 |
| **[0003](adr/0003-deploy-triggered-via-workflow-dispatch.md)** | 部署工作流采用 workflow_dispatch 显式触发 | 规避 GITHUB_TOKEN 提交不会触发下游 CI 的限制，保证数据更新后自动部署生效 | ✅ 已交付 |
| **[0004](adr/0004-gallery-master-detail-interaction.md)** | 画廊采用卡片网格 + Overview 列表主从联动 | 卡片展开气泡与桌面/移动端列表双向联动；2026-09-06 修订为协调器统一接管排序 | ✅ 已交付 |
| **[0005](adr/0005-annotations-separated-from-synced-data.md)** | 手工注释与自动化数据物理分离 | 自动数据放 `public/`，不可再生手写数据放 `src/data/`，同步脚本永不触碰手写内容 | ✅ 已交付 |
| **[0006](adr/0006-metadata-enrichment-and-manual-tags.md)** | 增量元数据丰富与手工特色标签并存 | 官方 genres 预填打底，允许用户追加特色词（如“魂系/肉鸽”），手写优先 | ✅ 已交付 |
| **[0007](adr/0007-play-status-six-ladder-and-rank-badges.md)** | 游玩状态六阶梯与段位双徽章展示 | 状态永远显示，段位只追加不顶替；六阶梯词汇与样式已完全单源化 | ✅ 已交付 |
| **[0008](adr/0008-first-play-estimate-from-achievements.md)** | 首次游玩时间由成就最早解锁时间推算 | 从 Steam 成就 API 的 `firstUnlockAt` 时间戳提取近似首次游玩日期 | ✅ 已交付 |
| **[0009](adr/0009-blog-sectional-nested-sidebar.md)** | 游戏长评采用侧边栏游戏评测嵌套组 | 文章物理文件保留在 `blog/` 根目录确保 URL 稳定，侧边栏通过配置手动分组 | ✅ 已交付 |

---

## 🗺️ 四、技术规范与演进路线图 (Specifications & Roadmap)

本项目采用规范先行（Spec-driven）的方式推进复杂特性的架构深化。所有规范统一归档于 `docs/specs/`：

| 规范编号 | 规范名称 | 解决的核心问题 / 架构收益 | 落地状态 |
|:---:|---|---|:---:|
| **[Spec-01](specs/01-bubble-server-render.md)** | 气泡构建期服务端渲染 | 消除客户端拼接 100 行 HTML 字符串，改由构建期直接渲染静态 DOM | ✅ 已交付 (Issue #1) |
| **[Spec-02](specs/02-play-status-vocab-module.md)** | 游玩状态六阶梯唯一词汇模块 | 提取 `play-status.ts`，收敛消除散落在全站 8 处的枚举与文案重复 | ✅ 已交付 (Issue #2) |
| **[Spec-03](specs/03-status-badge-styles-single-source.md)** | 状态徽章样式单源化 | 徽章明暗配色移至 `theme.css`，删除 3 个组件约 70 行重复 CSS | ✅ 已交付 (Issue #3) |
| **[Spec-04](specs/04-load-merged-games-memoize.md)** | 数据装载记忆化与排序预计算 | 为数据加载增加模块级缓存，单次构建只跑一次 I/O 并只传递 appid 排序数组 | ✅ 已交付 (Issue #4) |
| **[Spec-05](specs/05-gallery-client-coordinator.md)** | 画廊客户端交互协调器 | 建立 `gallery-coordinator.ts`，收拢三方事件，修复移动端 Overview 列表排序脱节 | ✅ 已交付 (Issue #5) |
| **[Spec-06](specs/06-steam-data-repository-seam.md)** | 游戏数据仓库与存储接缝 | 引入 StorageAdapter 接缝，消除单元测试重命名真实物理文件的破坏性副作用 | 📋 计划中 (Issue #6) |
| **[Spec-07](specs/07-steam-pipeline-core.md)** | 统一数据同步管道核心 | 建立统一数据管道，将 Steam API 指数退避重试与 CSV 编解码逻辑下沉收敛 | 📋 计划中 (Issue #7) |
| **[Spec-08](specs/08-status-badge-template.md)** | 徽章标记模板单源 | 封装通用 `StatusBadge.astro`，消除多处重复遍历 `badgesFor` 生成标签的 JSX | 📋 计划中 (Issue #8) |
| **[Spec-09](specs/09-interactive-data-updater-cli.md)** | 交互式数据更新菜单 | 建立 `npm run updatedata` 任务控制台，以子进程隔离一键调度 7 项手动作业 | ✅ 已交付 (Issue #9) |
| **[Spec-10](specs/10-docs-consolidation-and-restructure.md)** | 文档体系整合与重构 | 消除写作规范冲突，重构运维手册，沉淀编码标准与建立文档中枢 | ✅ 已交付 (Issue #10) |

---

## 💻 五、工程与编码标准 (Engineering Standards)

* **[工程与编码规范 (coding-standards.md)](coding-standards.md)**  
  代码库的核心工程纪律：
  * **TypeScript 纪律**：严禁 `as any`，强制编译期类型安全，跨环境运行时判定保护。
  * **单源化架构**：业务词汇引用 `play-status.ts`，主题样式归属 `theme.css`，数据加载归属 `steam-data.ts`。
  * **组件纯度**：Astro 模板仅负责静态输出，交互逻辑集中于深层协调器。
  * **测试原则**：仅验证外部行为，禁止破坏性副作用，全量测试始终保持 100% PASS。
  * **提交准则**：语义化 Conventional Commits 提交。
