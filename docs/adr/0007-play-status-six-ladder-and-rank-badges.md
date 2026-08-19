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
