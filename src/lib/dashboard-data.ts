// 首页看板数据解耦与聚合领域模块 (Spec 18)
// 职责:
// 1. 沉淀全站指标聚合纯函数 (calculateDashboardStats)
// 2. 建立动态校验的精选游戏解析器 (resolveFeaturedReviews)，动态关联 loadMergedGames，避免数据硬编码漂移
// 3. 内聚技术指南映射与阅读时间提取 (resolveTechnicalGuides)
// 4. 对外提供统一干净的看板聚合入口 (getHomeDashboardData)

import { loadMergedGames, type MergedGame } from './steam-data.ts';
import { type Status } from './play-status.ts';
import { resolveReadingMetricsAsync } from './blog-meta.ts';

/** 精选游戏评测配置标识 */
export interface FeaturedReviewDefinition {
  appid: number;
  subtitle: string;
  description: string;
  tag?: string;
  title?: string;
}

/** 动态关联解析后的精选游戏评测数据模型 */
export interface ResolvedFeaturedReview {
  appid: number;
  title: string;
  subtitle: string;
  description: string;
  tag: string;
  status: Status;
  hours: number;
  url: string;
  cover: string;
}

/** 技术实践指南配置项 */
export interface TechnicalGuideDefinition {
  id: string;
  title: string;
  description: string;
  tag: string;
  url: string;
  fallbackDate: string;
}

/** 动态解析后的技术实践指南数据模型 */
export interface ResolvedTechnicalGuide {
  title: string;
  description: string;
  tag: string;
  url: string;
  date: string;
  minutesRead: string;
}

/** 全站看板基础统计指标 */
export interface HomeDashboardStats {
  totalGames: number;
  totalHours: number;
  totalUnlockedAchievements: number;
  updatedAt?: string;
}

/** 首页看板完整聚合数据模型 */
export interface HomeDashboardData {
  totalGames: number;
  totalHours: number;
  totalUnlockedAchievements: number;
  updatedAt?: string;
  stackCovers: string[];
  featuredReviews: ResolvedFeaturedReview[];
  technicalGuides: ResolvedTechnicalGuide[];
}

/** 迷你封面展示(精选自 Steam 个人主页核心代表作: 逆转裁判/只狼/黑神话/黑魂3) */
export const DEFAULT_STACK_COVERS: string[] = [
  'https://cdn.akamai.steamstatic.com/steam/apps/787480/library_600x900.jpg',  // 逆转裁判三部曲 (Favorite)
  'https://cdn.akamai.steamstatic.com/steam/apps/814380/library_600x900.jpg',  // 只狼：影逝二度 (347h / Review)
  'https://cdn.akamai.steamstatic.com/steam/apps/2358720/library_600x900.jpg', // 黑神话：悟空 (81/81 全成就)
  'https://cdn.akamai.steamstatic.com/steam/apps/374320/library_600x900.jpg',  // 黑暗之魂3 (43/43 全成就)
];

/** 默认首页精选评测定义 (只保留关键标识与寄语，核心元数据由真实游戏数据动态注入) */
export const DEFAULT_FEATURED_REVIEW_DEFINITIONS: FeaturedReviewDefinition[] = [
  {
    appid: 814380,
    subtitle: '改变了业界 ARPG 做法的传奇神作',
    description: '游戏名虽不带魂，但是却成为魂，超越魂！一篇关于打铁心流、挫败与战胜自我的深度拆解。',
    tag: '魂类 · 动作',
  },
  {
    appid: 1562700,
    subtitle: '被名字耽误的赛博朋克父女物语',
    description: '宛如电影般流畅的高速钩爪摆荡，在霓虹与雨幕交加中令人动容的顶级叙事收束。',
    tag: '赛博朋克 · 平台动作',
  },
  {
    appid: 960170,
    subtitle: '二十年音游传承，PC下落式手感巅峰',
    description: '键盘与节拍共鸣的纯粹快乐，全方位评测判定机制、曲目生态与千首歌的游玩手感。',
    tag: '下落式 · 节奏音游',
  },
];

/** 默认技术实践指南定义 */
export const DEFAULT_TECHNICAL_GUIDE_DEFINITIONS: TechnicalGuideDefinition[] = [
  {
    id: 'blog/如何通过github-pages和astro构建个人博客',
    title: '如何优雅地构建个人博客网站',
    description: '基于 GitHub Pages 与 Astro 构建完全免费、零后端依赖、加载极致迅速的个人知识花园。',
    tag: '工程实践 · Astro',
    url: '/blog/如何通过github-pages和astro构建个人博客/',
    fallbackDate: '2026-08-02',
  },
  {
    id: 'blog/如何安装msst音乐音源分离工作流',
    title: 'MSST 音乐人声音源分离工作流实操',
    description: '把一首歌高质量拆分为伴奏与人声。全套模型对比、本地环境部署及批量音频处理指南。',
    tag: '多媒体 · AI 工具',
    url: '/blog/如何安装msst音乐音源分离工作流/',
    fallbackDate: '2026-08-10',
  },
];

/**
 * 纯函数: 计算全站基础指标 (游戏数、总游玩小时数、总达成成就数)
 */
export function calculateDashboardStats(
  games: MergedGame[] = [],
  updatedAt?: string
): HomeDashboardStats {
  const totalGames = Array.isArray(games) ? games.length : 0;
  const totalHours = Math.round(
    (Array.isArray(games) ? games : []).reduce(
      (acc, g) => acc + (typeof g?.playtime_hours === 'number' ? g.playtime_hours : 0),
      0
    )
  );
  const totalUnlockedAchievements = (Array.isArray(games) ? games : []).reduce(
    (acc, g) =>
      acc +
      (g?.achievements && typeof g.achievements.unlocked === 'number'
        ? g.achievements.unlocked
        : 0),
    0
  );

  return {
    totalGames,
    totalHours,
    totalUnlockedAchievements,
    updatedAt,
  };
}

/**
 * 纯函数: 动态校验并关联精选游戏长评
 * 依据配置中的 appid，从 games 列表中提取最新名称、时长、状态、长评链接与封面
 */
export function resolveFeaturedReviews(
  definitions: FeaturedReviewDefinition[] = DEFAULT_FEATURED_REVIEW_DEFINITIONS,
  games: MergedGame[] = []
): ResolvedFeaturedReview[] {
  const gameMap = new Map<number, MergedGame>();
  for (const g of games || []) {
    if (g && typeof g.appid === 'number') {
      gameMap.set(g.appid, g);
    }
  }

  return (definitions || []).map((def) => {
    const game = gameMap.get(def.appid);
    const title = def.title || game?.name_zh || game?.name || `AppID ${def.appid}`;
    const hours = game?.playtime_hours ?? 0;
    const status = game?.my_status ?? 'uncompleted';
    const cover =
      game?.cover ||
      `https://cdn.akamai.steamstatic.com/steam/apps/${def.appid}/library_600x900.jpg`;

    let url = `/games#game-${def.appid}`;
    if (game?.blog_url) {
      url = game.blog_url.endsWith('/') ? game.blog_url : `${game.blog_url}/`;
    }

    const tag =
      def.tag ||
      (game?.tags && game.tags.length > 0 ? game.tags.slice(0, 2).join(' · ') : '精选长评');

    return {
      appid: def.appid,
      title,
      subtitle: def.subtitle,
      description: def.description,
      tag,
      status,
      hours,
      url,
      cover,
    };
  });
}

/**
 * 异步函数: 提取并解析技术指南元数据与阅读时长
 */
export async function resolveTechnicalGuides(
  docs: any[] = [],
  definitions: TechnicalGuideDefinition[] = DEFAULT_TECHNICAL_GUIDE_DEFINITIONS,
  renderer?: (entry: any) => Promise<unknown>
): Promise<ResolvedTechnicalGuide[]> {
  return Promise.all(
    (definitions || []).map(async (def) => {
      const entry = (docs || []).find((d) => {
        if (!d || typeof d.id !== 'string') return false;
        const normalizedId = d.id.replace(/\\/g, '/').replace(/\.(md|mdx)$/, '');
        const targetId = def.id.replace(/\\/g, '/').replace(/\.(md|mdx)$/, '');
        return normalizedId === targetId || d.id === def.id;
      });

      let minutesRead = '';
      let date = def.fallbackDate;

      if (entry) {
        const metrics = await resolveReadingMetricsAsync(
          entry,
          typeof renderer === 'function' ? () => renderer(entry) : undefined
        );
        if (metrics.minutesRead) {
          minutesRead = metrics.minutesRead;
        }
        if (entry.data?.pubDate) {
          date = String(entry.data.pubDate);
        }
      }

      return {
        title: def.title,
        description: def.description,
        tag: def.tag,
        url: def.url,
        date,
        minutesRead,
      };
    })
  );
}

/**
 * 纯函数: 解析迷你封面堆叠资源列表
 */
export function resolveStackCovers(customCovers?: string[]): string[] {
  if (Array.isArray(customCovers) && customCovers.length > 0) {
    return customCovers;
  }
  return DEFAULT_STACK_COVERS;
}

export interface GetHomeDashboardDataOptions {
  docs?: any[];
  renderer?: (entry: any) => Promise<unknown>;
  games?: MergedGame[];
  updatedAt?: string;
  featuredReviewDefinitions?: FeaturedReviewDefinition[];
  technicalGuideDefinitions?: TechnicalGuideDefinition[];
  stackCovers?: string[];
}

/**
 * 首页看板数据统一聚合入口
 * 支持直接传入 docs 集合数组，或传入包含自定义配置的选项对象
 */
export async function getHomeDashboardData(
  docsOrOptions?: any[] | GetHomeDashboardDataOptions,
  optionalRenderer?: (entry: any) => Promise<unknown>
): Promise<HomeDashboardData> {
  let docs: any[] = [];
  let renderer: ((entry: any) => Promise<unknown>) | undefined = optionalRenderer;
  let customGames: MergedGame[] | undefined;
  let customUpdatedAt: string | undefined;
  let reviewDefs = DEFAULT_FEATURED_REVIEW_DEFINITIONS;
  let guideDefs = DEFAULT_TECHNICAL_GUIDE_DEFINITIONS;
  let stackCoversInput: string[] | undefined;

  if (Array.isArray(docsOrOptions)) {
    docs = docsOrOptions;
  } else if (docsOrOptions && typeof docsOrOptions === 'object') {
    docs = docsOrOptions.docs ?? [];
    renderer = docsOrOptions.renderer ?? optionalRenderer;
    customGames = docsOrOptions.games;
    customUpdatedAt = docsOrOptions.updatedAt;
    if (docsOrOptions.featuredReviewDefinitions) {
      reviewDefs = docsOrOptions.featuredReviewDefinitions;
    }
    if (docsOrOptions.technicalGuideDefinitions) {
      guideDefs = docsOrOptions.technicalGuideDefinitions;
    }
    stackCoversInput = docsOrOptions.stackCovers;
  }

  // 若未注入 games 数据，则默认使用 steam-data 模块单例加载
  let games = customGames;
  let updatedAt = customUpdatedAt;
  if (!games) {
    const loaded = loadMergedGames();
    games = loaded.games;
    if (updatedAt === undefined) {
      updatedAt = loaded.updatedAt;
    }
  }

  const stats = calculateDashboardStats(games, updatedAt);
  const featuredReviews = resolveFeaturedReviews(reviewDefs, games);
  const technicalGuides = await resolveTechnicalGuides(docs, guideDefs, renderer);
  const stackCovers = resolveStackCovers(stackCoversInput);

  return {
    ...stats,
    stackCovers,
    featuredReviews,
    technicalGuides,
  };
}
