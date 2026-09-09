// 游戏数据仓库与领域计算模块 (Spec 04 / Spec 06 / ADR-0005)
// - 自动数据: public/steam_games.json (每日同步脚本生成,全量覆盖)
// - 手工注释: src/data/steam_annotations.json (用户维护,脚本永不触碰)
// - 成就进度: public/steam_achievements.json (手动跑 check-achievements.mjs 生成)
// 通过 StorageAdapter 接缝物理隔离存储层，内部封装合并、容错、过滤与排序，对外提供精简领域模型。

import { readFileSync } from 'node:fs';
import { statusWeight, type Status } from './play-status.ts';

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

// 游玩状态类型与文案由唯一词汇模块 src/lib/play-status.ts 提供(Spec 02),
// 此处仅导出供既有消费方(组件/测试)继续引用,词汇单一来源保证。
export type { Status } from './play-status.ts';

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

/** 成就数据文件结构 (public/steam_achievements.json) */
export interface SteamAchievementsData {
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

/** 排序维度:总时长 / 近两周 / 游玩状态 / 发售年份 / 名称(独立方向) */
export type SortKey = 'playtime' | 'recent' | 'status' | 'release' | 'nameAsc' | 'nameDesc';
export type SortDir = 'asc' | 'desc';

/**
 * 抽象存储适配器契约 (Storage Adapter Seam, Spec 06)
 * 规范读取游戏数据文件、注释文件与成就文件的基本抽象接口。
 */
export interface StorageAdapter {
  readGamesData(): string;
  readAnnotations(): string;
  readAchievementsData(): string;
}

export interface FileSystemStorageOptions {
  gamesPath?: string;
  annotationsPath?: string;
  achievementsPath?: string;
}

/**
 * 生产环境文件系统适配器 (默认适配器)
 */
export class FileSystemStorageAdapter implements StorageAdapter {
  private gamesPath: string;
  private annotationsPath: string;
  private achievementsPath: string;

  constructor(options: FileSystemStorageOptions = {}) {
    this.gamesPath = options.gamesPath ?? 'public/steam_games.json';
    this.annotationsPath = options.annotationsPath ?? 'src/data/steam_annotations.json';
    this.achievementsPath = options.achievementsPath ?? 'public/steam_achievements.json';
  }

  readGamesData(): string {
    return readFileSync(this.gamesPath, 'utf-8');
  }

  readAnnotations(): string {
    return readFileSync(this.annotationsPath, 'utf-8');
  }

  readAchievementsData(): string {
    return readFileSync(this.achievementsPath, 'utf-8');
  }
}

export interface MemoryStorageOptions {
  gamesData?: string | null;
  annotations?: string | null;
  achievementsData?: string | null;
}

/**
 * 测试/扩展用内存适配器 (Spec 06)
 * 允许在单元测试中直接注入假数据或模拟读取失败，彻底消灭破坏性磁盘文件操作。
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private gamesData: string | null;
  private annotations: string | null;
  private achievementsData: string | null;

  constructor(options: MemoryStorageOptions = {}) {
    this.gamesData = options.gamesData ?? '';
    this.annotations = options.annotations ?? '';
    this.achievementsData = options.achievementsData ?? '';
  }

  readGamesData(): string {
    if (this.gamesData === null) {
      throw new Error('MemoryStorageAdapter: 模拟游戏数据文件读取失败');
    }
    return this.gamesData;
  }

  readAnnotations(): string {
    if (this.annotations === null) {
      throw new Error('MemoryStorageAdapter: 模拟注释文件读取失败');
    }
    return this.annotations;
  }

  readAchievementsData(): string {
    if (this.achievementsData === null) {
      throw new Error('MemoryStorageAdapter: 模拟成就文件读取失败');
    }
    return this.achievementsData;
  }

  setGamesData(data: string | null): void {
    this.gamesData = data;
  }

  setAnnotations(data: string | null): void {
    this.annotations = data;
  }

  setAchievementsData(data: string | null): void {
    this.achievementsData = data;
  }

  /** 便捷工厂方法: 从普通对象直接生成序列化内存适配器 */
  static fromObjects(data: {
    gamesData?: unknown | null;
    annotations?: unknown | null;
    achievementsData?: unknown | null;
  }): MemoryStorageAdapter {
    return new MemoryStorageAdapter({
      gamesData:
        data.gamesData === null
          ? null
          : data.gamesData !== undefined
            ? JSON.stringify(data.gamesData)
            : '',
      annotations:
        data.annotations === null
          ? null
          : data.annotations !== undefined
            ? JSON.stringify(data.annotations)
            : '',
      achievementsData:
        data.achievementsData === null
          ? null
          : data.achievementsData !== undefined
            ? JSON.stringify(data.achievementsData)
            : '',
    });
  }
}

/**
 * 领域游戏数据仓库 (Game Data Repository, Spec 06)
 * 职责:
 * 1. 通过 StorageAdapter 加载底层数据文件；
 * 2. 处理 JSON 解析容错与缺失字段回退；
 * 3. 过滤 0 时长游戏并完成数据合并；
 * 4. 维护实例级缓存，支持无副作用缓存重置与隔离测试；
 * 5. 预计算各维度的排序序列。
 */
export class GameDataRepository {
  private adapter: StorageAdapter;
  private memoizedMergedGames: { updatedAt?: string; games: MergedGame[] } | null = null;
  private memoizedSortPresets: Record<SortKey, number[]> | null = null;

  constructor(adapter: StorageAdapter = new FileSystemStorageAdapter()) {
    this.adapter = adapter;
  }

  /** 获取当前存储适配器 */
  getAdapter(): StorageAdapter {
    return this.adapter;
  }

  /** 切换存储适配器（会自动重置内部缓存） */
  setAdapter(adapter: StorageAdapter): void {
    this.adapter = adapter;
    this.resetCache();
  }

  /** 重置缓存（支持单测与隔离调用） */
  resetCache(): void {
    this.memoizedMergedGames = null;
    this.memoizedSortPresets = null;
  }

  /** 读取并合并数据源，按总时长降序返回。读取或解析失败时安全回退为空数据 */
  loadMergedGames(): { updatedAt?: string; games: MergedGame[] } {
    if (this.memoizedMergedGames) return this.memoizedMergedGames;

    let updatedAt: string | undefined;
    let games: SteamGame[] = [];

    try {
      const raw = this.adapter.readGamesData();
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
      const raw = this.adapter.readAnnotations();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        annotations = parsed as Record<string, Annotation>;
      }
    } catch {
      annotations = {};
    }

    let achievementMap = new Map<number, { unlocked: number; total: number; firstUnlockAt?: number }>();
    try {
      const raw = this.adapter.readAchievementsData();
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

    // 过滤 0h 游戏: 画廊只展示玩过的(用户明确要求,0 时长游戏不重要)
    const filteredGames = games.filter((g) => (g.playtime_hours ?? 0) > 0);

    const merged: MergedGame[] = filteredGames.map((game) => {
      const annotation = annotations[String(game.appid)] ?? {};
      const achievements = achievementMap.get(game.appid);
      return {
        ...game,
        name_zh: annotation.name_zh ?? '',
        tags: Array.isArray(annotation.tags) ? annotation.tags : [],
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

    this.memoizedMergedGames = {
      updatedAt,
      games: sortGames(merged, 'recent', 'desc'),
    };
    return this.memoizedMergedGames;
  }

  /**
   * 获取预计算的排序结果数组(存储的是 appid)
   * 构建期复用单例结果，供画廊组件和目录组件注入到客户端脚本中(Spec 04)
   */
  getSortPresets(): Record<SortKey, number[]> {
    if (this.memoizedSortPresets) return this.memoizedSortPresets;
    const { games } = this.loadMergedGames();
    this.memoizedSortPresets = {
      recent: sortGames(games, 'recent', 'desc').map((g) => g.appid),
      playtime: sortGames(games, 'playtime', 'desc').map((g) => g.appid),
      status: sortGames(games, 'status', 'desc').map((g) => g.appid),
      release: sortGames(games, 'release', 'desc').map((g) => g.appid),
      nameAsc: sortGames(games, 'nameAsc', 'asc').map((g) => g.appid),
      nameDesc: sortGames(games, 'nameDesc', 'desc').map((g) => g.appid),
    };
    return this.memoizedSortPresets;
  }
}

// 模块级全局单例仓库（保持既有顶级函数行为兼容与构建期记忆化）
let defaultRepository = new GameDataRepository();

export function getDefaultRepository(): GameDataRepository {
  return defaultRepository;
}

export function setDefaultRepository(repo: GameDataRepository): void {
  defaultRepository = repo;
}

/** 重置模块默认单例缓存 */
export function resetGameDataCache(): void {
  defaultRepository.resetCache();
}

/** 读取并合并数据文件,按总时长降序返回。读取失败时返回空列表(渲染空状态)。(模块级单例) */
export function loadMergedGames(): { updatedAt?: string; games: MergedGame[] } {
  return defaultRepository.loadMergedGames();
}

/** 获取预计算的排序结果数组(存储的是 appid) */
export function getSortPresets(): Record<SortKey, number[]> {
  return defaultRepository.getSortPresets();
}

/** 游玩时长格式化:最多保留 1 位小数,整数不带小数点 */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// 状态中文文案由词汇模块提供(contribute from play-status)。保留重导出供既有消费方使用。
export {
  statusText,
  statusText as statusLabel,
  statusWeight,
  statusToKey,
  keyToStatus,
  statusKeys,
  isStatus,
  STATUS_LADDER,
  DEFAULT_STATUS,
} from './play-status.ts';

/** 从发售日期字符串提取年份(如 "2024 年 8 月 20 日" → "2024"),无则返回空串 */
export function releaseYear(date: string): string {
  if (!date) return '';
  const m = String(date).match(/\d{4}/);
  return m ? m[0] : '';
}

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
        const byStatus = (statusWeight(a.my_status) - statusWeight(b.my_status)) * sign;
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

export function badgesFor(game: Pick<MergedGame, 'my_status'> & { my_rank?: string }): Badge[] {
  const rank = (game.my_rank || '').trim();
  if (!rank) {
    return [{ kind: 'status', value: game.my_status }];
  }
  return [
    { kind: 'status', value: game.my_status },
    { kind: 'rank', value: rank },
  ];
}

/** 最早成就解锁时间(Unix 秒)→ YYYY-MM-DD(北京时间 UTC+8,中国无夏令时,固定偏移转换) */
export function firstPlayDate(ts: number): string {
  const d = new Date((Number(ts) || 0) * 1000 + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
