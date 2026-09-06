# Spec: 数据装载记忆化 —— 消除重复解析与重复排序

> Triage label: `ready-for-agent`

## Problem Statement

在单个 `/games` 页面构建过程中，`loadMergedGames()` 在 3 个组件各自被调用一次（`SteamGallery.astro`、`GamesTableOfContents.astro`、`GamesMobileTableOfContents.astro`），每次都重新读取并解析 3 个 JSON 数据文件（数据文件 games data、注释文件 annotations、成就数据）。同时，6 组排序预设（`sortGames`）在画廊组件与桌面 TOC 组件**各自**预计算一遍。

问题从用户视角是：**同一份数据加载事实被重复执行，属结构性冗余。** 当前数据量（约 200 款游戏）下性能影响可忽略，但加载逻辑被 3 处重复、排序被 2 处重复，削弱了"数据来源唯一"的保证。

## Solution

为 `loadMergedGames()` 增加**模块级记忆化**（Astro server 模块单例跨组件共享），使得同一构建周期内只读取并解析数据文件一次，后续调用命中缓存。排序预设只在单处预计算并通过 `define:vars` 注入，供画廊与 TOC 复用。数据加载与排序的"事实"从此各执行一次。

## User Stories

1. 作为开发者，我希望一次页面构建只读并解析数据文件一次，以免多个组件重复 I/O。
2. 作为开发者，我希望 `loadMergedGames` 的返回在单次构建内稳定复用，以便画廊与右侧列表使用同一份合并结果，杜绝"两个组件读到不同快照"的潜在不一致。
3. 作为开发者，我希望排序预设只在单处计算，避免画廊与 TOC 各自 `sortGames` 近 12 次的重复。
4. 作为博客所有者，我希望数据来源（数据文件 games data、注释文件 annotations、成就数据）维持 ADR-0005 / ADR-0008 的职责分离，不被记忆化破坏。
5. 作为博客所有者，我希望画廊与右侧列表的排序行为始终一致（同一 `sortGames` 结果），作为"两边同一份数据"的隐含保证。

## Implementation Decisions

- **记忆化**：`loadMergedGames` 增加模块级缓存（Astro 服务端模块是单例），首次调用解析并缓存，后续命中。缓存按构建生命周期自然失效，无需跨构建持久化。
- **排序预计算单点**：排序预设只在单一模块（如画廊组件内）计算一次，结果通过 `define:vars` 注入客户端脚本与 TOC；或抽出共享预计算函数供两处引用，但只在顶层调用一次。
- **副作用注意**：当前脚本通过 `readFileSync`（`node:fs`）与 `JSON.parse` 同步读取；记忆化需保证异常路径（读取失败返回空列表）与现状一致。
- **错误语义保持**：任何数据文件解析失败时维持"返回空/默认值"的现状，不因缓存而改变。
- **领域术语保持**：继续使用 数据文件 (games data)、注释文件 (annotations)、数据同步 (Sync)、画廊 (Gallery)、Overview 列表 (Overview list)。

## Testing Decisions

- **好测试的标准**：只测外部行为——同一构建内两次调用返回同一引用/同一结果；解析失败时返回空列表。不测缓存实现。
- **测试模块**：`steam-data.ts` 的 `loadMergedGames`（新增缓存断言）；现有 `test-badges.ts` 回归确认不受影响。
- **测试覆盖点**：
  - 同一进程内连续两次调用 `loadMergedGames()` 返回相同结果（引用相等或内容相等）。
  - 数据文件读取失败时返回 `games: []`（现状行为不变）。
  - 合并逻辑（过滤 0h、默认值、成就合并）行为不变。
- **现有测试先例**：`scripts/test-badges.ts`（`--experimental-strip-types` 直导 TS）可扩展到 `loadMergedGames` 的断言；注意 `loadMergedGames` 依赖 `readFileSync` 对文件路径，测试需在项目根目录运行。
- **架构缝**：`loadMergedGames` 纯函数接口（最高缝），测试注入临时数据文件或空文件验证异常路径。

## Out of Scope

- 不改数据文件 schema、不改合并规则、不改排序维度。
- 不引入构建期缓存框架（如 Astro endpoint 缓存 / 静态 assets 缓存）。
- 不处理气泡渲染（候选 1）、词汇单源（候选 2）、徽章样式单源（候选 3）。
- 不优化运行时（浏览器端无此重复，属构建期）。

## Further Notes

- 本 Spec 与此前架构审查报告的候选 4（Speculative）对应——当前数据量下性能收益可忽略，主要收益是"结构化收敛"与"单一数据快照保证"。
- 若候选 1 先落地，气泡内容并入 `loadMergedGames` 输出后，本 Spec 的记忆化自然覆盖气泡与两个 TOC 的共享读取。
