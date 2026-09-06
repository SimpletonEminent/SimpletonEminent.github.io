# 画廊交互采用卡片网格 + Overview 列表 + 点击气泡的主从联动

画廊页面由三部分组成:主体保持 Notion 风格卡片网格(悬停放大);右侧 Overview 目录列表一行一款游戏展示标题/通关状态/总时长,点击游戏名滚动定位并选中对应卡片;点击卡片在其正下方平滑展开气泡面板,以六行列表展示详情(中英文名、标签、通关状态、时长、短评、长评链接)。

原因:游戏数量多时右侧固定大面板会挤压版面,卡片下方 Accordion 展开兼顾视觉冲击与信息密度;Overview 列表作为快速定位入口解决"几百款游戏里找一款"的扫描问题;双向高亮让主从两侧始终同步当前选中项。移动端列表沉到网格下方堆叠展示。

## 修订记录

- **2026-09-06(客户端协调器单源化,Spec 05 / Issue #5)**: 卡片展开、桌面端与移动端 Overview 列表的双向联动高亮、外部点击关闭以及三处 DOM 的同步重排，由原先分散在 3 个 Astro 组件内的 window CustomEvents（`steam:select` / `steam:highlight` / `steam:sort`）与泄漏 DOM 选择器窥探，收敛为深度的客户端交互协调器模块 `src/lib/gallery-coordinator.ts`。补全了移动端 Overview 列表在排序切换时的 DOM 重排同步，各组件脚本清空退化为纯静态声明式模板。新增回归测试 `scripts/test-gallery-coordinator.ts`(`npm test`)。

