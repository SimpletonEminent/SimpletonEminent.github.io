# Spec: 统一数据同步管道 —— 收敛网络重试与共享路径契约

> Triage label: `ready-for-agent`

## Problem Statement

在项目的辅助与自动化维护工具集中，存在多个功能各异但底层逻辑高度相似的脚本（定时抓取 Steam API 游戏时长、抓取商店中文名与发售日、抓取成就进度、CSV 导出与导入等）。这些脚本目前各自硬编码声明了公共数据文件和注释文件的相对路径，并且在调用 Steam 外部 API 时各自实现了重复的 HTTP 请求重试、退避延时、频率限制与错误拦截逻辑；同时 CSV 导入与导出脚本还各自编写了简陋的字符级解析与转义规则。这种浅层代码的分散复制不仅增加了维护成本，而且一旦 Steam 接口限制策略微调或文件路径变更，需要排查修改多达 7 个文件。

## Solution

建立深度的 Steam 同步与持久化管道核心模块（Steam Pipeline Core），将 Steam Web API 的速率限制、指数退避重试、网络故障重连、规范化文件路径定义以及稳健的双向 CSV 表格编解码逻辑全部封装其内。原有的日常同步、元数据丰富、成就检查与表格转换脚本全部降级为浅层的任务命令适配器（CLI Adapters），仅负责接收命令行参数并触发管道核心，实现网络访问与数据读写的单一事实来源。

## User Stories

1. As a blog maintainer running CLI scripts, I want network transient failures and rate-limiting from Steam Web API to be handled uniformly with exponential backoff, so that scripts don't fail intermittently during daily sync.
2. As a blog maintainer, I want data file paths and schema locations to be defined in exactly one place, so that moving or renaming a data file never requires editing half a dozen standalone scripts.
3. As a blog maintainer, I want CSV export and import to use a shared, robust RFC-compliant tabular codec, so that special characters, commas, and line breaks in game names or reviews are never mangled.
4. As a developer, I want individual script entrypoints to be concise task wrappers, so that adding a new automation task takes just a few lines of code calling the deep pipeline module.
5. As a tester, I want to test Steam API retry and rate-limiting behaviors by mocking the HTTP transport layer once, rather than writing duplicate network mocks for every script.

## Implementation Decisions

- **建立管道核心模块**：在工具类库中创建专职的数据管道核心模块，承载通用的数据抓取与持久化逻辑。
- **路径常量单一来源**：将数据文件（`public/steam_games.json`）、注释文件（`src/data/steam_annotations.json`）、成就数据文件（`public/steam_achievements.json`）与临时表格的路径常量集中于该模块导出。
- **弹性网络客户端**：在管道内封装具备统一间隔时间控制、指数退避重试（Backoff）与状态码分类处理（区分 404/隐私受限与瞬时网络超时）的 HTTP 客户端。
- **标准化 CSV 编解码**：抽象通用的双向表格转换器，支持带有 UTF-8 BOM 头的安全读写、字段映射转换与非法游玩状态校验回退。
- **脚本职责退化**：现有的抓取脚本、元数据填充脚本与表格转换脚本仅作为 CLI 参数解析器和任务调度器，所有业务编排调用管道核心接口。
- **领域术语保持**：遵循 CONTEXT.md 规范，继续使用 数据同步 (Sync)、游戏数据 (SteamGame)、注释文件 (annotations)。

## Testing Decisions

- **好测试的标准**：只测外部行为——测试 HTTP 客户端在面对 429 或 500 状态码时是否执行了正确次数的重试和延时；测试 CSV 编解码器在面对包含逗号、双引号和换行的复杂评论时往返数据完全无损；测试非法状态在导入时正确回退为未通关。
- **测试模块**：Steam 同步管道核心模块及 CSV 编解码器。
- **测试先例**：项目中现有的 `test-play-status.ts` 与 `test-play-year.mjs`。
- **架构缝**：管道核心与底层 HTTP Transport / 文件系统之间的接口接缝。

## Out of Scope

- 不改变 Steam API 的抓取字段范围与业务逻辑。
- 不改动 GitHub Actions 的每日定时触发配置。
- 不引入外部庞大的重量级网络框架。

## Further Notes

- 与现有的 `play-status.ts`（状态词汇）和 `play-year.mjs`（年份验证）形成协同，构成完整的本地脚本支撑底座。
