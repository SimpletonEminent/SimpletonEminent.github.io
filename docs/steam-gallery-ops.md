# Steam 游戏画廊操作指南

## 手动操作清单(一键速查)

> 下表列出**需要你亲自执行**的操作。未列出的(如每日时长同步)全部自动,无需干预。

| 时机 | 操作 | 命令/位置 | 耗时 |
|---|---|---|---|
| 买了新游戏后 | 补中文名/genres/发售日期 | 项目根目录运行 `node scripts/enrich-metadata.mjs` | 几分钟 |
| 想更新成就进度 | 重查成就完成率/全成就 | 项目根目录运行 `node scripts/check-achievements.mjs`(需配置环境变量) | 约 5 分钟 |
| 想预填游玩年份 | play_year 改为 Steam 最后运行年份 | 项目根目录运行 `npm run fill-play-year`(覆盖已有值) | 秒级 |
| 随时 | 标注通关状态/写短评/补特色标签 | 编辑注释文件(见下方第 4 节) | 按需 |
| 写了长评后 | 在注释文件填 `blog_url` | 编辑注释文件 | 按需 |
| 部署/推送 | 提交并推送代码 | 常规 git 提交流程 | 1 分钟 |

**完全自动、无需操作**:每日时长同步(GitHub Actions cron)、线上部署、失败时保留旧数据。

---

## 数据管线

游戏画廊的数据由三部分组成,职责严格分离(见 ADR-0002/0005/0006):

| 文件 | 内容 | 谁写 | 何时更新 |
|---|---|---|---|
| `public/steam_games.json` | 自动数据:appid、英文名、总时长、近两周时长、封面 | `scripts/fetch-steam-games.mjs`(GitHub Actions 每日 cron) | 每日自动 |
| `public/steam_achievements.json` | 成就数据:每款游戏的 unlocked/total 进度 | `scripts/check-achievements.mjs`(手动) | 手动按需 |
| `src/data/steam_annotations.json` | **元数据 + 手写数据**:中文名、tags、通关状态、短评、长评链接、游玩年份、平台、发售日期 | 自动部分:`enrich-metadata.mjs`;手写部分:你自己编辑 | 按需 |

## 日常操作

### 1. 每日同步(自动,无需操作)

GitHub Actions 每天 UTC 02:00(北京 10:00)运行 `update-steam-data.yml`:
- 调 Steam API 抓时长 → 覆盖 `public/steam_games.json`
- 提交并触发重新部署 → 线上画廊更新
- 失败时保留上一次成功数据,线上不受影响

### 2. 手动抓取最新时长(可选)

> **进入项目根目录**后执行(所有脚本都从项目根目录运行):

```powershell
# 先配置环境变量(secret 值来自 GitHub Actions Secrets 中的同名变量)
$env:STEAM_API_KEY = '<你的key>'        # 与仓库 Secrets 中的配置保持一致
$env:STEAM_ID = '<你的SteamID64>'
node scripts/fetch-steam-games.mjs
```

> **本机 TLS 注意**:若 Node 报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`(本机证书链不完整,PowerShell 能通但 Node 不通),加 `$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'` 后运行。**GitHub Actions 环境无此问题,此变量仅本地调试用。**

### 3. 元数据丰富(手动,新游戏入库时)

买了新游戏后,它的中文名 / genres 标签 / 发售日期需要补一次:

```powershell
node scripts/enrich-metadata.mjs
```

- **增量式**:已有 `name_zh` / `tags` / `release_date` 的条目自动跳过,只处理缺失的(新游戏)
- 每请求间隔 1.6s(限流保护),几十款新游戏约几分钟
- 重复运行安全,不会覆盖你手写的 tags
- 完成后本地验证,或直接推线上

### 3.5 一次成就检查(手动,更新成就进度/标记全成就用)

想知道哪些游戏已达成 100% 全成就、或刷新成就进度时:

```powershell
# 先配置环境变量(同第 2 节)
node scripts/check-achievements.mjs
# 可选:只检查单款(快速验证) node scripts/check-achievements.mjs --appid=1172470
```

- 逐款调用成就接口,按 `achieved` 统计解锁/总数
- 完整结果写入 `public/steam_achievements.json`(含 `unlocked`/`total`/`perfect`)
- 控制台会单独打印「全成就候选」清单,核对后到注释文件标 `my_status: "perfect"`
- 属一次性/手动工具,不进每日同步链路,不触碰注释文件

### 4. 手写注释(通关状态/短评/tags 特色词/长评链接)

**推荐方式:表格化批量编辑(数百款游戏时)**
1. 项目根目录运行 `npm run json-to-csv` → 生成 `steam.csv`(UTF-8,Excel/WPS 打开中文不乱码)
2. 用 Excel/WPS 打开,表格含列:appid(只读)/ 游戏名(只读)/ 通关状态 / 短评 / 长评链接 / 游玩年份 / 平台 / 特色标签
3. 批量填充:通关状态列直接下拉选(未通关/已通关/全成就),平台列下拉选(PC/PlayStation/Xbox/Switch),特色标签用分号分隔(如 `魂系;开放世界`)
4. 填完保存为 CSV(UTF-8),放回项目根目录,运行 `npm run csv-to-json` → 合并写回注释文件

**表格化安全机制**:只认已知 appid(新增行忽略)、非法状态回退未通关、自动字段(中文名/发售日期)永不触碰。`steam.csv` 是工作文件,已 gitignore 不入库。

**手动单条编辑**(少量游戏时):直接编辑 `src/data/steam_annotations.json`,按 appid 键添加:

```json
{
  "570": {
    "name_zh": "刀塔2",                    // 自动(enrich),可手动改
    "tags": ["MOBA", "竞技", "联机对战"],   // 自动填充 genres,可追加特色词(魂系/肉鸽等)
    "my_status": "completed",               // 手写:uncompleted / completed / perfect
    "my_review": "你的短评",                // 手写,空则不显示
    "blog_url": "/blog/dota2-review",       // 手写,长评路由
    "play_year": "2013",                    // 手写,游玩年份
    "platform": "PC",                       // 手写
    "release_date": "2013 年 7 月 9 日"      // 自动(enrich),不要手写
  }
}
```

**关键原则**:每日同步脚本**永不触碰**此文件。你的手写数据(通关状态/短评/tags 特色词/长评链接/游玩年份)丢不得,自动脚本也不会动它们。

### 画廊显示规则

- **0h 游戏不显示**:`playtime_hours <= 0` 的游戏(没玩过)被共享数据模块过滤,不出现在画廊和 Overview 列表。只有玩过的游戏才展示。
- **成就进度行**:有成就系统的游戏在气泡内显示进度条(如 `26% (77/293)`),全成就显示 `100% 🏆`,无成就系统隐藏该行。
- **多维排序**:画廊顶部下拉框支持 4 种排序——总时长、近期运行(按 Steam 最后运行日期)、通关进度(全成就 > 已通关 > 未通关)、发售年份。切换时卡片与右侧列表同步重排。
- **右侧列表独立滚动**:列表固定高度内自行滚动,不撑长整页;左侧卡片墙全宽铺满。
- 过滤与排序在共享数据层(`loadMergedGames` + `sortGames`)统一执行,画廊与右侧列表行为一致。

### 5. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 画廊空/数据旧 | 同步失败(API key 失效/Steam 隐私没公开) | 查 Actions 日志;确认 Steam「游戏详情」隐私设为 Public |
| tags 是官方大类(动作/策略) | enrich 只抓 genres | 手动在注释文件追加特色词(魂系/开放世界/肉鸽) |
| 卡片/气泡无背景(暗黑模式透明) | 组件曾误用 `--sl-color-gray-7`(暗黑不存在) | 已修复用 gray-6,不要改回 |
| 中文名缺失 | enrich 未跑或该游戏无商店页 | 重跑 enrich |
| 某游戏无发售日期(`无详情数据,跳过`) | 该游戏在国区(cc=cn)被锁区,appdetails 返回 success:false | 属正常现象;enrich 重跑时可用 `cc=us` 变体手动补(脚本默认 cn,锁区游戏如部分 Paradox 作品无法通过国区接口获取) |
| 成就进度不更新 | 成就数据是静态文件,不会每日同步 | 重跑 `check-achievements.mjs` 刷新 |

## 数据流全景

```
Steam Web API ──每日──▶ fetch-steam-games.mjs ──▶ public/steam_games.json(自动)
Steam Web API ──手动──▶ check-achievements.mjs ──▶ public/steam_achievements.json(成就进度)
Steam Store API ──按需──▶ enrich-metadata.mjs ─┐
                                                ├─▶ src/data/steam_annotations.json(元数据+手写)
你手写(通关/短评/tags/blog)──────────────────────┘
                                   │ 构建期合并(loadMergedGames)
                                   ▼
                           SteamGallery.astro + GamesTableOfContents.astro
```
