# Spec: 交互式数据更新菜单 —— 统一管理手动数据更新脚本

> Triage label: `ready-for-agent`

## Problem Statement

在个人博客的日常维护与游戏画廊（Gallery）数据管理中，存在多达 6 个需要手动执行的数据更新脚本（包括补全中文名与发售日、抓取成就与全成就清单、批量预填游玩年份、单款游戏交互式打标评测、以及 CSV 表格的导出与导入）。目前这些脚本的调用方式极其分散：有些通过特定的 `npm run` 指令触发，有些需要通过 `node scripts/...` 执行，还有些依赖本地环境变量 `STEAM_API_KEY` 与 `STEAM_ID` 的预先注入。用户在经过一段时间后容易遗忘具体命令名称与运行参数，记忆成本高，且缺乏统一的操作总览与环境检查。

## Solution

设计并实现一个完全解耦的命令行交互式数据更新菜单（通过 `npm run updatedata` 触发）。菜单作为一个轻量级的子进程派发调度器（Process-isolated Task Runner），以清晰直观的编号选项呈现所有可选的手动作业脚本。用户进入后只需输入数字即可调起对应任务；脚本执行完毕后自动暂停并提示返回主菜单，形成交互闭环；调度器在执行依赖 API 密钥的任务前进行环境自检；底层各脚本保持 100% 独立解耦，未来新增、修改或移除作业脚本仅需更新声明式清单，无需侵入或重构菜单核心代码。

## User Stories

1. As a blog maintainer, I want to run a single command `npm run updatedata`, so that I can see a categorized list of all available manual data maintenance tasks in one place.
2. As a blog maintainer, I want to execute any data update script simply by typing its corresponding number, so that I don't need to remember specific script file paths or command options.
3. As a blog maintainer, I want the menu to prompt me to press any key to return to the main menu after a script finishes executing, so that I can continue with subsequent chain operations without restarting the runner.
4. As a blog maintainer, I want an obvious option (e.g. `0`) or `Ctrl+C` to cleanly exit the menu, so that I can return to the terminal prompt whenever I'm done.
5. As a blog maintainer, I want the runner to check for required environment variables (`STEAM_API_KEY` and `STEAM_ID`) before dispatching scripts that need them, so that I get helpful guidance instead of a sudden crash.
6. As a blog maintainer, I want existing direct npm scripts (like `npm run review` or `npm run json-to-csv`) to remain functional alongside the menu, so that my muscle memory and script-based documentation remain valid.
7. As a developer, I want the task list to be defined as a clean declarative array of items (specifying key, title, description, command/script path, and environment prerequisites), so that adding, editing, or deleting a task takes less than 5 lines of configuration.
8. As a developer, I want each manual task to execute in an isolated child process with inherited standard I/O, so that sub-process exits or errors cannot crash the main interactive runner.
9. As a tester, I want the menu parser and task dispatcher to be testable via non-TTY streams and mock runners, so that input routing and error handling can be automated in the test suite.

## Implementation Decisions

- **新增模块**：创建独立的交互式数据调度器模块（Interactive Data Updater CLI），并在 `package.json` 中配置快捷命令 `"updatedata": "node --experimental-strip-types scripts/update-data.ts"`（或 `.mjs`）。
- **进程隔离派发架构**：菜单调度器采用 `child_process.spawn(..., { stdio: 'inherit' })` 方式调用具体脚本。所有底层任务在独立进程中运行，保留原汁原味的 TTY 交互、彩色输出与退出码传播，不引入内存态代码耦合。
- **声明式任务清单**：任务列表采用纯配置对象数组进行声明，每项包含数字键、操作名称、业务时机描述、执行目标脚本/命令、以及是否需要环境变量标记。
- **循环交互与平滑恢复**：主菜单基于 Node.js 原生 `readline` 实现。任务执行完毕（无论成功还是非零码退出）后，展示明确的分隔符并暂停等待回车/按键，随后清屏或刷新重新呈现主菜单。
- **环境变量自检**：对于标记了需要 Steam API 凭证的任务（如成就检查），在派发前检查 `process.env.STEAM_API_KEY` 与 `STEAM_ID`；若缺失，提示用户通过环境变量、临时输入或 `.env` 补充，避免直接退出。
- **双轨制兼容**：保留 `package.json` 中已有的 `json-to-csv`、`csv-to-json`、`fill-play-year`、`review` 等快捷指令，两套入口完全互通。
- **领域术语保持**：严格遵循 CONTEXT.md 规范，继续使用 数据同步 (Sync)、游戏数据 (SteamGame)、注释文件 (annotations)、游玩状态 (Play Status)。

## Testing Decisions

- **好测试的标准**：只测外部行为——输入对应的数字选项，验证调度器能否正确解析并组装待执行的子进程参数；验证非法输入（如非数字、超范围字符）时能否给出优雅的警告提示而不退出；验证环境变量检测在缺失与存在时的正确拦截行为。
- **测试模块**：交互式数据调度器的选项路由与环境检测模块。
- **测试先例**：项目中现有的 `test-play-status.ts` 与 `test-gallery-coordinator.ts`。
- **架构缝**：任务清单解析与子进程派发接口之间的解耦接缝。

## Out of Scope

- 不修改 6 个底层脚本的内部业务算法和文件写入逻辑。
- 不改动 GitHub Actions 每日自动抓取工作流（`update-steam-data.yml`）。
- 不引入重型的第三方 CLI 框架（如 Commander、Inquirer），保持轻量零外部依赖。

## Further Notes

- 该功能将作为博客数据维护的总控台（Mission Control），彻底解决手动维护工具碎片化的问题。
