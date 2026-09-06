# Steam 游戏画廊与日常运维手册

> 本指南记录 Steam 游戏画廊的数据管线、日常维护操作与故障排错。
> **💡 统一总控台**：日常维护推荐使用 **`npm run updatedata`** 交互式菜单一键调起各项操作，无需强记独立脚本命令。

---

## 一、日常操作核心流程

### 1. 自动流程（无需人工操作）
* **每日时长同步**：GitHub Actions 每日 UTC 02:00（北京 10:00）自动运行 `update-steam-data.yml`，调用 Steam Web API 抓取游戏总时长及近两周时长，并自动提交推送与重新部署（失败时保留上一次成功数据）。

### 2. 手动流程（交互式控制台，推荐）
在项目根目录运行：
```bash
npm run updatedata
```
进入交互控制台后，输入对应编号即可一键调度：

| 编号 | 任务名称 | 触发时机与作用 | 前置依赖 |
|:---:|---|---|:---:|
| **[1]** | **丰富游戏元数据** (`enrich-metadata`) | **买了新游戏后执行**：增量爬取 Steam 官方接口，为新游戏自动补齐中文名（`name_zh`）、分类标签（`tags`）与官方发售日期（`release_date`）。不覆盖手写内容。 | 无 |
| **[2]** | **交互式录入单款评测** (`add-review`) | **单款游戏打标时执行**：终端交互菜单，快速打标游玩状态（六阶梯）、最高段位、短评、长评链接、游玩年份与平台。 | 无 |
| **[3]** | **预填游玩年份** (`fill-play-year`) | **批量维护年份时执行**：提取 Steam 最后运行时间自动填充 `play_year`（保护 `2021-2026` 等自定义区间年份不被覆盖）。 | 无 |
| **[4]** | **导出 CSV 表格** (`json-to-csv`) | **用 Excel/WPS 批量修改时执行（第 1 步）**：导出 `steam.csv`（UTF-8 BOM），支持下拉框与整表批量编辑。 | 无 |
| **[5]** | **导入 CSV 表格** (`csv-to-json`) | **表格修改完毕后执行（第 2 步）**：读取 `steam.csv`，清洗校验后安全写回注释文件。 | 无 |
| **[6]** | **全量检查成就与首次游玩估算** (`check-achievements`) | **刷新成就进度或标记全成就时执行**：逐款抓取成就解锁率，更新 `steam_achievements.json` 并推算首次游玩估算时间戳。 | `STEAM_API_KEY`<br>`STEAM_ID` |
| **[7]** | **手动拉取最新时长** (`fetch-steam-games`) | **刚打完想立即在本地看效果时执行**：立即抓取最新拥有游戏与时长。 | `STEAM_API_KEY`<br>`STEAM_ID` |
| **[0]** | **退出** | 退出控制台返回系统终端。 | 无 |

*注：若执行需要 Steam 凭据的任务（6 或 7），控制台会自动读取根目录下未入库的 `.env` 文件；若未配置，会自动弹出交互式临时输入引导。*

---

## 二、数据管线架构 (Data Pipeline)

画廊数据分为三大层次，职责严格正交分离（参见 ADR-0002 / 0005 / 0006）：

```
Steam Web API ──每日定时──▶ public/steam_games.json (自动数据: appid, 英文名, 时长, 封面)
Steam Web API ──按需执行──▶ public/steam_achievements.json (成就数据: 解锁数/总数, 最早解锁时间)
Steam Store API ──按需执行──▶ src/data/steam_annotations.json (元数据 + 人工手写数据)
人工手写标记 ──npm run updatedata──┘
                                │ 构建期合并 (loadMergedGames, 模块级单例缓存)
                                ▼
               SteamGallery.astro + GamesTableOfContents.astro
```

1. **`public/steam_games.json`（自动数据）**：
   - 由同步脚本自动生成，记录拥有游戏、封面、总时长与近两周时长。
2. **`public/steam_achievements.json`（成就数据）**：
   - 记录每款游戏的成就解锁数与最早解锁时间戳（`firstUnlockAt`，即画廊「首次游玩(估)」的数据来源，参见 ADR-0008）。
3. **`src/data/steam_annotations.json`（手工注释文件）**：
   - 保存不可再生的人工资产：中文名、标签、六阶梯游玩状态、最高段位、短评、长评链接、游玩年份、发售日期。
   - **核心纪律**：任何自动化脚本**永不覆盖**已有的人工手写字段。

---

## 三、画廊展示与交互规范速查

- **0h 游戏自动过滤**：总时长为 0 的游戏在数据装载层自动忽略，画廊与 Overview 列表中仅展示真正游玩过的游戏。
- **六阶梯游玩状态徽章**：
  - `uncompleted`（未通关，灰）
  - `completed`（已通关，蓝）
  - `perfect`（全成就，金）
  - `ongoing`（持续游玩，浅紫）
  - `hiatus`（暂退长草，草绿）
  - `retired`（已退役，暗灰）
- **段位双徽章规则（ADR-0007）**：游玩状态徽章永远显示；若填写了 `my_rank`（最高段位），则并排追加段位徽章（翡翠绿带边框），段位只追加、绝不顶替游玩状态。
- **成就进度行**：有成就系统的游戏在展开的气泡内显示进度条（如 `26% (77/293)`），达到 100% 显示 `100% 🏆`。
- **首次游玩(估)**：位于气泡底部元数据行，格式为 `YYYY-MM-DD`（北京时间）。无成就数据时自动隐藏。
- **多端同步联动（ADR-0004 / Spec 05）**：卡片网格、桌面端 Overview 列表与移动端 Overview 列表由统一的客户端协调器（`gallery-coordinator.ts`）联动，排序与高亮状态在三处永远保持同步。

---

## 四、代码提交与推送

数据更新或文章撰写完成后，代码的提交与发布流程请严格查阅 **[README.md#提交与推送手动流程](../README.md#提交与推送手动流程)**。

提交前请确保运行质量检查：
```bash
npm test                 # 全量自动化测试 (期望 100% pass)
npm run astro -- check   # 静态类型检查 (期望 0 errors)
npm run build            # 生产环境打包验证
```

---

## 五、常见问题与排错 (FAQ)

| 现象 | 根因分析 | 推荐处理方案 |
|---|---|---|
| 画廊无数据或数据显示很旧 | 自动同步失败或 Steam 账号隐私未设为公开 | 检查 GitHub Actions 运行日志；确认 Steam 个人资料中「游戏详情」设为 Public。 |
| 新游戏缺少中文名或发售日 | 该游戏刚入库，未抓取商店元数据 | 运行 `npm run updatedata` 并选择 `[1]`（丰富游戏元数据）。 |
| 某些游戏提示 `无详情数据,跳过` | 游戏在 Steam 国区（`cc=cn`）锁区或无商店页 | 属正常现象；可在 `steam_annotations.json` 中手动填写 `name_zh` 与 `release_date`。 |
| 成就进度未跟随日常更新 | 成就数据为静态抓取文件，不属于每日定时同步链路 | 运行 `npm run updatedata` 并选择 `[6]`（全量检查成就进度）刷新。 |
| 本地 Node 报证书错误 | 本地 Windows 证书链不全（`UNABLE_TO_VERIFY_LEAF_SIGNATURE`） | 本地临时运行 `$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'`（GitHub Actions 无此问题）。 |

---

## 附录：独立命令行备查（高级）

如果不想进入交互控制台，原有的独立命令仍可直接在终端中运行：
- 单款快速评测：`npm run review`
- 导出 CSV 表格：`npm run json-to-csv`
- 导回 CSV 表格：`npm run csv-to-json`
- 批量预填年份：`npm run fill-play-year`
- 单独检查单款游戏成就：`node scripts/check-achievements.mjs --appid=1172470`
