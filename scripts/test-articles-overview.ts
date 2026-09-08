// 回归测试: 文章总览数据过滤与分组纯函数 (filterAndGroupGeneralPosts)
// 契约: 给定 docs 集合条目与 annotations 注释映射 →
// 1. 严格排除游戏评测长评 (匹配 annotations.blog_url)
// 2. 严格排除文章总览入口页自身 (blog/index.mdx 或 blog/index)
// 3. 严格排除非博客页面 (about.md, games.mdx)
// 4. 普通文章按首次发布时间 (pubDate) 降序排序
// 5. 按发布年份分组，年份分组按倒序排列
// 运行: node --experimental-strip-types scripts/test-articles-overview.ts

import { resolvePostMetadata, filterAndGroupGeneralPosts, type InputPostEntry } from '../src/lib/blog-meta.ts';

let failures = 0;
let total = 0;

function check(label: string, actual: unknown, expected: unknown) {
  total++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('PASS', label);
  } else {
    failures++;
    console.error('FAIL', label, '\n  actual:  ', a, '\n  expected:', e);
  }
}

console.log('--- 测试文章总览过滤与分组模块 (Articles Overview Resolver) ---');

// Mock 注释数据
const mockAnnotations = {
  '814380': {
    blog_url: '/blog/sekiro_review',
    tags: ['魂系', '动作'],
  },
  '960170': {
    blog_url: '/blog/djmax_review',
    tags: ['音游'],
  },
};

// 1. 测试 resolvePostMetadata 对 blog/index 的排除判定
{
  const resIndexMdx = resolvePostMetadata('blog/index.mdx', { title: '文章总览' }, mockAnnotations);
  check('blog/index.mdx → isBlogPost 为 false', resIndexMdx.isBlogPost, false);
  check('blog/index.mdx → isGameReview 为 false', resIndexMdx.isGameReview, false);
  check('blog/index.mdx → tags 置空', resIndexMdx.tags, []);

  const resIndexSlug = resolvePostMetadata('blog/index', { title: '文章总览' }, mockAnnotations);
  check('blog/index → isBlogPost 为 false', resIndexSlug.isBlogPost, false);
}

// 2. 测试 filterAndGroupGeneralPosts 过滤与分组逻辑
{
  const mockEntries: InputPostEntry[] = [
    // 普通博文 1 (2026年)
    {
      id: 'blog/astro-blog.md',
      data: {
        title: '如何构建博客',
        description: 'Astro 极简建站实践',
        pubDate: '2026-08-02',
        tags: ['Astro', '建站'],
      },
      rendered: {
        metadata: {
          frontmatter: {
            minutesRead: '5 分钟',
            words: 2000,
          },
        },
      },
    },
    // 普通博文 2 (2026年，较晚发布)
    {
      id: 'blog/msst-workflow.md',
      data: {
        title: 'MSST 音源分离',
        description: 'AI 音频处理实战',
        pubDate: '2026-08-10',
        tags: ['AI工具', '音频'],
      },
      minutesRead: '4 分钟',
      words: 1600,
    },
    // 普通博文 3 (2025年历史文章)
    {
      id: 'blog/steam-guide-2025.md',
      data: {
        title: 'Steam 指南写作指南',
        description: '分享指南创作经验',
        pubDate: '2025-11-20',
        tags: ['Steam', '指南'],
      },
    },
    // 游戏评测 1 (只狼，应被排除)
    {
      id: 'blog/sekiro_review.md',
      data: {
        title: '只狼评测',
        description: '打铁神作',
        pubDate: '2026-08-19',
      },
    },
    // 游戏评测 2 (DJMAX，应被排除)
    {
      id: 'blog/djmax_review.md',
      data: {
        title: 'DJMAX 评测',
        description: 'PC 音游手感巅峰',
        pubDate: '2026-08-15',
      },
    },
    // 总览页自身 (应被排除)
    {
      id: 'blog/index.mdx',
      data: {
        title: '文章总览',
        description: '普通文章总览',
      },
    },
    // 非博客页面 (应被排除)
    {
      id: 'about.md',
      data: {
        title: '关于我',
      },
    },
  ];

  const groups = filterAndGroupGeneralPosts(mockEntries, mockAnnotations);

  check('分组数应该为 2 (2026 与 2025)', groups.length, 2);
  check('第一组年份为 2026', groups[0]?.year, '2026');
  check('第二组年份为 2025', groups[1]?.year, '2025');

  const posts2026 = groups[0]?.posts || [];
  check('2026 年文章数应为 2 篇 (排除了评测与 index)', posts2026.length, 2);

  // 排序验证: 2026-08-10 晚于 2026-08-02，应排在首位
  check('2026 年首篇文章为 MSST 音源分离 (降序排序)', posts2026[0]?.title, 'MSST 音源分离');
  check('首篇文章 URL 格式正确且末尾带斜杠', posts2026[0]?.url, '/blog/msst-workflow/');
  check('首篇文章阅读时长读取成功', posts2026[0]?.minutesRead, '4 分钟');
  check('首篇文章字数读取成功', posts2026[0]?.words, 1600);

  check('2026 年第二篇文章为 如何构建博客', posts2026[1]?.title, '如何构建博客');
  check('第二篇文章从 rendered.metadata.frontmatter 读取阅读时长', posts2026[1]?.minutesRead, '5 分钟');
  check('第二篇文章字数读取成功', posts2026[1]?.words, 2000);

  const posts2025 = groups[1]?.posts || [];
  check('2025 年文章数应为 1 篇', posts2025.length, 1);
  check('2025 年文章为 Steam 指南写作指南', posts2025[0]?.title, 'Steam 指南写作指南');
  check('2025 年文章 URL 格式正确', posts2025[0]?.url, '/blog/steam-guide-2025/');
}

// 3. 边界与异常情况处理
{
  const edgeEntries: InputPostEntry[] = [
    {
      id: 'blog/undated-post.md',
      data: {
        title: '无日期的文章',
      },
    },
    {
      id: 'blog/malformed-date-post.md',
      data: {
        title: '日期格式错误的文章',
        pubDate: 'not-a-date',
      },
    },
  ];

  const groups = filterAndGroupGeneralPosts(edgeEntries, {});
  check('异常日期归入 "其他" 分组', groups[0]?.year, '其他');
  check('"其他" 分组包含 2 篇文章', groups[0]?.posts.length, 2);
}

// 4. 真实环境测试 (集成真实 annotations 与实际博文条目)
{
  const realTestEntries: InputPostEntry[] = [
    {
      id: 'blog/如何通过github-pages和astro构建个人博客.md',
      data: {
        title: '如何通过 GitHub Pages 和 Astro 构建个人博客',
        pubDate: '2026-08-02',
        tags: ['Astro', '建站指南'],
      },
    },
    {
      id: 'blog/如何安装msst音乐音源分离工作流.md',
      data: {
        title: '如何安装 MSST 音乐音源分离工作流',
        pubDate: '2026-08-10',
        tags: ['AI工具', '音频处理'],
      },
    },
    {
      id: 'blog/steam指南写作推荐.md',
      data: {
        title: 'Steam 指南写作推荐',
        pubDate: '2026-08-15',
        tags: ['Steam', '指南创作'],
      },
    },
    {
      id: 'blog/sekiro_review.md',
      data: {
        title: '只狼长评',
        pubDate: '2026-08-19',
      },
    },
    {
      id: 'blog/djmax_review.md',
      data: {
        title: 'DJMAX 长评',
        pubDate: '2026-08-15',
      },
    },
    {
      id: 'blog/index.mdx',
      data: {
        title: '文章总览',
      },
    },
  ];

  const realGroups = filterAndGroupGeneralPosts(realTestEntries);
  check('真实环境: 分组数应为 1 (均为 2026 年)', realGroups.length, 1);
  check('真实环境: 准确过滤评测与 index，仅保留 3 篇普通文章', realGroups[0]?.posts.length, 3);
  const titles = realGroups[0]?.posts.map((p) => p.title);
  check('真实环境: 只狼评测被排除', titles?.includes('只狼长评'), false);
  check('真实环境: DJMAX 评测被排除', titles?.includes('DJMAX 长评'), false);
  check('真实环境: index.mdx 被排除', titles?.includes('文章总览'), false);
  check('真实环境: 包含 MSST 文章', titles?.includes('如何安装 MSST 音乐音源分离工作流'), true);
  check('真实环境: 包含建站指南文章', titles?.includes('如何通过 GitHub Pages 和 Astro 构建个人博客'), true);
  check('真实环境: 包含 Steam 指南文章', titles?.includes('Steam 指南写作推荐'), true);
}

if (failures > 0) {
  console.error(`\n❌ 测试未通过: ${failures}/${total} 个检查失败`);
  process.exit(1);
} else {
  console.log(`\n✅ 全部通过: ${total} 个检查通过`);
}
