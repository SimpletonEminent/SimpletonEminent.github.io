# 画廊样式使用 Starlight CSS 变量,不引入 Tailwind

初始 spec 要求用 Tailwind 工具类构建画廊,但项目未安装 Tailwind。评估后决定:用页面级 scoped `<style>` 直接消费 Starlight 的 `--sl-color-*` CSS 变量,不引入 Tailwind 依赖。

原因:现有 `theme.css` 是未分层 + `!important` 的写法,接入 Tailwind 需重构进 layer 体系才能避免样式覆盖;而 Starlight 的 `data-theme` 暗黑机制让 CSS 变量自动适配明暗两态,`dark:` 变体反而需要额外配置。为一页画廊动整个样式体系不划算。
