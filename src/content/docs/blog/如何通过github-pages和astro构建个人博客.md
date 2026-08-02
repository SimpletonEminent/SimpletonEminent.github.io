---
title: "如何优雅地构建个人博客网站"
description: "Github pages+Astro构建博客和文章"
pubDate: "2026-08-02"
---

# 这也是我的第一篇博客！

今天天气真好，我用 **Markdown** 语法写下了这篇博客。

Astro 的格式真的非常整齐统一！

这里我默认你已经对Markdown语法，以及什么是Github有所认知，如果你拥有了合适的网络条件也可以跟着本文部署你的个人网站，本地开发环境需求如下：

1. **下载并安装 Node.js**
   * 前往[Node.js 官网](https://nodejs.org/)，下载并安装 **LTS（长期支持）版本**
2. **下载并安装代码编辑器**
   * 推荐下载免费的[VS Code (Visual Studio Code)](https://code.visualstudio.com/)。
3. **下载并安装 Git**（用于把本地文件上传到 GitHub）：
   * 前往 [Git 官网](https://git-scm.com/) 下载安装。*(如果你不喜欢命令行，也可以下载更直观的图形化工具 [GitHub Desktop](https://desktop.github.com/))。*

# 从零开始

---

首先介绍**github.io**，你可能经常看到很多人的博客是这种域名。

这是**GitHub** 官方提供的名为 **GitHub Pages** 的静态网页托管服务。你无需支付任何服务器费用或域名费用，就可以搭建并发布自己的个人网站。

一句话，**完全免费！**

官方文档：[什么是 GitHub Pages? - GitHub 文档](https://docs.github.com/zh/pages/getting-started-with-github-pages/what-is-github-pages)

其次介绍**Astro**，这是一种静态网站生成器。如果你发现别人的网站——那些格式高度统一、排版美观的网站，90% 以上都是使用静态网站生成器（Static Site Generators）配合 Markdown 语法写出来的。

这种方式的秘诀在于：你只需要用最简单的纯文本（Markdown）写文章内容，排版和设计全部交给工具和主题模板自动搞定。

[Astro 官方](https://astro.build/)的教程[部署你的 Astro 站点至 GitHub Pages](https://docs.astro.build/zh-cn/guides/deploy/github/)写的很详细，这种原生支持直接部署到 [GitHub Pages](https://pages.github.com/)的优势使得它非常适合用来制作你的个人网站。

# 开始本地构建

---

## 1/5：新建代码仓库

---

1. 登录你的 GitHub 账号
2. 点击右上角的 **`+`** 号，选择 **New repository**
3. 关键步骤：在 **Repository name**（仓库名称）中，输入 `你的GitHub用户名.github.io`（例如：如果你的用户名是 `zhangsan` ，仓库名必须填 `zhangsan.github.io` ）
4. 点击最下方的**Create repository** 创建仓库。

## 2/5：在本地电脑创建 Astro 项目

---

1. 在电脑上新建一个空文件夹（例如命名为 `my-blog`）。
2. 用 **VS Code** 打开这个文件夹。
3. 在 VS Code 顶部菜单栏点击 Terminal-> New Terminal，在下方弹出的命令行中输入以下命令并回车：

```npm
npm create astro@latest .
```

**(注意末尾有一个空格和点 `.`，代表直接在当前文件夹初始化)**

面对命令行向导的提示，这样选择：

How would you like to start?-> 选择 **Include sample files**（包含示例博客文件，这样格式最统一）。
Install dependencies?-> 选择 **Yes**
Initialize a new git repository?-> 选择 **Yes**

## 3/5：修改两个关键配置文件

---

项目生成后，在 VS Code 左侧的文件树里找到并修改以下两个文件：

1. 修改 `astro.config.mjs`（告诉 Astro 你的网站网址）
   打开它，把里面的代码修改为：

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 必须换成你自己在 GitHub 创建的网址
  site: 'https://zhangsan.github.io', 
});
```

2. 创建 GitHub Actions 指令说明书

* **在项目根目录下，新建文件夹结构：**`.github`，在里面新建 `workflows` 文件夹。
* 在 `workflows` 文件夹下新建一个名为 `deploy.yml` 的文件。
* **把以下官方推荐的自动化部署代码原封不动地复制粘贴**进去并保存：

```yaml
name: Deploy to GitHub Pages

on:
  # 每次推送到 `main` 分支时触发这个“工作流程”
  # 如果你使用了别的分支名，请按需将 `main` 替换成你的分支名
  push:
    branches: [ main ]
  # 允许你在 GitHub 上的 Actions 标签中手动触发此“工作流程”
  workflow_dispatch:

# 允许 job 克隆 repo 并创建一个 page deployment
permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout your repository using git
        uses: actions/checkout@v5
      - name: Install, build, and upload your site
        uses: withastro/action@v5
        # with:
          # path: . # 存储库中 Astro 项目的根位置。（可选）
          # node-version: 20 # 用于构建站点的特定 Node.js 版本，默认为 20。（可选）
          # package-manager: pnpm@latest # 应使用哪个 Node.js 包管理器来安装依赖项和构建站点。会根据存储库中的 lockfile 自动检测。（可选）
          # build-cmd: pnpm run build # 用于构建你的网站的命令。默认运行软件包的构建脚本或任务。（可选）
        # env:
          # PUBLIC_POKEAPI: 'https://pokeapi.co/api/v2' # 对变量值使用单引号。（可选）

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## 4/5：关联 GitHub 并一键推送

---

现在本地文件都准备好了，我们需要把它推送到你在网页端创建的那个空仓库里。

1. 回到你在网页上创建的 GitHub 仓库页面，复制那行仓库地址 `https://github.com/zhangsan/zhangsan.github.io.git`
2. **回到 VS Code 的终端，依次敲入以下命令（每行输完回车）：**

```bash
# 1. 把本地所有文件打个包准备好
git add . 
# 2. 记录这次提交的信息
git commit -m "首次部署博客"
# 3. 关联你的远程 GitHub 仓库 
git remote add origin https://github.com/zhangsan/zhangsan.github.io.git
# 4. 把代码推送到 GitHub
git push -u origin main
```

(首次推送时，电脑可能会弹窗要求你登录或授权 GitHub 账号，按提示登录即可)

## 5/5：在 GitHub 网页端开启开关

---

* 打开你的 GitHub 仓库网页，点击顶部的 `Settings`
* 在左侧栏找到 `Pages`
* 在 `Build and deployment`区域，找到 `Source`
* **关键：** 将默认的 `Deploy from a branch` 改为 `GitHub Actions`

# 以后日常怎么在本地新建、修改文章并更新网站

---

当你的本地项目和 GitHub 自动化部署配置完成后，你以后的日常写作和更新网站的流程会变得无比简单和机械化。

你不需要写任何代码，只需要记住 **“写文章 -> 本地预览 -> 一键推送”** 这三步走战略。

#### 第一步：新建与编写文章（原材料准备）

1. 用**VS Code** 打开你的博客项目文件夹。
2. 在左侧文件树中，找到 **`src/content/blog/`** 目录。
3. 在这个目录下新建一个以 `.md` 结尾的文件（例如：`my-first-trip.md`）。
4. **关键步骤（Frontmatter 配置）：**
   在文章的最顶部，必须用两组三个减号 `---` 包裹文章的“元数据”（标题、日期等），格式必须高度统一。你可以直接复制并修改以下内容：
   ```markdown
   ---
   title: "我的第一次 Astro 旅行"
   description: "记录我第一次使用 Astro 框架写博客的经历。"
   pubDate: "2026-08-02"
   heroImage: "../../blog-placeholder-about.jpg"
   ---
   
   # 这里开始写你的正文内容
   
   今天天气真好，我用 **Markdown** 语法写下了这篇博客。
   Astro 的格式真的非常整齐统一！
   ```

#### 第二步：本地预览（大厨尝菜）

在把文章发到网上之前，你肯定想先看看排版对不对。

1. **在 VS Code 的终端里输入：**
   ```bash
   npm run dev
   ```
2. 按住 `Ctrl` 键并点击终端里输出的网址 `http://localhost:4321/`（或者直接在浏览器输入）。
3. **此时，你会发现你的新文章已经自动出现在了文章列表的最顶部**，排版完美。
4. **实时预览**：不要关闭浏览器和终端，直接在 VS Code 里改动文章内容并按 `Ctrl + S` 保存，浏览器里的画面会**秒速自动同步更新**。

---

#### 第三步：一键推送（Actions 自动炒菜发布）

当你对文章内容完全满意后，关闭本地预览（在终端按 `Ctrl + C` 退出），然后执行以下“无脑三连”命令，将文章推送到 GitHub：

```bash
# 1. 告诉 Git 把新写的文章加进待上传列表
git add .

# 2. 备注这次更新了什么内容
git commit -m "新增文章：第一次Astro旅行"

# 3. 把代码推送到 GitHub 云端
git push
```

接下来会发生什么？（静候 1 分钟）

当你敲完 `git push` 并看到进度条走到 100% 之后，你的工作就**彻底结束**了。

1. **GitHub Actions 自动接管**：GitHub 此时会默默派出一个云端机器人。它看到你写了一篇新文章，会自动用 Linux 服务器帮你把项目编译、打包成精美的网页。
2. **自动同步**：大约过 40 秒到 1 分钟，访问你的个人网址 `https://zhangsan/github.io`，你会发现新文章已经整整齐齐地挂在互联网上了。

# 一些善后工作

---

Astro有一些不太符合我个人习惯的排版方式，因此要搞一下微调
Q：为何我的md里面的换行，不会在Astro中体现，必须空一行才行
A：需要修改 Astro 的 Markdown 解析器配置。
Astro 默认使用 `remark` 驱动 Markdown。你可以通过安装一个名为 `remark-breaks` 的官方插件，让普通文本也支持单回车换行。
项目根目录运行命令安装插件 `npm install remark-breaks`
打开项目根目录的 `astro.config.mjs`，编辑为如下内容：

```javascript
import { defineConfig，fontProviders } from 'astro/config';
import remarkBreaks from 'remark-breaks'; // ➡️ 1. 引入插件

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkBreaks], // ➡️ 2. 注入到 Markdown 渲染流中
  },
});
```

Q：我有一段行内代码，在md中没换行，但是在Astro的预览页面中被截断换行了&Astro中不显示代码块中的换行
A：编辑 `src/styles/global.css`，底部添加如下内容：

```css
article code, p code {
  white-space: normal !important;
  word-break: keep-all !important;
  overflow-wrap: break-word !important;
}
pre, pre code {
  white-space: pre !important; 
  word-break: normal !important;
  overflow-wrap: normal !important;
}
```

Q：文章宽度太小
A：编辑 `src/styles/global.css`，编辑如下内容：

```
main, article, .prose, .content {
	width: 100% !important;           
	max-width: 70%;                   /*左右间距占比*/
	margin: auto;
	padding: 3em 1em;
}
```

---

本站基于开源框架 **Astro**和其组件**Starlight**搭建，托管于 **GitHub Pages**。
在此，特别感谢 **Gemini (AI)** 在本地环境配置、网络镜像调优及 CI/CD 自动化工作流规划中提供的全方位技术支持与陪伴。

