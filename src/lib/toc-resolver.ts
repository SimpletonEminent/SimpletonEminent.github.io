// 目录上下文解析模块 (TOC Resolver, Spec 17)
// 职责:
// 1. 统一根据页面路由路径 (pathname) 判定专属目录策略模式 (games / blog-overview / default)
// 2. 消除桌面端与移动端 TableOfContents 组件在路由判定与数据获取上的双重维护
// 3. 输出强类型辨别联合 (Discriminated Union) View Model，供双端渲染模板消费

import { loadMergedGames, type MergedGame } from './steam-data.ts';
import { filterAndGroupGeneralPosts, type YearGroup, type InputPostEntry } from './blog-meta.ts';

export type TocMode = 'games' | 'blog-overview' | 'default';

export type TocContext =
  | { mode: 'games'; games: MergedGame[] }
  | { mode: 'blog-overview'; yearGroups: YearGroup[] }
  | { mode: 'default' };

export interface ResolveTocOptions {
  /** 可选的文档获取委托函数 (例如 () => getCollection('docs')) */
  getDocs?: () => Promise<InputPostEntry[]> | InputPostEntry[];
  /** 可选的预加载游戏数据 (默认调用 loadMergedGames) */
  games?: MergedGame[];
  /** 可选的预加载年份分组数据 (若提供则直接使用，跳过 getDocs) */
  yearGroups?: YearGroup[];
}

/** 判定是否为游戏画廊路由 (/games 或 /games/*) */
export function isGamesPath(pathname: string): boolean {
  return pathname === '/games' || pathname.startsWith('/games/');
}

/** 判定是否为文章总览门户路由 (/blog 或 /blog/) */
export function isBlogOverviewPath(pathname: string): boolean {
  return pathname === '/blog' || pathname === '/blog/';
}

/** 解析目录模式 (TocMode) */
export function resolveTocMode(pathname: string): TocMode {
  if (isGamesPath(pathname)) return 'games';
  if (isBlogOverviewPath(pathname)) return 'blog-overview';
  return 'default';
}

/**
 * 统一目录上下文解析纯函数 (Spec 17)
 * 接收当前路由 pathname 与可选的数据提供委托，返回对应模式的强类型上下文。
 */
export async function resolveTocContext(
  pathname: string,
  options: ResolveTocOptions = {}
): Promise<TocContext> {
  const mode = resolveTocMode(pathname);

  if (mode === 'games') {
    const games = options.games ?? loadMergedGames().games;
    return { mode: 'games', games };
  }

  if (mode === 'blog-overview') {
    if (options.yearGroups) {
      return { mode: 'blog-overview', yearGroups: options.yearGroups };
    }
    const docs = options.getDocs ? await options.getDocs() : [];
    const yearGroups = filterAndGroupGeneralPosts(docs);
    return { mode: 'blog-overview', yearGroups };
  }

  return { mode: 'default' };
}

/**
 * 同步目录上下文解析纯函数
 * 适用于无需动态拉取文档或已预备好数据的上下文。
 */
export function resolveTocContextSync(
  pathname: string,
  options: { games?: MergedGame[]; yearGroups?: YearGroup[]; docs?: InputPostEntry[] } = {}
): TocContext {
  const mode = resolveTocMode(pathname);

  if (mode === 'games') {
    return { mode: 'games', games: options.games ?? loadMergedGames().games };
  }

  if (mode === 'blog-overview') {
    if (options.yearGroups) {
      return { mode: 'blog-overview', yearGroups: options.yearGroups };
    }
    const docs = options.docs ?? [];
    return { mode: 'blog-overview', yearGroups: filterAndGroupGeneralPosts(docs) };
  }

  return { mode: 'default' };
}
