// 回归测试: 统一目录上下文解析纯函数 (TOC Resolver, Spec 17)
// 职责: 黑盒断言路由判定与强类型 TocContext 解析行为，覆盖 games / blog-overview / default 各种典型路由。
// 运行: node --experimental-strip-types scripts/test-toc-resolver.ts

import {
  isGamesPath,
  isBlogOverviewPath,
  resolveTocMode,
  resolveTocContext,
  resolveTocContextSync,
} from '../src/lib/toc-resolver.ts';
import type { InputPostEntry, YearGroup } from '../src/lib/blog-meta.ts';
import type { MergedGame } from '../src/lib/steam-data.ts';

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

if (failures > 0) {
  console.error(`\n❌ 测试未通过: ${failures}/${total} 个检查失败`);
  process.exit(1);
} else {
  console.log(`\n✅ 全部通过: ${total} 个检查通过`);
}
