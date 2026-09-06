# 📝 我的极简博客

一个基于 **Astro + Starlight** 构建的个人博客网站，托管于 **GitHub Pages**，记录技术学习、生活感悟与游戏评测。

> 🌐 在线访问：[https://SimpletonEminent.github.io/](https://SimpletonEminent.github.io/)

## ✨ 核心内容与特性

- **📖 技术与生活博客**：记录前端、AI 工具、效率工作流等技术实践，以及生活随笔；支持文章标签、发布/更新时间与阅读时长展示。
- **🎮 Steam 游戏画廊**：Notion 画廊风格全宽卡片网格，展示个人游戏库，自动化同步游玩时长与成就进度，支持双向目录高亮联动与多维动态排序。
- **📝 深度游戏评测**：侧边栏聚合专属游戏评测长评，配有专属视觉 Hero 横幅与评测徽章，游戏类型标签自适应动态继承。
- **🔍 内置全文搜索**：基于 Pagefind 的静态极速搜索，零后端服务依赖。
- **🌙 明暗模式原生自适应**：支持跟随系统或手动切换主题，全站定制优雅的 Teal 强调色。
- **🚀 现代化自动化运维**：每日 GitHub Actions 定时同步游戏数据，推送 `main` 分支全自动构建部署生效。

## 🛠 技术栈

| 技术 | 说明 |
|---|---|
| [Astro](https://astro.build/) | 现代静态网站生成器 (v7.x，需 Node ≥ 22.12) |
| [Starlight](https://starlight.astro.build/) | 官方优雅文档框架，开箱即用侧边栏与 TOC |
| [remark-breaks](https://github.com/remarkjs/remark-breaks) | Markdown 换行优化 |
| [Pagefind](https://pagefind.app/) | 纯前端静态全文搜索引擎 |
| GitHub Pages + Actions | 免费托管 + 自动化 CI/CD 部署 |

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

## ✍️ 写文章快速入门

在 `src/content/docs/blog/` 下新建 `.md` 文件：

```markdown
---
title: "文章标题"
description: "一句话简介"
pubDate: "2026-08-02"
tags:
  - "分类标签"
---

# 抓人眼球的开篇 Hook 句

---

## 章节标题

---

正文内容……
```

写完后本地预览确认排版，按下方「[提交与推送(手动流程)](#提交与推送手动流程)」发布（推送即上线）。

## 🔄 提交与推送(手动流程)

> **推送即上线**：GitHub Actions 会在 `main` 收到推送后自动构建部署，约 1 分钟后线上生效。

### 1. 提交前检查 (推荐)

```bash
npm test                 # 全量回归测试
npm run astro -- check   # 静态类型检查 (期望 0 errors)
npm run build            # 生产打包验证
```

### 2. 查看改动

```bash
git status               # 改动清单
git diff                 # 具体差异 (重点核对 src/data/steam_annotations.json)
```

### 3. 提交与推送

```bash
git add .
git commit -m "feat: 补充新文章/更新内容"
git push
```

## 📦 项目结构

```
my-blog/
├── astro.config.mjs        # Astro / Starlight 核心配置
├── ec.config.mjs           # 代码高亮别名配置
├── package.json            # 依赖与脚本
├── .github/workflows/      # GitHub Actions (自动部署 + 每日 Steam 时长抓取)
├── scripts/                # 数据同步、元数据丰富、成就检查与 CLI 控制台
├── public/                 # 静态资源 (favicon, steam_games.json, steam_achievements.json)
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
        └── blog/           # 博客文章 (.md)
```

## 🌐 部署

- 平台：GitHub Pages (`SimpletonEminent.github.io`)
- 方式：推送 `main` 分支触发 GitHub Actions 自动构建部署
- 设置：仓库 `Settings → Pages → Source` 选择 **GitHub Actions**
