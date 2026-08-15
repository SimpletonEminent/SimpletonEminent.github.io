// 共享数据加载模块:Steam 游戏画廊与右侧游戏列表(TOC)共用
// - 自动数据:public/steam_games.json(每日同步脚本生成,全量覆盖)
// - 手工注释:src/data/steam_annotations.json(用户维护,脚本永不触碰)
// 两个 JSON 按 appid 合并,缺失字段补默认值,按总时长降序返回。

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

  const merged: MergedGame[] = games.map((game) => {
    const annotation = annotations[String(game.appid)] ?? {};
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
