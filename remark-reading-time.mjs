// remark-reading-time.mjs
// 自定义 remark 插件:为每篇文章自动计算字数和阅读时间,注入 frontmatter
// 参考:https://docs.astro.build/en/recipes/reading-time/
import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

export function remarkReadingTime() {
  return function (tree, file) {
    const textOnPage = toString(tree);
    const readingTime = getReadingTime(textOnPage);

    // 注入到 frontmatter(Starlight 中通过 entry.rendered.metadata.frontmatter 读取)
    if (file?.data?.astro?.frontmatter) {
      file.data.astro.frontmatter.minutesRead = readingTime.text;
      file.data.astro.frontmatter.words = readingTime.words;
    }
  };
}
