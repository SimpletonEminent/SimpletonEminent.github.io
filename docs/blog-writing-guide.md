# 博客文章书写规范

本博客基于 Astro + Starlight,文章位于 `src/content/docs/blog/`。本文档定义文章书写规范,确保所有文章结构一致、构建不报错。

## 文件命名

- 使用不带空格/`+` 的 slug(中文亦可,如 `如何通过github-pages和astro构建个人博客.md`)
- 长评建议用英文 slug + 下划线:如 `Phoenix_Wright_Ace_Attorney_Trilogy_review.md`
- **⚠️ 文件名不要用空格和 `+` 号**

## Frontmatter(必读)

**每个 md 文件开头必须有 `---` 包裹的 frontmatter,否则构建报错**:

```
[InvalidContentEntryDataError] docs/blog/xxx
title: Required
```

### 基础字段(推荐每篇都有)

```yaml
---
title: "文章标题"            # ✅ 必填,构建必需
description: "简短描述"      # ✅ 推荐,150-160 字最佳(用于搜索/卡片展示)
pubDate: "2026-08-15"       # ✅ 推荐,发布日期(不填则无日期显示)
---
```

### 内容控制字段

```yaml
---
template: "splash"        # 'doc'(默认,带侧边栏)或 'splash'(全宽无侧栏,适合首页)
draft: true               # 草稿:生产构建不发布,dev 模式可见
tableOfContents:
  minHeadingLevel: 2       # 该页 TOC 起止层级(覆盖全局配置)
  maxHeadingLevel: 3
hero:
  title: "大标题"          # 页面顶部大图 banner 区(类似首页效果)
  tagline: "副标题"
  image:
    alt: "..."
  actions:
    - text: "按钮文字"
      link: "/路径"
      variant: "primary"
pagefind: false            # 关闭该页搜索索引
---
```

### 导航/侧边栏字段

```yaml
---
sidebar:
  order: 1                # 侧边栏排序(升序)
  label: "自定义显示名"    # 侧边栏显示名称(默认用 title)
  hidden: true            # 从自动生成的侧边栏隐藏
  badge: "新"             # 侧边栏徽章(字符串)或 {text, variant}
  attrs:
    data-custom: "..."    # 侧边栏链接的 HTML 属性
---
```

### 编辑链接/更新日期字段

```yaml
---
editUrl: false            # 关闭该页"编辑此页"链接
                          # 或 editUrl: "https://github.com/..."(自定义编辑地址)
lastUpdated: 2026-08-15   # 手动指定最后更新日期(默认取 git 历史)
---
```

### 头部/页脚字段

```yaml
---
head:                     # 往该页 <head> 注入自定义标签
  - tag: "meta"
    attrs:
      name: "og:title"
      content: "自定义社交分享标题"
banner:
  content: "页面顶部公告横幅,支持 HTML"
---
```

### 上一页/下一页字段

```yaml
---
prev:                     # 自定义上一页链接
  link: "/games"
  label: "🎮 游戏画廊"
next: false               # 或禁用下一页按钮
---
```

### 自动注入字段(不要手写)

```yaml
---
minutesRead: "5 分钟"     # 阅读时间(remark-reading-time 插件自动注入)
words: 3000               # 字数(同上)
---
```

## 正文排版规范

- 用 `#`(h1)分大节、`##`(h2)分章节、`####`(h4)做子步骤
- 单回车 = 换行(已启用 remark-breaks 插件)
- 代码块用 ` ``` ` 包裹,可指定语言(npm → bash 别名已配置)

## 常用模板

### 普通博客文章

```markdown
---
title: "文章标题"
description: "简短描述"
pubDate: "2026-08-15"
---

# 大节标题

正文内容...

## 章节标题

内容...
```

### 游戏长评(带 hero banner)

```markdown
---
title: "游戏名:评测标题"
description: "一句话描述这篇评测"
pubDate: "2026-08-15"
sidebar:
  badge: "评测"
hero:
  title: "游戏名"
  tagline: "副标题/评分"
---

# 正文从这里开始

## 玩法

...
```

## 验证清单(写完自查)

- [ ] 文件以 `---` frontmatter 开头,包含 `title`
- [ ] 文件名无空格/`+`
- [ ] `npm run dev` 本地预览正常
- [ ] 长评发布后,在 `src/data/steam_annotations.json` 对应游戏填 `blog_url`
- [ ] **(游戏长评)** 在 `astro.config.mjs` 的「游戏评测」侧边栏组内追加该文章的 slug(手动嵌套组,见 ADR-0009)

## 常见错误

| 错误 | 原因 | 修复 |
|---|---|---|
| `[InvalidContentEntryDataError] title: Required` | md 缺 frontmatter 或无 title | 补 `--- title: "..." ---` |
| 文章不在侧边栏 | 无 `sidebar` 配置或未刷新 | 侧边栏自动生成,刷新即可 |
| 长评链接 404 | blog_url 路径与文件名不符 | 检查 `blog_url` 与 md 文件名一致 |
