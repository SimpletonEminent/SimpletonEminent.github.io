# 📝 我的极简博客

一个基于 **Astro + Starlight** 构建的个人博客网站，托管于 **GitHub Pages**，记录技术学习、生活感悟与游戏评测。

> 🌐 在线访问：[https://SimpletonEminent.github.io/](https://SimpletonEminent.github.io/)

## ✨ 核心内容与特性

- **📖 技术与生活博客**：记录前端、AI 工具、效率工作流等技术实践，以及生活随笔；设立 `/blog/` 文章总览独立门户与时间线归档，支持文章标签、双日期展示与预计阅读时长。
- **🎮 Steam 游戏画廊**：Notion 画廊风格全宽卡片网格，展示个人游戏库，自动化同步游玩时长与成就进度，支持双向目录高亮联动与多维动态排序。
- **📝 深度游戏评测**：侧边栏「游戏评测」镜像独立子组，配有专属视觉 Hero 横幅与评测徽章，游戏类型标签自适应动态继承，支持反向锚点无缝直达画廊卡片。
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
git diff                 # 核对代码与数据改动差异
```

### 3. 提交与推送

```bash
git add .
git commit -m "feat: 补充新文章/更新内容"
git push
```

## 📦 项目结构概要

本项目采用标准 Astro + Starlight 架构，遵循最小隐私暴露原则，公开的核心模块结构如下：

```
my-blog/
├── astro.config.mjs        # Astro 与 Starlight 核心配置
├── package.json            # 项目依赖与开发脚本
├── .github/workflows/      # 自动化 CI/CD 工作流 (自动构建部署与数据抓取)
├── public/                 # 静态资源与运行时数据源
├── scripts/                # 自动化运维与测试脚本
└── src/
    ├── components/         # 页面看板与画廊交互组件
    ├── content/docs/       # Markdown/MDX 博文与页面内容
    ├── data/               # 结构化数据源
    ├── lib/                # 核心逻辑、数据处理与客户端协调器
    └── styles/             # 主题与全局样式
```

> 💡 架构设计决策记录 (ADR)、特性设计规范 (Specs) 与深层目录说明维护于本地私有文档体系中，不入库公开。

## 🌐 部署

- 平台：GitHub Pages (`SimpletonEminent.github.io`)
- 方式：推送 `main` 分支触发 GitHub Actions 自动构建部署
- 设置：仓库 `Settings → Pages → Source` 选择 **GitHub Actions**
