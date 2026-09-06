// 回归测试: 博文元数据与标签解析纯函数 (resolvePostMetadata)
// 契约: 给定 entryId 与 frontmatter (可选注入 annotations) → 输出解析好的 PostMetadata
// 运行: node --experimental-strip-types scripts/test-blog-meta.ts
import { resolvePostMetadata } from '../src/lib/blog-meta.ts';

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

console.log('--- 测试博文元数据解析模块 (Blog Metadata Resolver) ---');

// Mock 注释数据
const mockAnnotations = {
  '1001': {
    blog_url: '/blog/djmax_review',
    tags: ['音游', '节奏'],
  },
  '1002': {
    blog_url: '/blog/empty_tags_review',
    tags: [],
  },
  '1003': {
    blog_url: '/blog/no_tags_review',
  },
};

// 1. 游戏评测且有注释关联 → 自动继承游戏类型标签，前缀为 🎮 游戏类型：
{
  const res = resolvePostMetadata('blog/djmax_review.md', { pubDate: '2026-08-19' }, mockAnnotations);
  check('游戏评测匹配 blog_url → isBlogPost 为 true', res.isBlogPost, true);
  check('游戏评测匹配 blog_url → isGameReview 为 true', res.isGameReview, true);
  check('游戏评测 → labelPrefix 为 🎮 游戏类型：', res.labelPrefix, '🎮 游戏类型：');
  check('游戏评测 → tags 继承注释文件中的 tags', res.tags, ['音游', '节奏']);
}

// 2. 游戏评测但 slug 不带 .md 后缀也能正常匹配
{
  const res = resolvePostMetadata('blog/djmax_review', { pubDate: '2026-08-19' }, mockAnnotations);
  check('游戏评测 slug 不带 .md 扩展名也能匹配', res.isGameReview, true);
  check('游戏评测 slug 不带 .md tags 正确继承', res.tags, ['音游', '节奏']);
}

// 3. 游戏评测但注释中无 tags 或 tags 为空 → 降级读取 frontmatter 的 tags
{
  const res1 = resolvePostMetadata(
    'blog/empty_tags_review.md',
    { pubDate: '2026-08-19', tags: ['备用类型1', '备用类型2'] },
    mockAnnotations
  );
  check('注释 tags 为空数组时 → 降级读取 frontmatter tags', res1.tags, ['备用类型1', '备用类型2']);

  const res2 = resolvePostMetadata(
    'blog/no_tags_review.md',
    { pubDate: '2026-08-19', tags: ['备用类型'] },
    mockAnnotations
  );
  check('注释未定义 tags 字段时 → 降级读取 frontmatter tags', res2.tags, ['备用类型']);
}

// 4. 普通技术博文 → isGameReview 为 false，前缀为 🏷️ 标签：，读取 frontmatter 的 tags
{
  const res = resolvePostMetadata(
    'blog/如何安装msst音乐音源分离工作流.md',
    {
      pubDate: '2026-09-05',
      tags: ['AI工具', '音频处理'],
    },
    mockAnnotations
  );
  check('技术文章 → isBlogPost 为 true', res.isBlogPost, true);
  check('技术文章 → isGameReview 为 false', res.isGameReview, false);
  check('技术文章 → labelPrefix 为 🏷️ 标签：', res.labelPrefix, '🏷️ 标签：');
  check('技术文章 → tags 准确读取 frontmatter tags', res.tags, ['AI工具', '音频处理']);
}

// 5. 非博客页面（如 about.md、games.mdx、index.mdx） → isBlogPost 为 false
{
  const resAbout = resolvePostMetadata('about.md', { pubDate: '2026-08-01', tags: ['个人'] }, mockAnnotations);
  check('about.md → isBlogPost 为 false', resAbout.isBlogPost, false);
  check('about.md → tags 置空', resAbout.tags, []);
  check('about.md → labelPrefix 为空', resAbout.labelPrefix, '');

  const resGames = resolvePostMetadata('games.mdx', {}, mockAnnotations);
  check('games.mdx → isBlogPost 为 false', resGames.isBlogPost, false);
}

// 6. 日期展示逻辑验证
// 6.1 仅有首次发布时间
{
  const res = resolvePostMetadata('blog/tech.md', { pubDate: '2026-08-15' }, mockAnnotations);
  check('仅有 pubDate → pubDate 返回原串', res.pubDate, '2026-08-15');
  check('仅有 pubDate → updatedDate 为 undefined', res.updatedDate, undefined);
  check('仅有 pubDate → showUpdated 为 false', res.showUpdated, false);
}

// 6.2 updatedDate 等于 pubDate → 不显示更新时间
{
  const res = resolvePostMetadata(
    'blog/tech.md',
    { pubDate: '2026-08-15', updatedDate: '2026-08-15' },
    mockAnnotations
  );
  check('updatedDate 等于 pubDate → showUpdated 为 false', res.showUpdated, false);
}

// 6.3 updatedDate 晚于 pubDate → 显示更新时间
{
  const res = resolvePostMetadata(
    'blog/tech.md',
    { pubDate: '2026-08-15', updatedDate: '2026-09-06' },
    mockAnnotations
  );
  check('updatedDate 晚于 pubDate → showUpdated 为 true', res.showUpdated, true);
  check('updatedDate 晚于 pubDate → updatedDate 返回原串', res.updatedDate, '2026-09-06');
}

// 6.4 updatedDate 早于 pubDate（异常数据保护） → 不显示更新时间
{
  const res = resolvePostMetadata(
    'blog/tech.md',
    { pubDate: '2026-08-15', updatedDate: '2026-08-01' },
    mockAnnotations
  );
  check('updatedDate 早于 pubDate → showUpdated 为 false', res.showUpdated, false);
}

// 7. 真实数据源验证（不传入 mockAnnotations，直接加载项目的 steam_annotations.json）
{
  const realSekiro = resolvePostMetadata('blog/sekiro_review.md', { pubDate: '2026-08-19' });
  check('真实环境: 只狼评测识别为游戏评测', realSekiro.isGameReview, true);
  check('真实环境: 只狼评测包含魂系标签', realSekiro.tags.includes('魂系'), true);

  const realDjmax = resolvePostMetadata('blog/djmax_review.md', { pubDate: '2026-08-19' });
  check('真实环境: DJMAX 识别为游戏评测', realDjmax.isGameReview, true);
  check('真实环境: DJMAX 包含音游标签', realDjmax.tags.includes('音游'), true);
}

if (failures > 0) {
  console.error(`\n❌ 测试未通过: ${failures}/${total} 个检查失败`);
  process.exit(1);
} else {
  console.log(`\n✅ 全部通过: ${total} 个检查通过`);
}
