# 📝 我的极简博客

一个基于 **Astro + Starlight** 构建的个人博客网站,托管于 **GitHub Pages**。

> 🌐 在线访问:[https://SimpletonEminent.github.io/](https://SimpletonEminent.github.io/)

## ✨ 特点

- **Starlight 文档框架**:开箱即用的侧边栏导航、右侧目录、暗色模式
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

## 🚀 本地开发

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 http://localhost:4321/
npm run build      # 生产构建(含搜索索引)
npm run preview    # 预览生产构建
npx astro check    # 类型检查
```

## ✍️ 写文章指南

在 `src/content/docs/blog/` 下新建 `.md` 文件:

```markdown
---
title: "文章标题"
description: "一句话简介"
pubDate: "2026-08-02"
---

# 大章节标题

## 小章节标题

正文内容……
```

写完后本地预览确认排版,按下方「[提交与推送(手动流程)](#提交与推送手动流程)」发布(推送即上线)。

详细教程见博客文章
[《如何优雅地构建个人博客网站》](https://SimpletonEminent.github.io/blog/如何通过github-pages和astro构建个人博客/)。

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
├── astro.config.mjs        # Astro/Starlight 核心配置
├── ec.config.mjs           # 代码高亮别名配置
├── package.json            # 依赖与脚本
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions 自动部署
├── public/
│   └── favicon.svg         # 站点图标
└── src/
    ├── content.config.ts   # 内容集合配置
    ├── styles/
    │   └── theme.css       # 主题样式(强调色/排版)
    └── content/docs/
        ├── index.mdx       # 首页
        └── blog/           # 博客文章(.md)
```

## 🌐 部署

- 平台:GitHub Pages(个人主页站点,`SimpletonEminent.github.io`)
- 方式:推送 `main` 分支触发 [GitHub Actions](.github/workflows/deploy.yml) 自动构建部署
- 设置:仓库 `Settings → Pages → Source` 需选择 **GitHub Actions**
