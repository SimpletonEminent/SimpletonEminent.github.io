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
  /** 最后运行时间戳(Unix 秒),0 = 从未运行过 */
  last_played: number;
  cover: string;
}

export interface Annotation {
  name_zh?: string;
  tags?: string[];
  my_status?: Status;
  my_review?: string;
  blog_url?: string;
  play_year?: string;
  platform?: string;
  /** 竞技/网络游戏的历史最高段位(自由文本,如 "璀璨钻石 💎",空 = 未填写) */
  my_rank?: string;
  /** 发售日期(来自 appdetails release_date.date,如 "2024 年 8 月 20 日") */
  release_date?: string;
}

/** 游玩状态六阶梯(ADR-0007):未通关 / 已通关 / 全成就 / 持续游玩 / 暂退长草 / 已退役 */
export type Status = 'uncompleted' | 'completed' | 'perfect' | 'ongoing' | 'hiatus' | 'retired';

export interface MergedGame extends SteamGame {
  name_zh: string;
  tags: string[];
  my_status: Status;
  my_review: string;
  blog_url: string;
  play_year: string;
  platform: string;
  /** 历史最高段位,空串 = 未填写(ADR-0007) */
  my_rank: string;
  release_date: string;
  /** 成就进度(来自 check-achievements.mjs),无成就系统或未抓取时为 undefined */
  achievements?: { unlocked: number; total: number; firstUnlockAt?: number };
  /** 最早成就解锁时间(Unix 秒,ADR-0008)——「首次游玩(估)」,无成就数据时 undefined */
  first_achievement_at?: number;
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
    /** 最早成就解锁时间(Unix 秒,ADR-0008),无则缺省 */
    firstUnlockAt?: number;
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
  let achievementMap = new Map<number, { unlocked: number; total: number; firstUnlockAt?: number }>();
  try {
    const raw = readFileSync('public/steam_achievements.json', 'utf-8');
    const data = JSON.parse(raw) as SteamAchievementsData;
    for (const g of data.games ?? []) {
      if (g.hasStats && typeof g.unlocked === 'number' && typeof g.total === 'number') {
        achievementMap.set(g.appid, {
          unlocked: g.unlocked,
          total: g.total,
          firstUnlockAt: typeof g.firstUnlockAt === 'number' ? g.firstUnlockAt : undefined,
        });
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
      my_rank: annotation.my_rank ?? '',
      release_date: annotation.release_date ?? '',
      achievements,
      first_achievement_at: achievements?.firstUnlockAt,
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
    case 'ongoing':
      return '持续游玩 🎮';
    case 'hiatus':
      return '暂退长草';
    case 'retired':
      return '已退役';
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

/** 排序维度:总时长 / 近两周 / 游玩状态 / 发售年份 / 名称(独立方向) */
export type SortKey = 'playtime' | 'recent' | 'status' | 'release' | 'nameAsc' | 'nameDesc';
export type SortDir = 'asc' | 'desc';

/** 游玩状态权重(ADR-0007 六阶梯):全成就 > 已通关 > 持续游玩 > 未通关 > 暂退长草 > 已退役 */
const STATUS_WEIGHT: Record<Status, number> = {
  perfect: 6,
  completed: 5,
  ongoing: 4,
  uncompleted: 3,
  hiatus: 2,
  retired: 1,
};

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
      // 近期运行过:按最后运行时间戳降序(最近运行的在前);从未运行过(0)排最后
      sorted.sort((a, b) => {
        const da = a.last_played ?? 0;
        const db = b.last_played ?? 0;
        if (da === 0 && db === 0) return b.playtime_hours - a.playtime_hours;
        if (da === 0) return 1;
        if (db === 0) return -1;
        // 时间戳降序(大的=最近在前);不乘 sign,因为此维度固定为"最近在前"
        return db - da;
      });
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
    case 'nameAsc':
      // 游戏名称 A-Z:按英文名自然排序(localeCompare,中文按拼音)
      sorted.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
      break;
    case 'nameDesc':
      // 游戏名称 Z-A:英文名倒序
      sorted.sort((a, b) => String(b.name).localeCompare(String(a.name), 'zh-CN'));
      break;
  }

  return sorted;
}

/**
 * 徽章组合规则(ADR-0007 v2),卡片 / 桌面 TOC / 移动 TOC / 气泡四处共用:
 * - 无段位 → 单徽章:游玩状态
 * - 有段位 → 双徽章:游玩状态 + 段位(段位只是追加信息,绝不顶替游玩状态)
 */
export type Badge =
  | { kind: 'status'; value: Status }
  | { kind: 'rank'; value: string };

export function badgesFor(game: Pick<MergedGame, 'my_status' | 'my_rank'>): Badge[] {
  const rank = game.my_rank.trim();
  if (!rank) {
    return [{ kind: 'status', value: game.my_status }];
  }
  return [
    { kind: 'status', value: game.my_status },
    { kind: 'rank', value: rank },
  ];
}

/** HTML 转义:只在服务端渲染阶段调用;客户端已无拼接行为,不再需要转义助手 */
export function esc(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** 最早成就解锁时间(Unix 秒)→ YYYY-MM-DD(北京时间 UTC+8,中国无夏令时,固定偏移转换) */
export function firstPlayDate(ts: number): string {
  const d = new Date((Number(ts) || 0) * 1000 + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * 气泡内部 HTML 内容(构建期服务端渲染,唯一入口)。
 * 输入 MergedGame,输出 .bubble-content 内的 HTML 字符串。
 * 各行的有无由数据决定(有数据才输出,空行自动消失);
 * 徽章与卡片同源(badgesFor),标签在服务端转义(esc)。
 * 客户端脚本不再内联拼接、不再复制任何纯函数、不再从卡片 DOM 读取徽章。
 */
export function renderBubbleContent(game: MergedGame): string {
  let html = '';

  // Row 1 游戏名称:EN + CN 并列
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">游戏名称</span>';
  html += '<span class="bubble-value">';
  html += esc(game.name);
  if (game.name_zh) {
    html += `<span class="bubble-name-zh">${esc(game.name_zh)}</span>`;
  }
  html += '</span></div>';

  // Row 2 游戏类型:标签胶囊,无标签时整行隐藏
  if (Array.isArray(game.tags) && game.tags.length > 0) {
    html += '<div class="bubble-row">';
    html += '<span class="bubble-label">游戏类型</span>';
    html += '<span class="bubble-value bubble-tags">';
    html += game.tags.map((tag) => `<span class="tag-pill">${esc(tag)}</span>`).join('');
    html += '</span></div>';
  }

  // Row 3 游玩状态:直接由 badgesFor(唯一来源)渲染,与卡片同源,无 DOM 复制 hack
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">游玩状态</span>';
  html += '<span class="bubble-value">';
  for (const badge of badgesFor(game)) {
    if (badge.kind === 'status') {
      html += `<span class="status-badge" data-status="${esc(badge.value)}">${esc(statusText(badge.value))}</span>`;
    } else {
      html += `<span class="status-badge rank-badge">${esc(badge.value)}</span>`;
    }
  }
  html += '</span></div>';

  // Row 4 数据详情
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">数据详情</span>';
  html += '<span class="bubble-value">';
  html += `<strong>总游玩 ${formatHours(game.playtime_hours)} 小时</strong>`;
  html += '<span class="bubble-sep">·</span>';
  html += `近两周 ${formatHours(game.playtime_2weeks_hours)} 小时`;
  html += '</span></div>';

  // Row 5 成就进度:无成就系统(achievements 为 undefined)或总数为 0 时整行隐藏
  if (game.achievements && game.achievements.total > 0) {
    const { unlocked, total } = game.achievements;
    const percent = Math.round((unlocked / total) * 100);
    const trophy = percent === 100 ? ' 🏆' : '';
    html += '<div class="bubble-row">';
    html += '<span class="bubble-label">成就进度</span>';
    html += '<span class="bubble-value">';
    html += '<span class="achievement-wrap">';
    html += `<span class="achievement-bar"><span class="achievement-fill" style="width:${esc(percent)}%"></span></span>`;
    html += `<span class="achievement-text">${esc(percent)}% (${esc(unlocked)}/${esc(total)})${trophy}</span>`;
    html += '</span></span>';
    html += '</div>';
  }

  // Row 6 我的短评
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">我的短评</span>';
  if (game.my_review) {
    html += `<span class="bubble-value">${esc(game.my_review)}</span>`;
  } else {
    html += '<span class="bubble-value bubble-empty">暂无短评</span>';
  }
  html += '</div>';

  // Row 深度评测:blog_url 为空时整行隐藏
  if (game.blog_url) {
    html += '<div class="bubble-row">';
    html += '<span class="bubble-label">深度评测</span>';
    html += '<span class="bubble-value">';
    html += `<a class="bubble-link" href="${esc(game.blog_url)}">📄 查看我的深度评测</a>`;
    html += '</span></div>';
  }

  // 底部:Steam 商店入口 + 元数据(发售年份/首次游玩(估)/游玩年份/平台)
  html += '<div class="bubble-footer">';
  html += `<a class="store-link" href="https://store.steampowered.com/app/${game.appid}" target="_blank" rel="noopener noreferrer">前往 Steam 商店 ↗</a>`;
  const meta: string[] = [];
  const rYear = releaseYear(game.release_date);
  if (rYear) meta.push(`发售年份: ${rYear}`);
  // 首次游玩(估):来自成就 API 最早解锁时间(ADR-0008),无成就数据时不显示
  if (game.first_achievement_at) meta.push(`首次游玩(估): ${firstPlayDate(game.first_achievement_at)}`);
  if (game.play_year) meta.push(`游玩年份: ${esc(game.play_year)}`);
  if (game.platform) meta.push(`平台: ${esc(game.platform)}`);
  if (meta.length > 0) {
    html += `<p class="bubble-meta">${meta.join(' · ')}</p>`;
  }
  html += '</div>';

  return html;
}
