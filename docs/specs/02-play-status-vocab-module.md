# Spec: 游玩状态六阶梯 —— 唯一词汇模块

> Triage label: `ready-for-agent`

## Problem Statement

游玩状态 (Play Status) 六阶梯的**枚举值、权重、中文文案、CSV 中文映射**目前在代码库的 8 个地方各自独立列出：

1. `src/lib/steam-data.ts` —— `type Status` + `STATUS_WEIGHT` + `statusText`
2. `src/components/SteamGallery.astro` —— 六态颜色块 + 徽章渲染
3. `src/components/GamesTableOfContents.astro` —— 六态颜色块 + 渲染
4. `src/components/GamesMobileTableOfContents.astro` —— 六态颜色块 + 渲染
5. `scripts/add-review.mjs` —— 六阶梯 CLI 菜单 `STATUS_OPTIONS`
6. `scripts/csv-to-json.mjs` —— 中文状态 → 键的映射 `STATUS_TO_KEY`
7. `scripts/json-to-csv.mjs` —— 键 → 中文状态的映射 `statusMap`
8. `scripts/test-badges.ts` —— `STATUSES` 测试数组

问题从用户视角是：**六阶梯是领域核心词汇，却在多处漂移。** 新增/改名一个状态需要排查 8 处是否同步，漏一处就出现"菜单有、卡片无"或"CSV 存了但界面不识"。

## Solution

建立**唯一词汇模块**，集中声明六阶梯状态的类型、枚举、文案、权重、以及键↔中文的双向映射。所有消费方（UI 组件、CLI 菜单、CSV 适配、测试）只从该模块取值。词汇从此单一来源。

## User Stories

1. 作为博客所有者，我希望六个游玩状态及其显示文案只在一个地方定义，以免我在多文件间同步时出错。
2. 作为博客所有者，我希望新增一个游玩状态（如"暂时搁置"）只改一处，画廊卡片、右侧列表、移动列表、CLI 菜单、CSV 双向映射全部生效。
3. 作为画廊访问者，我希望看到一个尚未通关的游戏显示"未通关"徽章，而非空白或错误状态。
4. 作为画廊访问者，我希望看到"持续游玩"状态时同时保留段位徽章（状态永远显示，段位只追加），以正确反映竞技游戏关系。
5. 作为开发者，我希望通过交互式 CLI（`npm run review`）录入状态时，菜单选项与该词汇模块完全一致，避免"菜单一个词、存储一个值"的偏差。
6. 作为开发者，我希望 CSV 导出（`json-to-csv`）与 CSV 导入（`csv-to-json`）使用同一套中文映射，避免"导出一种写法、导入又一种写法"。
7. 作为开发者，我希望状态权重的排序（通关进度维度）与词汇模块一起定义，以便理解"全成就 > 已通关 > 持续游玩 > 未通关 > 暂退长草 > 已退役"的排序语意。
8. 作为测试者，我希望回归测试直接从词汇模块取枚举值，而不是硬编码数组，以免测试数组与真实枚举漂移。

## Implementation Decisions

- **新增模块**：在 `src/lib/` 建立 `play-status.ts`（领域词汇模块），导出：
  - `Status` 类型（六阶梯联合）
  - `STATUS_LADDER`：六阶梯数组（键 + 中文文案 + 权重）
  - `statusLabel(status)` / `statusText(status)`：返回中文展示文案（与 CONTEXT.md「游玩状态」词条一致）
  - `statusWeight(status)`：排序权重
  - `statusToKey(label)` / `keyToStatus(key)`：CSV 中文 ↔ 内部键双向映射
- **共享方式**：scripts 为 `.mjs`，与 TS 互导受限。`test-badges.ts` 已用 `--experimental-strip-types` 直导 `src/lib/steam-data.ts`，证明 TS-单源 + strip-types 通道可行；scripts（add-review / csv-to-json / json-to-csv）改用同一 channel 或提供一个 `.mjs` 网关导出。
- **组件**：三个组件从词汇模块取文案与枚举，不再各自重复 `status-badge` 的六态数据（本 Spec 只统一"词汇"，颜色样式单源属候选 3）。
- **保留**：`badgesFor` 组合规则继续留在 `steam-data.ts`（或迁移到与该词汇模块相邻的单一事实源），徽章"永远显示状态、段位只追加"的规则不变（ADR-0007 v2）。
- **领域术语保持**：继续使用 游玩状态 (Play Status)、段位 (Rank)，六阶梯值不变。

## Testing Decisions

- **好测试的标准**：只测外部行为——给定状态键/中文，返回正确文案/权重/映射；不测模块内部实现。
- **测试模块**：`play-status.ts` 词汇模块（新增）；`test-badges.ts` 需更新为从词汇模块取 `STATUSES`（回归确认仍通过）。
- **测试覆盖点**：
  - 六阶梯每个键的 `statusLabel` 返回正确中文。
  - `statusWeight` 排序：全成就 > 已通关 > 持续游玩 > 未通关 > 暂退长草 > 已退役。
  - `statusToKey` / `keyToStatus` 双向一致（所有中文↔键往返不丢失）。
  - 非法输入返回安全默认（如未知键 → 未通关）。
- **现有测试先例**：`scripts/test-badges.ts` 与 `scripts/test-play-year.mjs` 均为纯函数断言风格，`npm test` 串行运行。新测试并入。
- **架构缝**：词汇模块的纯函数接口（最高缝），不依赖任何组件或文件系统。

## Out of Scope

- 不改六阶梯的具体取值与文案——仅收敛其定义位置。
- 不含徽章颜色样式的单源（属候选 3，独立演进）。
- 不改气泡构建期渲染（属候选 1，独立演进）。
- 不改 `badgesFor` 的组合规则语义（状态永远显示、段位只追加）。

## Further Notes

- 六阶梯状态是领域核心（CONTEXT.md「游玩状态 (Play Status)」词条），词汇单源化增强领域模型的唯一性。
- 与候选 1 存在协同：候选 1 改完后，客户端不再持有独立徽章渲染，本 Spec 只需收敛服务端 + scripts 的词汇。
- 本 Spec 与此前架构审查报告的候选 2（Worth exploring）对应。
