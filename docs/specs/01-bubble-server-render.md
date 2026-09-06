# Spec: 气泡构建期渲染 —— 消除客户端重复纯函数

> Triage label: `ready-for-agent`

## Problem Statement

作为画廊 (Gallery) 的唯一实现者，`SteamGallery.astro` 中的客户端脚本（`is:inline` + `define:vars`）因无法 `import` 共享模块，被迫在浏览器里**独立复制**了 4 个原本已存在于 `src/lib/steam-data.ts` 的纯函数：`formatHours`（游玩时长格式化）、`releaseYear`（发售日期提年份）、`firstPlayDate`（成就时间戳 → 北京日期）、`esc`（HTML 转义）。同时气泡内容由 `renderBubble` 用 `innerHTML` 字符串拼接在客户端动态生成。

问题从用户的视角是：**改一处展示规则，别的展示点会漏改，导致同一游戏展示不一致。** 历史上已因此发生过回归（气泡徽章重复累积）。ADR-0007 v2 通过"复制卡片已渲染 DOM"绕过此约束，但这把"拷贝"固化成了架构事实，掩盖了根因。

## Solution

将气泡的**全部 HTML 内容改为构建期服务端渲染**。`loadMergedGames` 及其纯函数（`formatHours` / `releaseYear` / `firstPlayDate` / `esc` / `badgesFor`）已是唯一真实来源，气泡直接消费它们产出静态 HTML。客户端脚本只负责：气泡的 `hidden` 切换、位置计算、卡片选中/排序/联动事件。客户端脚本不再手拼 HTML、不再复制任何纯函数、不再从卡片 DOM 读取徽章结果。

## User Stories

1. 作为画廊访问者，我希望打开任意游戏气泡时看到完整、正确的资料行，以便了解该游戏的详细信息。
2. 作为画廊访问者，我希望气泡内的游玩状态 / 段位徽章与卡片完全一致，以免同一游戏出现两个不同徽章。
3. 作为画廊访问者，我希望气泡内的短评、长评链接、成就进度、首次游玩(估)等各行只在该游戏有数据时显示，以免出现空行或误导性字段。
4. 作为画廊访问者，当窗口缩放时，我希望气泡始终贴在对应卡片下方，不被错误定位。
5. 作为博客所有者，我希望修改游玩时长显示规则（如去小数）只改一处，全部展示点同步生效，以免漏改导致不一致。
6. 作为博客所有者，我希望修改状态徽章规则只存在于 `badgesFor`，四处展示一致由结构保证，不再依赖人工同步两份实现。
7. 作为博客所有者，我希望找回"游戏资料"修改的历史（此前因时区错误、徽章重复累积出过 bug），以确认修复后的行为稳定。
8. 作为开发者，我希望气泡渲染逻辑用纯函数表达（输入游戏数据 → 输出 HTML 字符串），以便用单元测试直接验证各类数据组合下的输出。
9. 作为开发者，我希望客户端脚本不再持有 `esc` / `formatHours` / `releaseYear` / `firstPlayDate` 的副本，以减少维护两支实现的心智负担。
10. 作为开发者，我希望气泡渲染后的 HTML 与卡片共享同一 CSS 类名（通过 `:global()`），以便动态插入的元素能命中 scoped 样式。

## Implementation Decisions

- **模块**：`src/lib/steam-data.ts` 作为深模块保持唯一事实来源；新增一个"气泡渲染"承担者（可放在该模块内，或作为它的薄接口导出），输入 `MergedGame`，输出气泡内部 HTML 字符串。
- **接口**：气泡渲染纯函数暴露单一入口，例如 `renderBubbleContent(game) => string`；客户端不再内联 HTML 拼接逻辑。
- **客户端脚本**：`SteamGallery.astro` 的 `<script is:inline>` 移除 4 个拷贝纯函数与 `renderBubble`；改为在构建期已经把气泡内容渲染到 DOM，脚本仅切换 `hidden`、计算 `top`、处理选中/收起/排序/联动的 `CustomEvent`。
- **徽章单源**：ADR-0007 v2 的"复制卡片/气泡 DOM" hack 弃用；卡片与气泡都直接从 `badgesFor` 渲染。徽章规则只存在于 `steam-data.ts`，四处一致由渲染同一函数保证。
- **时区**：`firstPlayDate` 保持北京时间固定偏移（UTC+8）转换，位置在服务端纯函数内，客户端不再持有。
- **转义**：`esc` 只在服务端渲染阶段调用；客户端已无拼接行为，不再需要转义助手。
- **定位**：气泡 `top` 计算仍留客户端（依赖运行时 `offsetTop`/`offsetHeight`），不受本次改变影响。
- **领域术语保持**：继续使用 画廊 (Gallery)、气泡 (bubble)、游玩状态 (Play Status)、段位 (Rank)、首次游玩(估) (First Play Estimate)、注释文件 (annotations)、数据文件 (games data)。

## Testing Decisions

- **好测试的标准**：只测外部行为——"给定一个 `MergedGame`，渲染出的气泡 HTML 是否包含应在的行、是否正确转义"，不测实现细节（类名结构、调用方式）。
- **测试模块**：气泡渲染纯函数（新增）；`badgesFor` 现有测试需确认仍通过（回归）。
- **测试覆盖点**：
  - 有长评 → 输出"深度评测"行；无 → 整行不出现。
  - 有 tags → 输出标签胶囊；无 → 整行不出现。
  - 成就 `total > 0` → 输出进度条；无成就数据 → 整行不出现。
  - 段位有值 → 状态 + 段位双徽章；无 → 状态单徽章。
  - 短评为空 → 显示"暂无短评"占位。
  - HTML 特殊字符（`< & > " '`）被转义。
- **现有测试先例**：`scripts/test-badges.ts`（`npm test` 的一部分），用 `--experimental-strip-types` 直接导入 `src/lib/steam-data.ts`，断言 `badgesFor` 输出。新增测试沿用同一通道与断言风格（`check(label, actual, expected)`）。
- **架构缝**：测试在 `steam-data.ts` 的纯函数接口处（最高缝，唯一缝），不依赖浏览器/DOM。

## Out of Scope

- 不改气泡的视觉样式（颜色、布局、动画）——仅改变气泡 HTML 的来源位置。
- 不改气泡与卡片的联动协议（`steam:select` / `steam:highlight` / `steam:sort`）。
- 不改画廊排序逻辑与排序预设。
- 不引入任何框架（如 React/Preact）来替代原生 JS。
- 不处理候选 2/3/4（六阶梯词汇单源、徽章样式单源、记忆化装载）——它们可独立演进。

## Further Notes

- ADR-0007 v2 记录了「气泡徽章复制卡片渲染结果」作为绕开 is:inline 无法 import 的权宜；本 Spec 解决根因后该 hack 可删除，与 ADR 精神一致。落实现场应更新 ADR-0007 的修订记录，说明权宜 hack 已被结构性方案替代。
- 本 Spec 与此前架构审查报告的候选 1（Strong）对应。
