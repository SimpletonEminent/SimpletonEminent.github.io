// 共享数据加载模块:Steam 游戏画廊与右侧游戏列表(TOC)共用
// - 自动数据:public/steam_games.json(每日同步脚本生成,全量覆盖)
// - 手工注释:src/data/steam_annotations.json(用户维护,脚本永不触碰)
// - 成就进度:public/steam_achievements.json(手动跑 check-achievements.mjs 生成)
// 三个数据源按 appid 合并,过滤掉 0h 游戏,缺失字段补默认值,按总时长降序返回。

import { readFileSync } from 'node:fs';

export interface SteamGame {
  appid: number;
  name: string;
  playtime_hours: number;
  playtime_2weeks_hours: number;
  cover: string;
}

export interface Annotation {
  name_zh?: string;
  tags?: string[];
  my_status?: 'uncompleted' | 'completed' | 'perfect';
  my_review?: string;
  blog_url?: string;
  play_year?: string;
  platform?: string;
  /** 发售日期(来自 appdetails release_date.date,如 "2024 年 8 月 20 日") */
  release_date?: string;
}

export type Status = 'uncompleted' | 'completed' | 'perfect';

export interface MergedGame extends SteamGame {
  name_zh: string;
  tags: string[];
  my_status: Status;
  my_review: string;
  blog_url: string;
  play_year: string;
  platform: string;
  release_date: string;
  /** 成就进度(来自 check-achievements.mjs),无成就系统或未抓取时为 undefined */
  achievements?: { unlocked: number; total: number };
}

/** 成就数据文件结构(public/steam_achievements.json) */
interface SteamAchievementsData {
  updatedAt?: string;
  games: Array<{
    appid: number;
    hasStats: boolean;
    unlocked?: number;
    total?: number;
    perfect?: boolean;
  }>;
}

export interface SteamGamesData {
  updatedAt?: string;
  games: SteamGame[];
}

/** 读取并合并两个数据文件,按总时长降序返回。读取失败时返回空列表(渲染空状态)。 */
export function loadMergedGames(): { updatedAt?: string; games: MergedGame[] } {
  let updatedAt: string | undefined;
  let games: SteamGame[] = [];

  try {
    const raw = readFileSync('public/steam_games.json', 'utf-8');
    const data = JSON.parse(raw) as SteamGamesData;
    if (typeof data.updatedAt === 'string' && data.updatedAt) {
      updatedAt = data.updatedAt;
    }
    games = Array.isArray(data.games) ? data.games : [];
  } catch {
    games = [];
  }

  let annotations: Record<string, Annotation> = {};
  try {
    annotations = JSON.parse(
      readFileSync('src/data/steam_annotations.json', 'utf-8')
    ) as Record<string, Annotation>;
  } catch {
    annotations = {};
  }

  // 成就进度:public/steam_achievements.json(手动重跑 check-achievements.mjs 生成)
  let achievementMap = new Map<number, { unlocked: number; total: number }>();
  try {
    const raw = readFileSync('public/steam_achievements.json', 'utf-8');
    const data = JSON.parse(raw) as SteamAchievementsData;
    for (const g of data.games ?? []) {
      if (g.hasStats && typeof g.unlocked === 'number' && typeof g.total === 'number') {
        achievementMap.set(g.appid, { unlocked: g.unlocked, total: g.total });
      }
    }
  } catch {
    achievementMap = new Map();
  }

  // 过滤 0h 游戏:画廊只展示玩过的(用户明确要求,0 时长游戏不重要)
  const filteredGames = games.filter((g) => (g.playtime_hours ?? 0) > 0);

  const merged: MergedGame[] = filteredGames.map((game) => {
    const annotation = annotations[String(game.appid)] ?? {};
    const achievements = achievementMap.get(game.appid);
    return {
      ...game,
      name_zh: annotation.name_zh ?? '',
      tags: annotation.tags ?? [],
      my_status: annotation.my_status ?? 'uncompleted',
      my_review: annotation.my_review ?? '',
      blog_url: annotation.blog_url ?? '',
      play_year: annotation.play_year ?? '',
      platform: annotation.platform ?? '',
      release_date: annotation.release_date ?? '',
      achievements,
    };
  });

  return { updatedAt, games: merged.sort((a, b) => b.playtime_hours - a.playtime_hours) };
}

/** 游玩时长格式化:最多保留 1 位小数,整数不带小数点 */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function statusText(status: Status): string {
  switch (status) {
    case 'completed':
      return '已通关';
    case 'perfect':
      return '全成就🏆';
    default:
      return '未通关';
  }
}

/** 从发售日期字符串提取年份(如 "2024 年 8 月 20 日" → "2024"),无则返回空串 */
export function releaseYear(date: string): string {
  if (!date) return '';
  const m = String(date).match(/\d{4}/);
  return m ? m[0] : '';
}

/** 排序维度:总时长 / 近两周 / 通关状态 / 发售年份 */
export type SortKey = 'playtime' | 'recent' | 'status' | 'release';
export type SortDir = 'asc' | 'desc';

/** 通关状态权重:全成就 > 已通关 > 未通关 */
const STATUS_WEIGHT: Record<Status, number> = { perfect: 3, completed: 2, uncompleted: 1 };

/**
 * 共享排序逻辑:画廊与右侧 TOC 用同一实现,保证两侧顺序一致。
 * 返回一个新数组,不修改入参。
 */
export function sortGames(games: MergedGame[], key: SortKey, dir: SortDir): MergedGame[] {
  const sign = dir === 'desc' ? -1 : 1;
  const sorted = [...games];

  switch (key) {
    case 'playtime':
      sorted.sort((a, b) => (a.playtime_hours - b.playtime_hours) * sign);
      break;
    case 'recent':
      sorted.sort((a, b) => (a.playtime_2weeks_hours - b.playtime_2weeks_hours) * sign);
      break;
    case 'status':
      // 按状态权重排序(desc = 全成就优先);同状态按总时长降序稳定排
      sorted.sort((a, b) => {
        const byStatus = (STATUS_WEIGHT[a.my_status] - STATUS_WEIGHT[b.my_status]) * sign;
        if (byStatus !== 0) return byStatus;
        return b.playtime_hours - a.playtime_hours;
      });
      break;
    case 'release': {
      // 按发售年份排序(desc = 新游戏在前);无年份的排最后
      const yearOf = (g: MergedGame) => {
        const y = releaseYear(g.release_date);
        return y ? Number(y) : Number.NEGATIVE_INFINITY;
      };
      sorted.sort((a, b) => (yearOf(a) - yearOf(b)) * sign);
      break;
    }
  }

  return sorted;
}
