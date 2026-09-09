// 回归测试: 首页看板数据解耦与精选校验模块 (test-dashboard-data.ts, Spec 18)
// 契约验证:
// 1. 全站指标聚合逻辑 (calculateDashboardStats) 及其在空数据/异常数据下的纯函数稳健性
// 2. 精选游戏长评动态解析与真实数据关联 (resolveFeaturedReviews)，杜绝死数据漂移
// 3. 技术实践指南元数据与阅读时长提取 (resolveTechnicalGuides)
// 4. 迷你封面堆叠资源解析 (resolveStackCovers)
// 5. 统一入口 getHomeDashboardData 与真实生产环境数据的集成验证
// 运行命令: node --experimental-strip-types scripts/test-dashboard-data.ts

import {
  calculateDashboardStats,
  resolveFeaturedReviews,
  resolveTechnicalGuides,
  resolveStackCovers,
  getHomeDashboardData,
  DEFAULT_FEATURED_REVIEW_DEFINITIONS,
  DEFAULT_TECHNICAL_GUIDE_DEFINITIONS,
  DEFAULT_STACK_COVERS,
  type FeaturedReviewDefinition,
  type TechnicalGuideDefinition,
} from '../src/lib/dashboard-data.ts';
import type { MergedGame } from '../src/lib/steam-data.ts';

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

console.log('--- 测试首页看板数据模块 (Home Dashboard Data Resolver) ---');

// ============================================================
// 1. 全站指标聚合纯函数 (calculateDashboardStats)
// ============================================================
{
  const mockGames: MergedGame[] = [
    {
      appid: 1,
      name: 'Game 1',
      name_zh: '游戏一',
      playtime_hours: 10.4,
      playtime_2weeks_hours: 1.2,
      last_played: 1000,
      cover: 'https://example.com/1.jpg',
      tags: ['动作'],
      my_status: 'completed',
      my_review: '',
      blog_url: '',
      play_year: '2024',
      platform: 'PC',
      my_rank: '',
      release_date: '2024',
      achievements: { unlocked: 15, total: 20 },
    },
    {
      appid: 2,
      name: 'Game 2',
      name_zh: '游戏二',
      playtime_hours: 20.3,
      playtime_2weeks_hours: 0,
      last_played: 2000,
      cover: 'https://example.com/2.jpg',
      tags: ['RPG'],
      my_status: 'perfect',
      my_review: '',
      blog_url: '',
      play_year: '2025',
      platform: 'PC',
      my_rank: '',
      release_date: '2025',
      achievements: { unlocked: 35, total: 35 },
    },
    {
      appid: 3,
      name: 'Game 3 (无成就)',
      name_zh: '游戏三',
      playtime_hours: 5.0,
      playtime_2weeks_hours: 0,
      last_played: 0,
      cover: 'https://example.com/3.jpg',
      tags: [],
      my_status: 'uncompleted',
      my_review: '',
      blog_url: '',
      play_year: '2026',
      platform: 'PC',
      my_rank: '',
      release_date: '2026',
      // achievements 为 undefined
    },
  ];

  const stats = calculateDashboardStats(mockGames, '2026-09-10 12:00:00');
  check('calculateDashboardStats: 统计游戏总数', stats.totalGames, 3);
  check('calculateDashboardStats: 四舍五入累加总小时数 (10.4 + 20.3 + 5.0 = 35.7 -> 36)', stats.totalHours, 36);
  check('calculateDashboardStats: 统计已解锁总成就数 (15 + 35 = 50)', stats.totalUnlockedAchievements, 50);
  check('calculateDashboardStats: 透传 updatedAt 同步时间戳', stats.updatedAt, '2026-09-10 12:00:00');

  // 空数据与容错测试
  const emptyStats = calculateDashboardStats([]);
  check('calculateDashboardStats(空列表): totalGames 为 0', emptyStats.totalGames, 0);
  check('calculateDashboardStats(空列表): totalHours 为 0', emptyStats.totalHours, 0);
  check('calculateDashboardStats(空列表): totalUnlockedAchievements 为 0', emptyStats.totalUnlockedAchievements, 0);
  check('calculateDashboardStats(空列表): updatedAt 为 undefined', emptyStats.updatedAt, undefined);

  // 非法或缺失属性容错
  const rogueGames = [
    { appid: 99 } as unknown as MergedGame,
    null as unknown as MergedGame,
  ];
  const rogueStats = calculateDashboardStats(rogueGames);
  check('calculateDashboardStats(异常数据): 不抛出异常且安全返回数字', typeof rogueStats.totalHours, 'number');
}

// ============================================================
// 2. 精选游戏长评动态校验与关联 (resolveFeaturedReviews)
// ============================================================
{
  const mockGames: MergedGame[] = [
    {
      appid: 814380,
      name: 'Sekiro: Shadows Die Twice',
      name_zh: '只狼：影逝二度',
      playtime_hours: 347.1,
      playtime_2weeks_hours: 0,
      last_played: 1000,
      cover: 'https://cdn.example.com/sekiro.jpg',
      tags: ['魂类', '动作', '忍者'],
      my_status: 'perfect',
      my_review: '打铁神作',
      blog_url: '/blog/sekiro_review', // 不带斜杠
      play_year: '2025',
      platform: 'PC',
      my_rank: '',
      release_date: '2019',
    },
    {
      appid: 1562700,
      name: 'SANABI',
      name_zh: '闪避刺客',
      playtime_hours: 19.7,
      playtime_2weeks_hours: 0,
      last_played: 1000,
      cover: 'https://cdn.example.com/sanabi.jpg',
      tags: ['赛博朋克', '动作'],
      my_status: 'completed',
      my_review: '',
      blog_url: '/blog/sanabi_review/', // 带斜杠
      play_year: '2024',
      platform: 'PC',
      my_rank: '',
      release_date: '2023',
    },
  ];

  const customDefs: FeaturedReviewDefinition[] = [
    {
      appid: 814380,
      subtitle: '打铁心流神作',
      description: '超越魂的动作游戏拆解。',
      tag: '魂类 · 动作', // 自定义标签
    },
    {
      appid: 1562700,
      subtitle: '父女物语',
      description: '赛博朋克顶级叙事。',
      // 未传 tag，测试回退到 tags
    },
    {
      appid: 999999, // 不在 mockGames 中的缺失游戏，测试兜底
      subtitle: '未知游戏寄语',
      description: '缺失游戏描述。',
    },
  ];

  const resolved = resolveFeaturedReviews(customDefs, mockGames);
  check('resolveFeaturedReviews: 输出长度匹配定义数', resolved.length, 3);

  // 814380 只狼
  const sekiro = resolved[0];
  check('只狼: 动态提取最新名称', sekiro.title, '只狼：影逝二度');
  check('只狼: 动态提取最新游玩时长', sekiro.hours, 347.1);
  check('只狼: 动态提取最新游玩状态 (已通关 -> 全成就 perfect)', sekiro.status, 'perfect');
  check('只狼: 动态注入封面图', sekiro.cover, 'https://cdn.example.com/sekiro.jpg');
  check('只狼: 长评 URL 自动规范化追加尾随斜杠', sekiro.url, '/blog/sekiro_review/');
  check('只狼: 继承配置中的寄语 subtitle', sekiro.subtitle, '打铁心流神作');
  check('只狼: 继承配置中的 description', sekiro.description, '超越魂的动作游戏拆解。');
  check('只狼: 优先采用配置的自定义标签', sekiro.tag, '魂类 · 动作');

  // 1562700 闪避刺客
  const sanabi = resolved[1];
  check('闪避刺客: 动态提取最新名称', sanabi.title, '闪避刺客');
  check('闪避刺客: 动态提取最新时长 19.7 (非旧硬编码 15)', sanabi.hours, 19.7);
  check('闪避刺客: 原生带斜杠 URL 保持不变', sanabi.url, '/blog/sanabi_review/');
  check('闪避刺客: 未显式配置 tag 时自动提取游戏前 2 个标签合成', sanabi.tag, '赛博朋克 · 动作');

  // 999999 缺失游戏稳健兜底
  const missing = resolved[2];
  check('缺失游戏: appid 正确', missing.appid, 999999);
  check('缺失游戏: 标题兜底为 AppID 999999', missing.title, 'AppID 999999');
  check('缺失游戏: 时长兜底为 0', missing.hours, 0);
  check('缺失游戏: 状态兜底为 uncompleted', missing.status, 'uncompleted');
  check('缺失游戏: 封面兜底为官方 Steam CDN 规范路径', missing.cover, 'https://cdn.akamai.steamstatic.com/steam/apps/999999/library_600x900.jpg');
  check('缺失游戏: URL 兜底为画廊锚点', missing.url, '/games#game-999999');
  check('缺失游戏: 标签兜底为 精选长评', missing.tag, '精选长评');

  // 默认定义项验证
  check('DEFAULT_FEATURED_REVIEW_DEFINITIONS: 包含 3 款默认精选游戏定义', DEFAULT_FEATURED_REVIEW_DEFINITIONS.length, 3);
  check('DEFAULT_FEATURED_REVIEW_DEFINITIONS: 首款定义为只狼 (814380)', DEFAULT_FEATURED_REVIEW_DEFINITIONS[0].appid, 814380);

  // 边界保护: 传入 null 或 undefined
  check('resolveFeaturedReviews 空安全: 传入空参数返回空数组', resolveFeaturedReviews([], []).length, 0);
}

// ============================================================
// 3. 技术实践指南元数据与阅读时长 (resolveTechnicalGuides)
// ============================================================
{
  const mockDocs = [
    {
      id: 'blog/如何通过github-pages和astro构建个人博客.md',
      data: {
        title: '构建个人博客',
        pubDate: '2026-08-05', // 覆盖 fallbackDate
      },
      rendered: {
        metadata: {
          frontmatter: {
            minutesRead: '8 分钟',
            words: 3200,
          },
        },
      },
    },
    {
      id: 'blog/如何安装msst音乐音源分离工作流',
      data: {
        title: 'MSST 工作流',
        // 无 pubDate，回退到 fallbackDate
      },
    },
  ];

  const guideDefs: TechnicalGuideDefinition[] = [
    {
      id: 'blog/如何通过github-pages和astro构建个人博客',
      title: '建站指南',
      description: '基于 GitHub Pages 建站。',
      tag: '工程实践 · Astro',
      url: '/blog/如何通过github-pages和astro构建个人博客/',
      fallbackDate: '2026-08-02',
    },
    {
      id: 'blog/如何安装msst音乐音源分离工作流',
      title: 'MSST 实操',
      description: '人声伴奏分离指南。',
      tag: '多媒体 · AI 工具',
      url: '/blog/如何安装msst音乐音源分离工作流/',
      fallbackDate: '2026-08-10',
    },
  ];

  // 异步解析（带模拟 renderer）
  const mockRenderer = async (_entry: unknown) => {
    return {
      metadata: {
        frontmatter: {
          minutesRead: '12 分钟',
        },
      },
    };
  };

  const guides = await resolveTechnicalGuides(mockDocs, guideDefs, mockRenderer);
  check('resolveTechnicalGuides: 返回 2 篇指南', guides.length, 2);

  // 第一篇: 匹配到带 .md 后缀的文档，自动提取同步 metrics 与覆盖 pubDate
  check('指南 1: 标题保留配置标题', guides[0].title, '建站指南');
  check('指南 1: 读取到 frontmatter 中的 8 分钟阅读时长', guides[0].minutesRead, '8 分钟');
  check('指南 1: 使用 entry 中的真实 pubDate (2026-08-05)', guides[0].date, '2026-08-05');
  check('指南 1: 标签正确', guides[0].tag, '工程实践 · Astro');

  // 第二篇: 触发 renderer 异步富化提取阅读时长，并回退到 fallbackDate
  check('指南 2: 标题正确', guides[1].title, 'MSST 实操');
  check('指南 2: 通过 renderer 提取到 12 分钟阅读时长', guides[1].minutesRead, '12 分钟');
  check('指南 2: entry 无 pubDate 时回退到配置的 fallbackDate (2026-08-10)', guides[1].date, '2026-08-10');
  // 默认技术指南定义验证
  check('DEFAULT_TECHNICAL_GUIDE_DEFINITIONS: 包含 2 篇默认技术指南', DEFAULT_TECHNICAL_GUIDE_DEFINITIONS.length, 2);
  check('DEFAULT_TECHNICAL_GUIDE_DEFINITIONS: 首篇为博客构建指南', DEFAULT_TECHNICAL_GUIDE_DEFINITIONS[0].id, 'blog/如何通过github-pages和astro构建个人博客');
}

// ============================================================
// 4. 迷你封面堆叠资源解析 (resolveStackCovers)
// ============================================================
{
  const defaultCovers = resolveStackCovers();
  check('resolveStackCovers: 默认返回 4 张核心封面', defaultCovers.length, 4);
  check('resolveStackCovers: 默认首张封面为逆转裁判 (787480)', defaultCovers[0], DEFAULT_STACK_COVERS[0]);

  const customCovers = ['https://example.com/custom.jpg'];
  const resolvedCustom = resolveStackCovers(customCovers);
  check('resolveStackCovers: 自定义封面优先返回', resolvedCustom, customCovers);
}

// ============================================================
// 5. 统一入口与真实生产环境数据集成 (getHomeDashboardData)
// ============================================================
{
  // 注入选项方式
  const mockDocs = [
    {
      id: 'blog/如何通过github-pages和astro构建个人博客',
      data: { pubDate: '2026-08-02' },
      rendered: { metadata: { frontmatter: { minutesRead: '5 分钟' } } },
    },
    {
      id: 'blog/如何安装msst音乐音源分离工作流',
      data: { pubDate: '2026-08-10' },
      rendered: { metadata: { frontmatter: { minutesRead: '6 分钟' } } },
    },
  ];

  // 默认调用真实生产数据
  const realDashboardData = await getHomeDashboardData(mockDocs);
  check('真实环境: totalGames 大于 0', realDashboardData.totalGames > 0, true);
  check('真实环境: totalHours 大于 0', realDashboardData.totalHours > 0, true);
  check('真实环境: totalUnlockedAchievements 大于 0', realDashboardData.totalUnlockedAchievements > 0, true);
  check('真实环境: featuredReviews 默认包含 3 款代表作', realDashboardData.featuredReviews.length, 3);

  // 重点验证精选评测 3 款核心代表作的真实动态绑定效果 (只狼/闪避刺客/DJMAX)
  const realSekiro = realDashboardData.featuredReviews.find((r) => r.appid === 814380);
  check('真实环境/只狼: 存在', Boolean(realSekiro), true);
  if (realSekiro) {
    check('真实环境/只狼: 中文名正确绑定 (只狼：影逝二度)', realSekiro.title, '只狼：影逝二度');
    check('真实环境/只狼: 通关状态动态同步为 perfect', realSekiro.status, 'perfect');
    check('真实环境/只狼: 游玩小时数真实动态绑定 (> 300h)', realSekiro.hours > 300, true);
    check('真实环境/只狼: 长评 URL 正确', realSekiro.url, '/blog/sekiro_review/');
    check('真实环境/只狼: 封面包含有效 cdn 路径', realSekiro.cover.includes('814380'), true);
  }

  const realSanabi = realDashboardData.featuredReviews.find((r) => r.appid === 1562700);
  check('真实环境/闪避刺客: 存在', Boolean(realSanabi), true);
  if (realSanabi) {
    check('真实环境/闪避刺客: 游玩小时数动态反映真实游玩时间 (> 15h)', realSanabi.hours > 15, true);
    check('真实环境/闪避刺客: 长评 URL 正确', realSanabi.url, '/blog/sanabi_review/');
  }

  const realDjmax = realDashboardData.featuredReviews.find((r) => r.appid === 960170);
  check('真实环境/DJMAX: 存在', Boolean(realDjmax), true);
  if (realDjmax) {
    check('真实环境/DJMAX: 游玩小时数动态绑定 (> 0)', realDjmax.hours > 0, true);
    check('真实环境/DJMAX: 长评 URL 正确', realDjmax.url, '/blog/djmax_review/');
  }

  // 验证技术指南提取结果
  check('真实环境: technicalGuides 包含 2 篇精选手记', realDashboardData.technicalGuides.length, 2);
  check('真实环境: 建站指南阅读时长提取成功', realDashboardData.technicalGuides[0].minutesRead, '5 分钟');
  check('真实环境: MSST 指南阅读时长提取成功', realDashboardData.technicalGuides[1].minutesRead, '6 分钟');
  check('真实环境: stackCovers 包含 4 张封面', realDashboardData.stackCovers.length, 4);
}

console.log(`\n测试汇总: 全部 ${total} 个检查, 失败 ${failures} 个`);
if (failures > 0) {
  process.exit(1);
} else {
  console.log('✅ 全部通过: 首页看板数据解耦与校验测试完美通过');
}
