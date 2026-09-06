# 📝 我的极简博客

一个基于 **Astro + Starlight** 构建的个人博客网站,托管于 **GitHub Pages**。

> 🌐 在线访问:[https://SimpletonEminent.github.io/](https://SimpletonEminent.github.io/)

## ✨ 特点

- **Starlight 文档框架**:开箱即用的侧边栏导航、右侧目录、暗色模式
- **🎮 Steam 游戏画廊**:Notion 风格卡片网格，自动同步 Steam 游玩时长与成就进度，支持双向高亮与多维排序
- **内置全文搜索**:Pagefind 静态搜索,零后端依赖
- **Markdown 写作**:纯文本写文章,排版交给主题
- **全自动部署**:推送即发布,GitHub Actions 自动构建
- **teal 强调色主题**:自定义 CSS 覆盖默认配色

## 🛠 技术栈

| 技术 | 说明 |
|---|---|
| [Astro](https://astro.build/) | 静态网站生成器(v7.x,需 Node ≥ 22.12) |
| [Starlight](https://starlight.astro.build/) | Astro 官方文档框架 |
| [remark-breaks](https://github.com/remarkjs/remark-breaks) | Markdown 单回车换行 |
| [Pagefind](https://pagefind.app/) | 内置静态全文搜索 |
| GitHub Pages + Actions | 免费托管 + 自动部署 |

## 🚀 常用开发命令

```bash
npm install            # 安装依赖
npm run dev            # 启动本地热更新服务器 http://localhost:4321/
npm run updatedata     # 🎮 启动手动数据更新控制台 (Mission Control)
npm test               # 自动化回归测试 (期望 100% PASS)
npm run astro -- check # 静态类型检查 (期望 0 errors)
npm run build          # 生产构建 (含 Pagefind 搜索索引)
npm run preview        # 预览生产构建
```

## 📚 文档与工程指引（遵循最小暴露隐私原则）

本项目遵循**“最小暴露隐私”**原则：
- **网站公开内容**：仅包含 `src/content/docs/blog/` 下的公开博客文章与公开画廊页面。
- **内部工程文档**：架构决策记录（ADRs）、功能演进规范（Specs）、内部运维手册与写作规范等指引性文档完整保存在本地工作区（`docs/` 与 `CONTEXT.md`），已配置在 `.gitignore` 中，不向公共仓库公开暴露。

### 🧑‍💻 给人看的操作说明（本地存放在 `docs/`）
- 📝 **博客文章写作与排版规范** (`docs/blog-writing-guide.md`)：写新文章时的排版指南、写作风格指纹、frontmatter 极简 3 字段铁律与发布前自查清单。
- 🎮 **Steam 游戏画廊日常运维手册** (`docs/steam-gallery-ops.md`)：以 `npm run updatedata`（Mission Control）控制台为主线的实操指南、数据管线与 FAQ 排错。
- 🔄 **代码提交流程与检查门禁**：详见下方[提交与推送(手动流程)](#提交与推送手动流程)。

---

### 🤖 给 Agent 看的规范契约（本地存放在 `docs/` 与 `CONTEXT.md`）
- 🏛️ **领域术语表** (`CONTEXT.md`)：【唯一领域语言】规定核心业务名词与严格的 Avoid 禁忌词清单。
- 💻 **工程与编码规范** (`docs/coding-standards.md`)：【工程编码纪律】TypeScript 严格类型（零容忍 `as any`）、单源化架构契约与黑盒测试准则。
- 🏛️ **架构决策记录** (`docs/adr/0001-0009`)：【不可随意推翻的架构底线】记录样式、定时同步、数据/注释分离、六阶梯段位、客户端协调器等设计决策。
- 🗺️ **功能演进规范库** (`docs/specs/01-10`)：【任务开发 Spec】为每个 issue 开发提供标准 User Stories、实现决策与测试接缝。

## ✍️ 写文章快速入门

在 `src/content/docs/blog/` 下新建 `.md` 文件（详见本地 `docs/blog-writing-guide.md`）:

```markdown
---
title: "文章标题"
description: "一句话简介"
pubDate: "2026-08-02"
---

# 抓人眼球的开篇 Hook 句

---

## 章节标题

---

正文内容……
```

写完后本地预览确认排版,按下方「[提交与推送(手动流程)](#提交与推送手动流程)」发布(推送即上线)。

## 🔄 提交与推送(手动流程)

> **推送即上线**:GitHub Actions 会在 `main` 收到推送后自动构建部署,约 1 分钟后线上生效。提交前确认改动无误,推送前再想一遍。

### 1. 提交前检查(推荐)

```bash
npm test                 # 回归测试(徽章规则 / 游玩年份格式)
npm run astro -- check   # 类型检查(期望 0 errors)
npm run build            # 生产构建
```

### 2. 查看改动

```bash
git status               # 改动清单
git diff                 # 具体差异(重点核对 src/data/steam_annotations.json 的手写数据)
```

### 3. 提交

按主题**分开提交**(避免 `git add .` 一把梭),提交信息用中文,前缀标明类型:

```bash
git add src/data/steam_annotations.json    # 只改数据
git commit -m "Apex 英雄:补充段位铂金"

git add src/components/SteamGallery.astro  # 代码修复
git commit -m "fix(steam-gallery): 气泡徽章重复累积"
```

常用前缀:`feat`(新功能)/ `fix`(修复)/ `refactor`(重构)/ `chore`(杂务)/ `docs`(文档)。

### 4. 推送

```bash
git push
```

### 注意事项

- `src/data/steam_annotations.json` 是手写数据(游玩状态/段位/短评/游玩年份/平台),自动脚本永不触碰;提交前确认它就是你想上线的内容
- `steam.csv`、`dist/`、`tmp/`、`.playwright-cli/` 已在 `.gitignore` 中,不会也不该入库
- 改了脚本后先跑 `npm test`;改了画廊/样式后建议本地 `npm run dev` 肉眼确认
- 推错了:个人站点无协作者,直接改完再推一次即可;撤回用 `git reset --soft HEAD~1`(未推送)或 `git revert`(已推送)

## 📦 项目结构

```
my-blog/
├── astro.config.mjs        # Astro / Starlight 核心配置
├── ec.config.mjs           # 代码高亮别名配置
├── package.json            # 依赖与脚本
├── .github/workflows/      # GitHub Actions (自动部署 + 每日 Steam 时长抓取)
├── scripts/                # 数据同步、元数据丰富、成就检查与 CLI 控制台
├── public/                 # 静态资源 (favicon, steam_games.json, steam_achievements.json)
├── docs/                   # [本地不入库] 内部运维手册、ADR 决策、Spec 规格与编码规范
├── CONTEXT.md              # [本地不入库] 领域术语表 (Agent 唯一权威词汇模型)
└── src/
    ├── content.config.ts   # 内容集合配置
    ├── styles/theme.css    # 主题样式 (强调色 / 全局状态徽章颜色)
    ├── lib/
    │   ├── play-status.ts  # 游玩状态六阶梯唯一词汇模块
    │   ├── steam-data.ts   # 画廊数据合并与排序模块 (模块单例缓存)
    │   └── gallery-coordinator.ts # 画廊客户端交互协调器 (多端联动/排序)
    ├── data/
    │   └── steam_annotations.json # 人工手写注释 (状态/段位/短评/年份)
    └── content/docs/
        ├── index.mdx       # 首页 (Splash + 卡片)
        ├── games.mdx       # 游戏画廊页 (/games)
        └── blog/           # 博客文章 (.md，全站公开发布内容)
```

## 🌐 部署

- 平台:GitHub Pages(个人主页站点,`SimpletonEminent.github.io`)
- 方式:推送 `main` 分支触发 [GitHub Actions](.github/workflows/deploy.yml) 自动构建部署
- 设置:仓库 `Settings → Pages → Source` 需选择 **GitHub Actions**
