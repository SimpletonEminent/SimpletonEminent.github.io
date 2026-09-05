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
        // 博客(手动列出:顶层技术文章 + 「游戏评测」嵌套组)
        // 注:Starlight 无法给自动生成的子目录组改成中文名,且文件挪目录会破坏画廊 blog_url 链接,
        // 因此采用手动嵌套组(见 docs/adr/0009)。新增文章时在此追加对应 slug。
        {
          label: '📝 博客',
          collapsed: false,
          items: [
            // 顶层技术文章(非游戏评测)
            'blog/如何安装msst音乐音源分离工作流',
            'blog/如何通过github-pages和astro构建个人博客',
            // 游戏评测子分类
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
      ],
    }),
  ],
});
