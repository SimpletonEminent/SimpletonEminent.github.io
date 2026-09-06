# Spec: 徽章标记模板单源 —— 消除四处徽章遍历渲染重复

> Triage label: `ready-for-agent`

## Problem Statement

在先前的 Spec 03 中，游玩状态（六阶梯）及段位徽章的 CSS 颜色定义已成功收敛至单一的全局样式源。然而在标记结构（Markup）层面，根据游戏对象计算徽章并输出包含 `status-badge` 与 `rank-badge` 样式的 HTML 标签逻辑，依然存在浅层重复。目前在卡片网格组件、桌面 Overview 列表组件、移动端 Overview 列表组件以及数据模块中的气泡拼接函数中，分别独立维护着几乎完全一致的 `badgesFor(game)` 遍历与标签生成逻辑。如果未来需要调整徽章的 DOM 结构（例如增加无障碍 aria 标签、工具提示或结构微调），仍需在 4 个地方逐一修改。

## Solution

实现一个专职的徽章展示模板模块（Status Badge Module），接收游戏领域对象或其子集（包含游玩状态与段位），统一负责调用领域规则并输出标准化的徽章结构。所有需要展示状态与段位徽章的页面容器（画廊卡片、桌面 TOC、移动端 TOC 及气泡面板）统一切换为引用此单源模板，实现徽章表现层的真正单一来源。

## User Stories

1. As a gallery visitor, I want status and rank badges across gallery cards, bubble panels, desktop lists, and mobile dropdowns to have an identical DOM structure and accessibility semantics, so that my screen reader interprets them consistently.
2. As a blog maintainer, I want to adjust the HTML markup of badges (such as adding an icon, tooltips, or aria attributes) in a single template file, so that all four display areas update automatically.
3. As a developer, I want to render badges simply by passing a game object to a single template, without having to re-write conditional JSX logic checking for status vs rank kinds.
4. As a tester, I want to verify badge markup rendering against a single template module, ensuring that any presentation rule changes are immediately reflected across all consuming views.

## Implementation Decisions

- **新建徽章模板模块**：创建通用的徽章模板，负责消费游玩状态与段位字段。
- **封装规则调用**：模板内部自动调用 `badgesFor` 规则并结合词汇模块获取展示文案，外部调用方只需传递游戏实体数据。
- **统一无障碍与结构**：在模板中集中赋予徽章语义化标签和无障碍属性，保证各处渲染的 HTML 结构绝对对齐。
- **全站接入**：画廊卡片、桌面 Overview 列表组件、移动端 Overview 列表组件全面移除各自的手写循环逻辑，替换为调用该徽章模板；气泡面板亦统一对其进行复用或引用其生成的纯粹片段。
- **领域术语保持**：严格遵循 CONTEXT.md，继续使用 游玩状态 (Play Status)、段位 (Rank)、画廊 (Gallery)。

## Testing Decisions

- **好测试的标准**：只测外部行为——输入带有不同游玩状态及最高段位的游戏数据，断言输出的 DOM 节点包含正确的 class、文本及无障碍属性；断言空段位时只生成单徽章，有段位时并排生成双徽章。
- **测试模块**：徽章模板模块。
- **测试先例**：现有的 `test-badges.ts` 与 `test-bubble-render.ts`。
- **架构缝**：徽章模板的属性输入接缝。

## Out of Scope

- 不修改 `theme.css` 中的徽章颜色取值（已由 Spec 03 完成单源化）。
- 不修改 `play-status.ts` 中定义的六阶梯文案与权重（已由 Spec 02 完成单源化）。
- 不改变段位只追加、不顶替状态的领域组合规则（已由 ADR-0007 确立）。

## Further Notes

- 该 Spec 与 Spec 02（词汇单源）和 Spec 03（样式单源）相呼应，彻底完成游玩状态与段位徽章在「词汇、样式、结构」三个维度的完全单源化。
