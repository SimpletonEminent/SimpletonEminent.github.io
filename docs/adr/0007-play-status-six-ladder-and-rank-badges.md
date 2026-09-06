# 游玩状态六阶梯与段位双徽章

## 背景

用户希望为竞技/多人游戏(如《Apex 英雄》)表达"无传统通关概念但仍在玩"的游玩关系,并展示自己的历史最高段位。需求曾与外部 AI 讨论并产出 `D:\my-blog-spec\gamestatus_spec.md`。**规则:外部 AI 讨论结果与内部规格冲突时,以本 ADR 与内部规格为准。**

## 决策

1. **`my_status` 扩展为六阶梯**:`uncompleted`(未通关)、`completed`(已通关)、`perfect`(全成就)、`ongoing`(持续游玩 🎮)、`hiatus`(暂退长草)、`retired`(已退役)。字段名不变;外部提议的 resident 等其他状态值一律不采纳。
2. **新增可选字段 `my_rank`**(历史最高段位,自由文本,空 = 未填写)。不做结构化段位(赛季/分数),自由文本成本最低,可自行带赛季后缀(如 `璀璨钻石 💎 S24`)。
3. **徽章组合规则**(卡片 / 桌面 TOC / 移动 TOC / 气泡四处共用,`badgesFor`):
   - 无段位 → 状态单徽章;
   - 有段位 → **双徽章**(状态 + 段位)。段位只是追加信息,绝不顶替游玩状态。
4. **排序**:「通关进度」维度权重:全成就 6 > 已通关 5 > 持续游玩 4 > 未通关 3 > 暂退长草 2 > 已退役 1。
5. **样式**:沿用 Starlight CSS 变量 + scoped CSS(ADR-0001 不引入 Tailwind):持续游玩 = 浅紫、暂退长草 = 草绿、已退役 = 暗灰、段位 = 翡翠绿带细边框(暗/亮双套)。
6. **录入通道**:新建交互式 CLI `scripts/add-review.mjs`(`npm run review`);CSV 工具同步升级(状态列六项下拉 + 最高段位列,`csv-to-json` 非法值仍回退未通关)。
7. **术语**:CONTEXT.md「通关状态」更名「游玩状态 (Play Status)」,新增「段位 (Rank)」词条。

## 原因

- 外部 AI 提议的 resident/hiatus/retired 三元组与内部"持续游玩"概念冲突;采纳六阶梯以覆盖完整需求(在玩 / 长草 / 退役三种非通关关系)。
- 双徽章规则用 `my_rank` 隐式表达"联机有战绩",不加 `is_online_active` 布尔字段。
- 段位只作为追加信息与状态徽章并排,任何状态下都不顶替状态徽章(2026-08-19 修订:初版曾按状态分组让持续游玩/未通关只显段位,实际使用发现会吞掉《Apex 英雄》的「持续游玩」徽章,该分组已废止)。

## 影响

- `src/lib/steam-data.ts`(枚举/文案/权重/badgesFor)
- `src/components/SteamGallery.astro`、`GamesTableOfContents.astro`、`GamesMobileTableOfContents.astro`(渲染 + 六态/段位样式)
- `scripts/json-to-csv.mjs` / `scripts/csv-to-json.mjs` / `scripts/add-review.mjs`(新)
- `docs/steam-gallery-ops.md`、`CONTEXT.md`

## 修订记录

- **2026-08-19(用户裁决,推翻原第 3 条后半)**:实际使用发现"有段位 + 持续游玩 → 段位单徽章"会吞掉《Apex 英雄》的「持续游玩」徽章(更新段位后页面上只剩铂金)。徽章规则改为:**游玩状态徽章永远显示;有段位 → 状态 + 段位双徽章**。录入与展示本就是两个独立字段,展示侧不再做"谁顶替谁"的推导。回归测试见 `scripts/test-badges.ts`(`npm test`)。
- **2026-08-19(重构)**:气泡「游玩状态」徽章改为直接复制卡片已渲染的徽章 DOM,删除客户端脚本内的 `STATUS_TEXT` 与 `badgesHtml` 规则副本(客户端 `is:inline` 脚本无法 import 模块,复制渲染结果而非重写规则)。徽章规则因此只存在于 `src/lib/steam-data.ts` 的 `badgesFor`,四处一致由结构保证,不再依赖两处同步修改。
- **2026-09-05(重构)**:气泡内容改为**构建期服务端渲染**(Spec: 气泡构建期渲染)。新增纯函数 `renderBubbleContent`(位于 `src/lib/steam-data.ts`),输入 `MergedGame` 输出气泡 HTML 字符串,由 `set:html` 在构建期注入。客户端 `is:inline` 脚本移除 `esc` / `formatHours` / `releaseYear` / `firstPlayDate` 四个纯函数副本与 `renderBubble` 拼接逻辑,只保留气泡 `hidden` 切换、`top` 定位、选中/收起/排序/联动事件。上述「复制卡片已渲染 DOM」的权宜 hack 随根因解决而删除——徽章(游玩状态 + 段位)与卡片改为共同直接渲染 `badgesFor`,四处一致由渲染同一函数保证。
- **2026-09-05(词汇单源化,Spec 02)**:六阶梯的枚举值、中文文案、排序权重与 CSV 中文映射集中到唯一词汇模块 `src/lib/play-status.ts`。`steam-data.ts`、三个 UI 组件(`SteamGallery` / `GamesTableOfContents` / `GamesMobileTableOfContents`)、CLI(`add-review.mjs`)与 CSV 工具(`json-to-csv` / `csv-to-json`)全部从该模块取值,不再各自重复列出。**文案收敛**:`statusText` / `statusLabel` 统一返回 CONTEXT.md 词条的中文文案(如 `perfect` → `全成就`、`ongoing` → `持续游玩`),第 1 条中 `ongoing`(持续游玩 🎮)的装饰性 🎮 属于展示层漂移,随单源化移除——状态徽章仍由颜色(浅紫)与段位并排区分,徽章「状态永远显示、段位只追加」规则不变。新增词汇回归测试 `scripts/test-play-status.ts`(`npm test`)。
- **2026-09-05(样式单源化,Spec 03)**:六阶梯游玩状态及段位的徽章颜色(明暗双套)抽离到 `src/styles/theme.css` 全局共享。删除了三个画廊组件中约 70 行的重复颜色样式拷贝,使得同一状态在卡片墙、侧边栏列表和移动端下拉列表中的色彩呈现完全一致,改动一处即可全站生效。各组件仅保留自身的布局、间距等微调。
