# 博客子分类「游戏评测」:采用手动嵌套侧边栏组

## 背景

用户希望在侧边栏「📝 博客」下新增一个「游戏评测」子分类,把游戏类长评文章聚合进去。实现前核实的两个硬约束:

1. **Starlight 自动生成的子目录组名无法自定义**。`autogenerate: { directory: 'blog' }` 会递归子目录并自动创建嵌套组,**组名就是目录名**(如 `game-reviews`,英文),配置层面改名。
2. **存在断链风险**。游戏画廊气泡通过 `src/data/steam_annotations.json` 的 `blog_url` 字段链接到评测文章。现有 5 处 `blog_url`(`tts_review`、`phoenix_wright_ace_attorney_trilogy_review`、`sekiro_review`、`djmax_review`、`sanabi_review`)指向这 5 篇评测的 `/blog/<slug>` URL;另 3 处(`dota2-review`、`rust-review`、`hoi4-review`)指向尚未写作的评测,说明用户仍在持续新增游戏评测。

## 决策

「游戏评测」子分类用**手动嵌套侧边栏组**实现,而**不**把评测文件挪入子目录:

1. **文件保持原位**:5 篇评测仍留在 `src/content/docs/blog/` 根目录,不挪入 `blog/game-reviews/` 等子目录。
2. **侧边栏手动列出**:`astro.config.mjs` 中「📝 博客」组改为手动 `items` 数组——2 篇顶层技术文章 + 一个 `label: '游戏评测'` 的嵌套组,内含 5 篇评测的 slug 字符串。
3. **新增文章约定**:每新增一篇游戏评测,需在 `astro.config.mjs` 的「游戏评测」组内追加对应 slug;`blog_url` 仍按 `/blog/<slug>` 惯例填写。
4. **术语**:「游戏评测」为结构化分类容器,内部文章仍属「长评」;每篇游戏评测都是长评,但并非每篇长评都是游戏评测。已记入 `CONTEXT.md`。

## 原因

- **保证 URL 零变化**:文件不动,5 处 `blog_url` 全部继续生效,无需改动 `steam_annotations.json`,不产生死链。
- **中文组名唯一正确路径**:既然改不了自动生成组名,手动组是获得「游戏评测」中文名的既定方案。
- **零数据变更**:不触碰注释/数据文件,改动面最小、风险最低。

## 影响

- `astro.config.mjs`(侧边栏改为手动嵌套组)
- `CONTEXT.md`(新增术语「游戏评测」及与「长评/短评」的关系)
- `docs/blog-writing-guide.md`(验证清单补充:游戏长评需手动追加侧边栏 slug)
- 未来每篇新增游戏评测需手动维护一行 slug(取舍:以少量手动维护换取 URL 稳定性与中文组名)

## 取舍

选择「URL 稳定性 + 精确中文组名」而非「内容自动归类 + 文件夹组织」。若日后不再在意 URL 变化、希望评测自动进组,可迁移到子目录 + `autogenerate('blog/game-reviews')`,届时需同步改写全部 `blog_url`。
