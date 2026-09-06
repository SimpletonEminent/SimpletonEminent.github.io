# Spec: 画廊客户端协调器 —— 收敛三方事件总线与 DOM 联动

> Triage label: `ready-for-agent`

## Problem Statement

在游戏画廊（Gallery）页面中，卡片网格与两个不同视口形态的 Overview 列表（桌面端列表与移动端列表）之间的交互目前通过全局 `window` 派发的三个非类型化自定义事件（`steam:select`、`steam:highlight`、`steam:sort`）进行网状通信。这导致了三个问题：第一，卡片点击外部的判定逻辑为了防止误关气泡，直接在代码中通过 DOM 选择器窥探侧边栏的内部属性（`closest('[data-games-toc]')`）；第二，移动端 Overview 列表完全没有处理排序事件，导致用户在小屏设备上切换排序时，列表顺序与卡片网格发生脱节；第三，事件总线分散在三个模板中，缺乏统一的状态管理，任何一处状态变化都需要开发者在多个分散的脚本中人肉追踪。

## Solution

设计一个深度客户端协调器模块（Gallery Coordinator），全面接管画廊卡片气泡展开、选中高亮联动、外部点击关闭以及三处 DOM 节点的同步重排。模板只负责输出带有规范数据属性的静态 DOM，页面加载时通过单一接口初始化协调器，对外收拢交互状态，彻底消除散落的全局事件与私有 DOM 选择器窥探，并保证移动端与桌面端排序严格同步。

## User Stories

1. As a gallery visitor on mobile devices, I want the mobile Overview list to reorder in sync when I change the sort dimension, so that I always see a consistent ordering across the screen.
2. As a gallery visitor, I want clicking an item in either the desktop or mobile Overview list to smoothly highlight the corresponding card and expand its detail bubble, so that I can explore my games effortlessly.
3. As a gallery visitor, I want clicking anywhere outside the active card, bubble, or Overview list to close the expanded bubble, so that the gallery stays clean and uncluttered.
4. As a gallery visitor, I want switching sort dimensions to automatically close any active bubble and clear sidebar highlights, so that the reordering process doesn't leave stale UI state behind.
5. As a blog maintainer, I want all client-side event coordination and DOM reordering logic to live in a single deep module, so that I don't have to debug cross-component race conditions across multiple inline script tags.
6. As a blog maintainer, I want UI template components to remain purely declarative without knowing each other's internal class names or DOM selectors, so that changing a selector in the sidebar does not break the gallery's outside-click handler.
7. As a tester, I want the client interaction coordinator to be initialized with container references or selectors, so that I can verify selection, expansion, and sorting behaviors through a single public interface.

## Implementation Decisions

- **新增模块**：建立专职的客户端交互协调器模块（Gallery Coordinator），提供单一的初始化入口 `initGalleryCoordinator`。
- **状态收敛**：协调器内部集中维护当前选中游戏标识与当前激活排序维度两项状态，成为画廊交互的唯一事实源。
- **DOM 引用管理**：协调器在初始化阶段一次性完成卡片网格、桌面列表行与移动端列表行的映射索引，消除两处组件各自定义的映射表副本。
- **消除越界选择器**：外部点击关闭气泡的判断逻辑封装在协调器内部，协调器感知自身纳管的全部根容器，卡片组件不再直接硬编码查询侧边栏的私有选择器。
- **补全移动端同步**：排序分发逻辑直接在协调器内部按预计算顺序依次调整网格、桌面列表与移动端列表的 DOM 子节点顺序，确保三处展示永远同步。
- **组件退化为纯模板**：画廊组件、桌面 TOC 组件与移动端 TOC 组件删除各自约 30-50 行的内联脚本监听，仅输出静态 DOM 并统一调用协调器入口。
- **领域术语保持**：严格遵循 CONTEXT.md 规范，继续使用 游戏画廊 (Gallery)、Overview 列表 (Overview list)、游戏数据 (SteamGame)。

## Testing Decisions

- **好测试的标准**：只测外部行为——给定用户点击卡片/列表项或触发排序选择，观察对应的 DOM 节点是否获得激活类名、气泡是否展开、三个容器的子节点顺序是否按预期重排；不测协调器内部私有函数实现。
- **测试模块**：客户端交互协调器模块。
- **测试先例**：项目中现有的 pure assertion 风格测试；由于涉及 DOM 操作，可结合轻量 jsdom / happy-dom 环境或通过端到端页面回归验证。
- **架构缝**：协调器模块在 DOM 容器挂载层建立单一接缝。

## Out of Scope

- 不修改现有的排序算法逻辑与权重规则（已由词汇与数据模块保证）。
- 不改变气泡展开/折叠的 CSS 动画曲线与样式过渡。
- 不改动数据加载与服务端构建逻辑。

## Further Notes

- 该 Spec 为架构审查中的 Top Recommendation，能直接修复移动端 Overview 列表排序脱节的真实交互缺陷。
