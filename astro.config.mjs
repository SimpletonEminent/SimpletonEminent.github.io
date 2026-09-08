// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import remarkBreaks from 'remark-breaks';
import { remarkReadingTime } from './remark-reading-time.mjs';

// https://astro.build/config
export default defineConfig({
  // 部署到 GitHub Pages 个人主页站点(username.github.io),无需 base
  site: 'https://SimpletonEminent.github.io',

  markdown: {
    // Astro 7 默认使用 Sätteri 管道;要启用 remark 插件,
    // 需显式切换到 unified() processor(官方推荐路径)
    processor: unified({
      remarkPlugins: [
        remarkBreaks,        // 单回车换行(排版偏好 #1)
        remarkReadingTime,   // 自动计算字数和阅读时间
      ],
    }),
  },

  integrations: [
    starlight({
      title: '我的极简博客',
      description: '基于 Astro + Starlight 的个人博客,记录技术学习与生活。',

      // 单一强调色:现代简洁风格,覆盖 Starlight 默认紫色
      customCss: ['./src/styles/theme.css'],

      // 社交链接:暂时注释,未来添加时取消注释并填写真实链接
      // social: [
      //   { icon: 'github', label: 'GitHub', href: 'https://github.com/SimpletonEminent' },
      // ],

      // 内置搜索(Pagefind,默认开启,无需额外配置)
      pagefind: true,

      // 右侧目录(TOC):默认只收录 h2-h3,这里改为收录 h1-h4 全部
      tableOfContents: { minHeadingLevel: 1, maxHeadingLevel: 4 },

      // 组件覆盖:文章标题下方显示字数和阅读时间;TOC 在 /games 路由替换为游戏列表(双向联动)
      components: {
        PageTitle: './src/components/PageTitle.astro',
        TableOfContents: './src/components/GamesTableOfContents.astro',
        MobileTableOfContents: './src/components/GamesMobileTableOfContents.astro',
      },

      sidebar: [
        // 首页
        { label: '🏠 首页', link: '/' },
        // Steam 游戏画廊
        { label: '🎮 游戏画廊', link: '/games' },
        // 博客(置顶文章总览 + 「技术与生活」与「游戏评测」镜像对称双子组)
        // 见 docs/adr/0009 与 docs/adr/0013。新增文章时在对应分组追加 slug。
        {
          label: '📝 博客',
          collapsed: false,
          items: [
            // 博客聚合门户
            { label: '📑 文章总览', link: '/blog/' },
            // 常规博文子分类 (技术实践、工具流与生活随笔)
            {
              label: '技术与生活',
              collapsed: false,
              items: [
                'blog/steam指南写作推荐',
                'blog/如何安装msst音乐音源分离工作流',
                'blog/如何通过github-pages和astro构建个人博客',
              ],
            },
            // 游戏长评子分类
            {
              label: '游戏评测',
              collapsed: false,
              items: [
                'blog/djmax_review',
                'blog/phoenix_wright_ace_attorney_trilogy_review',
                'blog/sanabi_review',
                'blog/sekiro_review',
                'blog/tts_review',
              ],
            },
          ],
        },
        // 关于我
        { label: '👤 关于我', link: '/about' },
      ],
    }),
  ],
});
