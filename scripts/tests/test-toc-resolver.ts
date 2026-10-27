// 回归测试: 统一目录上下文解析纯函数 (TOC Resolver, Spec 17)
// 职责: 黑盒断言路由判定与强类型 TocContext 解析行为，覆盖 games / blog-overview / default 各种典型路由。
// 运行: node --experimental-strip-types scripts/test-toc-resolver.ts

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isGamesPath,
  isBlogOverviewPath,
  resolveTocMode,
  resolveTocContext,
  resolveTocContextSync,
} from '../../src/lib/toc-resolver.ts';
import { formatHours } from '../../src/lib/steam-data.ts';
import { renderBadges } from '../../src/lib/game-presentation.ts';
import type { InputPostEntry, YearGroup } from '../../src/lib/blog-meta.ts';
import type { MergedGame } from '../../src/lib/steam-data.ts';

function makeGame(partial: Partial<MergedGame> = {}): MergedGame {
  return {
    appid: 101,
    name: 'Mock Game A',
    playtime_hours: 10,
    playtime_2weeks_hours: 1,
    last_played: 1700000000,
    cover: '',
    name_zh: '',
    tags: [],
    my_status: 'completed',
    my_review: '',
    blog_url: '',
    play_year: '',
    platform: '',
    my_rank: '',
    release_date: '',
    ...partial,
  };
}

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

console.log('--- 测试统一目录解析模块 (TOC Resolver) ---');

// ==========================================
// 1. 路由路径谓词判定 (isGamesPath & isBlogOverviewPath)
// ==========================================
check('isGamesPath: "/games" 判定为 true', isGamesPath('/games'), true);
check('isGamesPath: "/games/" 判定为 true', isGamesPath('/games/'), true);
check('isGamesPath: "/games/sub" 判定为 true', isGamesPath('/games/sub'), true);
check('isGamesPath: "/blog" 判定为 false', isGamesPath('/blog'), false);
check('isGamesPath: "/about" 判定为 false', isGamesPath('/about'), false);
check('isGamesPath: "/" 判定为 false', isGamesPath('/'), false);

check('isBlogOverviewPath: "/blog" 判定为 true', isBlogOverviewPath('/blog'), true);
check('isBlogOverviewPath: "/blog/" 判定为 true', isBlogOverviewPath('/blog/'), true);
check('isBlogOverviewPath: "/blog/post-1/" 判定为 false (博文不属总览)', isBlogOverviewPath('/blog/post-1/'), false);
check('isBlogOverviewPath: "/blog/index" 判定为 false', isBlogOverviewPath('/blog/index'), false);
check('isBlogOverviewPath: "/games" 判定为 false', isBlogOverviewPath('/games'), false);
check('isBlogOverviewPath: "/" 判定为 false', isBlogOverviewPath('/'), false);

// ==========================================
// 2. 目录模式推导 (resolveTocMode)
// ==========================================
check('resolveTocMode: "/games" -> games', resolveTocMode('/games'), 'games');
check('resolveTocMode: "/games/" -> games', resolveTocMode('/games/'), 'games');
check('resolveTocMode: "/games/any" -> games', resolveTocMode('/games/any'), 'games');
check('resolveTocMode: "/blog" -> blog-overview', resolveTocMode('/blog'), 'blog-overview');
check('resolveTocMode: "/blog/" -> blog-overview', resolveTocMode('/blog/'), 'blog-overview');
check('resolveTocMode: "/blog/some-post" -> default', resolveTocMode('/blog/some-post'), 'default');
check('resolveTocMode: "/blog/some-post/" -> default', resolveTocMode('/blog/some-post/'), 'default');
check('resolveTocMode: "/about" -> default', resolveTocMode('/about'), 'default');
check('resolveTocMode: "/about/" -> default', resolveTocMode('/about/'), 'default');
check('resolveTocMode: "/" -> default', resolveTocMode('/'), 'default');
check('resolveTocMode: "/404" -> default', resolveTocMode('/404'), 'default');

// ==========================================
// 3. 异步目录上下文解析 (resolveTocContext)
// ==========================================
// 3.1 游戏画廊路由 (/games)
{
  const mockGames: MergedGame[] = [
    makeGame({
      appid: 101,
      name: 'Mock Game A',
    }),
  ];

  const ctxCustom = await resolveTocContext('/games', { games: mockGames });
  check('resolveTocContext(/games): mode 为 games', ctxCustom.mode, 'games');
  if (ctxCustom.mode === 'games') {
    check('resolveTocContext(/games): 返回注入的 games 数据', ctxCustom.games, mockGames);
  }

  // 默认调用 loadMergedGames
  const ctxDefault = await resolveTocContext('/games/');
  check('resolveTocContext(/games/): 默认装载真实 games 数据', ctxDefault.mode, 'games');
  if (ctxDefault.mode === 'games') {
    check('resolveTocContext(/games/): 真实 games 数组非空', ctxDefault.games.length > 0, true);
  }
}

// 3.2 文章总览门户路由 (/blog 及 /blog/)
{
  let getDocsCalled = 0;
  const mockDocs: InputPostEntry[] = [
    {
      id: 'blog/test-article.md',
      data: {
        title: '测试文章',
        pubDate: '2026-08-01',
      },
    },
  ];

  const ctxBlog = await resolveTocContext('/blog', {
    getDocs: async () => {
      getDocsCalled++;
      return mockDocs;
    },
  });

  check('resolveTocContext(/blog): mode 为 blog-overview', ctxBlog.mode, 'blog-overview');
  check('resolveTocContext(/blog): 委托 getDocs 被执行', getDocsCalled, 1);
  if (ctxBlog.mode === 'blog-overview') {
    check('resolveTocContext(/blog): 解析出正确的年份分组', ctxBlog.yearGroups[0]?.year, '2026');
    check('resolveTocContext(/blog): 年份分组包含 1 篇文章', ctxBlog.yearGroups[0]?.posts.length, 1);
  }

  // 直接注入预先计算的 yearGroups (跳过 getDocs)
  const prebuiltGroups: YearGroup[] = [{ year: '2025', posts: [] }];
  const ctxPrebuilt = await resolveTocContext('/blog/', {
    yearGroups: prebuiltGroups,
    getDocs: async () => {
      getDocsCalled++;
      return [];
    },
  });
  check('resolveTocContext: 传入 yearGroups 时直接使用', ctxPrebuilt.mode, 'blog-overview');
  check('resolveTocContext: 传入 yearGroups 时不调用 getDocs', getDocsCalled, 1); // 次数依然为 1
  if (ctxPrebuilt.mode === 'blog-overview') {
    check('resolveTocContext: 年份分组为预制数据', ctxPrebuilt.yearGroups, prebuiltGroups);
  }
}

// 3.3 惰性求值与性能保护: 非 blog-overview 路由绝不调用 getDocs
{
  let unnecessaryCalls = 0;
  const dummyGetDocs = () => {
    unnecessaryCalls++;
    return [];
  };

  const ctxGames = await resolveTocContext('/games', { getDocs: dummyGetDocs });
  check('惰性求值: /games 不调用 getDocs', unnecessaryCalls, 0);
  check('惰性求值: /games mode 为 games', ctxGames.mode, 'games');

  const ctxAbout = await resolveTocContext('/about', { getDocs: dummyGetDocs });
  check('惰性求值: /about 不调用 getDocs', unnecessaryCalls, 0);
  check('resolveTocContext(/about): mode 为 default', ctxAbout.mode, 'default');

  const ctxPost = await resolveTocContext('/blog/how-to-build-blog/', { getDocs: dummyGetDocs });
  check('惰性求值: 单篇博文 /blog/.../ 不调用 getDocs', unnecessaryCalls, 0);
  check('resolveTocContext(单篇博文): mode 为 default', ctxPost.mode, 'default');
}

// ==========================================
// 4. 同步目录上下文解析 (resolveTocContextSync)
// ==========================================
{
  const syncGames = resolveTocContextSync('/games', { games: [] });
  check('resolveTocContextSync(/games): mode 为 games', syncGames.mode, 'games');

  const syncBlog = resolveTocContextSync('/blog', {
    docs: [
      {
        id: 'blog/sync-post.md',
        data: { title: '同步文章', pubDate: '2026-09-01' },
      },
    ],
  });
  check('resolveTocContextSync(/blog): mode 为 blog-overview', syncBlog.mode, 'blog-overview');
  if (syncBlog.mode === 'blog-overview') {
    check('resolveTocContextSync(/blog): 正确分组年份', syncBlog.yearGroups[0]?.year, '2026');
  }

  const syncDefault = resolveTocContextSync('/about');
  check('resolveTocContextSync(/about): mode 为 default', syncDefault.mode, 'default');
}

{
  const rootDir = process.cwd();
  const viewPath = resolve(rootDir, 'src/components/TableOfContentsView.astro');
  const desktopPath = resolve(rootDir, 'src/components/GamesTableOfContents.astro');
  const mobilePath = resolve(rootDir, 'src/components/GamesMobileTableOfContents.astro');

  check('TableOfContentsView.astro 文件存在', existsSync(viewPath), true);
  check('GamesTableOfContents.astro 文件存在', existsSync(desktopPath), true);
  check('GamesMobileTableOfContents.astro 文件存在', existsSync(mobilePath), true);

  const viewContent = readFileSync(viewPath, 'utf-8');
  const desktopContent = readFileSync(desktopPath, 'utf-8');
  const mobileContent = readFileSync(mobilePath, 'utf-8');

  check('桌面端 TOC 导入 TableOfContentsView', desktopContent.includes("import TableOfContentsView from './TableOfContentsView.astro'"), true);
  check('桌面端 TOC 使用 TableOfContentsView 标签', desktopContent.includes('<TableOfContentsView'), true);
  check('移动端 TOC 导入 TableOfContentsView', mobileContent.includes("import TableOfContentsView from './TableOfContentsView.astro'"), true);
  check('移动端 TOC 使用 TableOfContentsView 标签并传递 isMobile', mobileContent.includes('<TableOfContentsView') && mobileContent.includes('isMobile'), true);
  check('桌面端 TOC 已消除 games.map 循环', !desktopContent.includes('games.map'), true);
  check('移动端 TOC 已消除 games.map 循环', !mobileContent.includes('games.map'), true);
  check('桌面端 TOC 已消除 yearGroups.map 循环', !desktopContent.includes('yearGroups.map'), true);
  check('移动端 TOC 已消除 yearGroups.map 循环', !mobileContent.includes('yearGroups.map'), true);
  check('桌面端 TOC 已消除 .games-toc-row 规则', !desktopContent.includes('.games-toc-row {'), true);
  check('移动端 TOC 已消除 .games-mobile-row 规则', !mobileContent.includes('.games-mobile-row {'), true);
  check('桌面端 TOC 已消除 .overview-toc-link 规则', !desktopContent.includes('.overview-toc-link {'), true);
  check('移动端 TOC 已消除 .overview-mobile-row 规则', !mobileContent.includes('.overview-mobile-row {'), true);
  check('TableOfContentsView 包含 .games-toc-row 基础样式', viewContent.includes('.games-toc-row'), true);
  check('TableOfContentsView 包含 :global(.status-badge) 徽章样式', viewContent.includes(':global(.status-badge)'), true);
  check('TableOfContentsView 包含 .overview-toc-link 桌面年份链接样式', viewContent.includes('.overview-toc-link'), true);
  check('TableOfContentsView 包含 .overview-mobile-row 移动年份链接样式', viewContent.includes('.overview-mobile-row'), true);

  const gameWithZh = makeGame({ appid: 814380, name: 'Sekiro: Shadows Die Twice', name_zh: '只狼：影逝二度', playtime_hours: 320.5, my_status: 'perfect' });
  const gameWithoutZh = makeGame({ appid: 1002, name: 'Pure English Title', name_zh: '' });
  const displayWithZh = gameWithZh.name_zh || gameWithZh.name;
  const displayWithoutZh = gameWithoutZh.name_zh || gameWithoutZh.name;

  check('有中文名时优先展示中文名 (只狼：影逝二度)', displayWithZh, '只狼：影逝二度');
  check('hover title 始终保留英文原名 (Sekiro: Shadows Die Twice)', gameWithZh.name, 'Sekiro: Shadows Die Twice');
  check('无中文名时回退展示英文原名', displayWithoutZh, 'Pure English Title');
  check('无中文名时 hover title 为英文原名', gameWithoutZh.name, 'Pure English Title');
  check('游玩时长格式化为 320.5h', `${formatHours(gameWithZh.playtime_hours)}h`, '320.5h');

  const badgesHtml = renderBadges(gameWithZh);
  check('徽章包含全成就 perfect', badgesHtml.includes('data-status="perfect"'), true);

  const sampleGroups: YearGroup[] = [
    {
      year: '2026',
      posts: [
        { id: 'blog/a', title: 'A', description: '', pubDate: '2026-08-01', tags: [], url: '/blog/a/' },
        { id: 'blog/b', title: 'B', description: '', pubDate: '2026-08-02', tags: [], url: '/blog/b/' },
      ],
    },
  ];
  check('年份锚点生成为 #year-2026', `#year-${sampleGroups[0].year}`, '#year-2026');
  check('年份文本生成为 2026 年', `${sampleGroups[0].year} 年`, '2026 年');
  check('年份文章计数生成为 2 篇', `${sampleGroups[0].posts.length} 篇`, '2 篇');
  check('TableOfContentsView 模板同时声明 games-toc-row 与 games-mobile-row', viewContent.includes('games-toc-row') && viewContent.includes('games-mobile-row'), true);
  check('TableOfContentsView 模板同时声明 games-toc-name 与 games-mobile-name', viewContent.includes('games-toc-name') && viewContent.includes('games-mobile-name'), true);
  check('TableOfContentsView 模板同时声明 games-toc-playtime 与 games-mobile-playtime', viewContent.includes('games-toc-playtime') && viewContent.includes('games-mobile-playtime'), true);
  check('包含游戏空状态提示 "暂无游戏数据"', viewContent.includes('暂无游戏数据'), true);
  check('包含文章空状态提示 "暂无文章记录"', viewContent.includes('暂无文章记录'), true);
}

if (failures > 0) {
  console.error(`\n❌ 测试未通过: ${failures}/${total} 个检查失败`);
  process.exit(1);
} else {
  console.log(`\n✅ 全部通过: ${total} 个检查通过`);
}
