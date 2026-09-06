# Spec: 游戏数据仓库与存储接缝 —— 解耦文件系统与消除测试副作用

> Triage label: `ready-for-agent`

## Problem Statement

游戏数据合并加载模块（`loadMergedGames`）目前紧密耦合于 Node 运行时的物理文件系统与工作目录的相对文件路径，并且内部使用了无导出重置钩子的模块级静态缓存。这种实现导致单元测试在验证"数据文件读取失败时的安全回退行为"时，不得不通过在磁盘上真实重命名数据文件（将生产数据文件改为 `.bak` 并在 `finally` 块中还原）这一具有破坏性文件副作用的手段来进行测试。同时，该数据模块还混合了 100 多行用于生成气泡 HTML 标签的字符串拼接逻辑，导致数据职责与前端呈现混淆。

## Solution

将游戏数据加载重构为深度的领域数据仓库模块（Game Data Repository），在数据源访问处引入存储适配器（Storage Adapter）接缝，生产环境默认使用基于文件系统的真实适配器，测试环境可直接注入内存适配器以模拟各种读取失败或边界数据，彻底消灭破坏性文件重命名测试。同时将气泡 HTML 标签的拼接逻辑从数据模块中剥离，交由专门的 UI 模板处理，使数据模块的接口纯粹聚焦于游戏领域实体的合并与排序。

## User Stories

1. As a developer, I want to test data loading error handling without mutating real data files on disk, so that my test suite is safe, non-destructive, and resilient to sudden process termination.
2. As a developer, I want the data repository to accept custom storage adapters or mock data providers, so that I can easily test edge cases (like empty lists, corrupted JSON, missing optional fields) in milliseconds.
3. As a developer, I want to reset or bypass memoized state during test runs, so that independent tests do not pollute each other's execution context.
4. As a maintainer, I want data loading and filtering logic to be cleanly separated from HTML markup string generation, so that changing the visual design of the bubble panel never touches domain data code.
5. As a maintainer, I want the repository to reliably produce merged game entities with consistent defaults and sorting, so that all consumers receive identical, validated data.
6. As a tester, I want to verify that corrupted annotations or achievement files fall back gracefully to safe defaults through a standard in-memory test seam.

## Implementation Decisions

- **抽象存储接缝**：定义抽象存储适配器接口（Storage Adapter），规范读取游戏数据文件、注释文件与成就文件的契约。
- **分离适配器实现**：提供文件系统适配器（生产默认）与内存存储适配器（测试与扩展使用），满足"两个适配器证实真实接缝"的设计原则。
- **仓库深度化**：数据仓库模块内部封装 JSON 解析容错、0 时长过滤、默认值填充、发布年份与成就数据关联以及构建期排序预计算，对外仅暴露获取合并数据与排序预设的精简接口。
- **支持缓存管理**：为仓库提供显式的实例隔离或重置选项，允许在同一进程中针对不同测试用例建立独立的加载周期。
- **剥离呈现逻辑**：将原先在数据模块中利用纯字符串拼接气泡 HTML 的呈现函数移出，交回组件层，使数据模块接口与实现完全脱离 HTML 语法细节。
- **领域术语保持**：继续使用 数据文件 (games data)、注释文件 (annotations)、游玩时长 (Playtime)、游戏数据 (SteamGame)。

## Testing Decisions

- **好测试的标准**：只测外部行为——通过内存适配器注入正常、空、损坏的数据，断言仓库方法返回符合领域规则的合并列表及默认排序；断言读取失败时安全返回空数组；不测试适配器内部的读写细节。
- **测试模块**：游戏数据仓库模块。
- **测试先例**：现有的 `test-memoize.ts` 与 `test-play-status.ts`，消除 `test-memoize-fail.ts` 中的真实文件重命名黑魔法。
- **架构缝**：数据仓库与存储适配器之间的接口接缝。

## Out of Scope

- 不改变三份 JSON 数据文件的既有存储结构与语义。
- 不改动既有的 0 时长游戏过滤逻辑（保留画廊只展示玩过游戏的原则）。
- 不引入重型的第三方 ORM 或数据库依赖。

## Further Notes

- 本 Spec 解决核心模块在自动化测试时的不可靠性，将数据层的架构缝提升到最高级别。
