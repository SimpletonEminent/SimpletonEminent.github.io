// Steam 数据管道核心模块 (Spec 07 / Issue #7)
// 职责:
// 1. 单一事实来源集中管理所有数据文件与表格路径常量；
// 2. 具备指数退避重试、状态码智能分流与频率限制的弹性 HTTP 客户端 (ResilientHttpClient)；
// 3. 符合 RFC 规范的双向 CSV 表格编解码器 (支持 UTF-8 BOM、单元格转义与安全校验)；
// 4. 收敛 Steam API 抓取、元数据丰富、成就检查与表格转换的底层编排。

import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as defaultInput, stdout as defaultOutput } from 'node:process';
import {
  statusLabel,
  statusToKey,
  isStatusLabel,
  isStatus,
  DEFAULT_STATUS,
  STATUS_LADDER,
} from '../src/lib/play-status.ts';
import { isValidPlayYear, PLAY_YEAR_HINT } from './lib/play-year.mjs';
import {
  loadAnnotations as loadAnnotationsFromRepo,
  resetGameDataCache,
  FileSystemStorageAdapter,
  type SteamGame,
  type Annotation,
  type SteamGamesData,
  type SteamAchievementsData,
} from '../src/lib/steam-data.ts';

/** 集中维护的公共数据与注释文件路径常量 */
export const PATHS = {
  GAMES: 'public/steam_games.json',
  ANNOTATIONS: 'src/data/steam_annotations.json',
  ACHIEVEMENTS: 'public/steam_achievements.json',
  CSV: 'steam.csv',
} as const;

/** Steam 外部 API 与 CDN 端点 */
export const ENDPOINTS = {
  PLAYER_SERVICE: 'https://api.steampowered.com/IPlayerService',
  USER_STATS: 'https://api.steampowered.com/ISteamUserStats',
  STORE_API: 'https://store.steampowered.com/api',
  COVER_BASE: 'https://cdn.akamai.steamstatic.com/steam/apps',
} as const;

// ==========================================
// 1. 数据持久化辅助函数 (IO Helpers)
// ==========================================

export function loadGamesData(path: string = PATHS.GAMES): SteamGamesData {
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw);
    return {
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      games: Array.isArray(data.games) ? data.games : [],
    };
  } catch {
    return { games: [] };
  }
}

export function saveGamesData(data: SteamGamesData, path: string = PATHS.GAMES): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export function loadAnnotations(path: string = PATHS.ANNOTATIONS): Record<string, Annotation> {
  if (path === PATHS.ANNOTATIONS) {
    return loadAnnotationsFromRepo();
  }
  try {
    const adapter = new FileSystemStorageAdapter({ annotationsPath: path });
    const raw = adapter.readAnnotations();
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, Annotation>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveAnnotations(
  annotations: Record<string, Annotation>,
  path: string = PATHS.ANNOTATIONS
): void {
  writeFileSync(path, `${JSON.stringify(annotations, null, 2)}\n`, 'utf-8');
  if (path === PATHS.ANNOTATIONS) {
    resetGameDataCache();
  }
}

export function loadAchievementsData(path: string = PATHS.ACHIEVEMENTS): SteamAchievementsData {
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw);
    return {
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      games: Array.isArray(data.games) ? data.games : [],
    };
  } catch {
    return { games: [] };
  }
}

export function saveAchievementsData(
  data: SteamAchievementsData,
  path: string = PATHS.ACHIEVEMENTS
): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

// ==========================================
// 2. 弹性 HTTP 客户端 (Resilient HTTP Client)
// ==========================================

export type HttpTransport = (url: string, init?: RequestInit) => Promise<Response>;

/** HTTP 请求业务异常类型，携带状态码供上层精确判断 */
export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface Logger {
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

export interface HttpClientOptions {
  /** 最大尝试次数 (包括首次请求, 默认 3) */
  maxRetries?: number;
  /** 首次重试前初始延时毫秒数 (默认 2000) */
  initialDelayMs?: number;
  /** 指数退避乘数 (默认 2) */
  backoffFactor?: number;
  /** 请求间隔限流毫秒数 (默认 0) */
  requestIntervalMs?: number;
  /** 底层网络 Transport 接缝 (测试可直接 Mock 注入) */
  transport?: HttpTransport;
  /** 日志输出适配器 */
  logger?: Logger;
}

export class ResilientHttpClient {
  private maxRetries: number;
  private initialDelayMs: number;
  private backoffFactor: number;
  private requestIntervalMs: number;
  private transport: HttpTransport;
  private logger: Logger;
  private lastRequestTime = 0;

  constructor(options: HttpClientOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 2000;
    this.backoffFactor = options.backoffFactor ?? 2;
    this.requestIntervalMs = options.requestIntervalMs ?? 0;
    this.transport = options.transport ?? globalThis.fetch;
    this.logger = options.logger ?? {
      warn: (m) => console.warn(m),
      error: (m) => console.error(m),
    };
  }

  /** 休眠延时辅助函数 */
  async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** 速率限制控制: 确保两次请求之间间隔至少达到指定毫秒 */
  async throttle(intervalMs: number = this.requestIntervalMs): Promise<void> {
    if (intervalMs <= 0) return;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < intervalMs) {
      await this.sleep(intervalMs - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * 判断 HTTP 状态码是否为瞬时故障(可重试)
   * 429 (Too Many Requests), 5xx (Server Error) 以及网络抛错属于瞬时故障
   * 400, 403, 404 等属于确定性客户端请求错误，不应重试
   */
  isTransientStatus(status: number): boolean {
    return status === 429 || (status >= 500 && status <= 599);
  }

  /**
   * 带有指数退避与智能故障分类的通用 JSON 获取方法
   */
  async fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.throttle();
        const res = await this.transport(url, init);

        if (res.ok) {
          return (await res.json()) as T;
        }

        // 非 2xx 响应处理
        const status = res.status;
        const err = new HttpError(`HTTP ${status} (attempt ${attempt})`, status);

        if (!this.isTransientStatus(status)) {
          // 404 / 403 等非瞬时错误直接抛出，不浪费重试次数
          throw err;
        }

        lastError = err;
      } catch (err) {
        if (err instanceof HttpError && !this.isTransientStatus(err.status)) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // 若未达到最大尝试次数，则计算指数退避延时并重试
      if (attempt < this.maxRetries) {
        const delay = this.initialDelayMs * Math.pow(this.backoffFactor, attempt - 1);
        const cleanUrl = url.split('?')[0];
        this.logger.warn?.(
          `重试 ${attempt}/${this.maxRetries}: ${cleanUrl} -> ${lastError?.message ?? 'error'}, ${delay}ms 后重试`
        );
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error(`请求失败: ${url}`);
  }

  /** 执行原始网络请求并返回 Response 对象 (同样具备退避重试保护) */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.throttle();
        const res = await this.transport(url, init);
        if (res.ok || !this.isTransientStatus(res.status)) {
          return res;
        }
        lastError = new HttpError(`HTTP ${res.status} (attempt ${attempt})`, res.status);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < this.maxRetries) {
        const delay = this.initialDelayMs * Math.pow(this.backoffFactor, attempt - 1);
        this.logger.warn?.(
          `重试 ${attempt}/${this.maxRetries}: ${url.split('?')[0]} -> ${lastError?.message}, ${delay}ms 后重试`
        );
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error(`请求失败: ${url}`);
  }
}

// ==========================================
// 3. Steam API 领域抓取封装
// ==========================================

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

interface GetOwnedGamesResponse {
  response?: {
    game_count?: number;
    games?: Array<{
      appid: number;
      name: string;
      playtime_forever: number;
      rtime_last_played?: number;
    }>;
  };
}

interface GetRecentlyPlayedGamesResponse {
  response?: {
    games?: Array<{
      appid: number;
      playtime_2weeks?: number;
    }>;
  };
}

/** 完整执行 Steam 游戏与游玩时长全量同步 */
export async function syncSteamGames(options: {
  apiKey: string;
  steamId: string;
  client?: ResilientHttpClient;
}): Promise<SteamGamesData> {
  const { apiKey, steamId } = options;
  const client = options.client ?? new ResilientHttpClient();

  // 1) 全部拥有的游戏(含免费游戏)
  const ownedUrl = `${ENDPOINTS.PLAYER_SERVICE}/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;
  const owned = await client.fetchJson<GetOwnedGamesResponse>(ownedUrl);
  const ownedGames = owned?.response?.games ?? [];

  if (ownedGames.length === 0) {
    throw new Error(
      'GetOwnedGames 返回空列表: 请检查 STEAM_ID 是否正确，以及 Steam 隐私设置中“游戏详情”是否公开'
    );
  }

  // 2) 近两周玩过的游戏 (用于计算近两周时长)
  const recentUrl = `${ENDPOINTS.PLAYER_SERVICE}/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${steamId}&count=0&format=json`;
  const recent = await client.fetchJson<GetRecentlyPlayedGamesResponse>(recentUrl);
  const recentMap = new Map((recent?.response?.games ?? []).map((g) => [g.appid, g]));

  const games: SteamGame[] = ownedGames
    .map((g) => {
      const recentGame = recentMap.get(g.appid);
      return {
        appid: g.appid,
        name: g.name,
        playtime_hours: minutesToHours(g.playtime_forever ?? 0),
        playtime_2weeks_hours: minutesToHours(recentGame?.playtime_2weeks ?? 0),
        last_played: g.rtime_last_played ?? 0,
        cover: `${ENDPOINTS.COVER_BASE}/${g.appid}/library_600x900.jpg`,
      };
    })
    .sort((a, b) => b.playtime_hours - a.playtime_hours);

  return {
    updatedAt: new Date().toISOString(),
    games,
  };
}

export interface AppDetailsResult {
  name_zh: string;
  genres: string[];
  release_date: string;
}

/** 抓取单款游戏在 Steam 商店的中文名、分类与官方发售日期 */
export async function fetchAppDetails(
  appid: number,
  client: ResilientHttpClient = new ResilientHttpClient({ requestIntervalMs: 1600 })
): Promise<AppDetailsResult | null> {
  const url = `${ENDPOINTS.STORE_API}/appdetails?appids=${appid}&l=schinese&cc=cn`;
  const res = await client.fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as Record<
    string,
    {
      success: boolean;
      data?: {
        name?: string;
        genres?: Array<{ description: string }>;
        release_date?: { date?: string };
      };
    }
  >;
  const data = json?.[String(appid)]?.data;
  if (!data) return null;

  return {
    name_zh: data.name ?? '',
    genres: (data.genres ?? []).map((g) => g.description).filter(Boolean),
    release_date: data.release_date?.date ?? '',
  };
}

export type PlayerAchievementsResult =
  | {
      unlocked: number;
      total: number;
      firstUnlockAt?: number;
    }
  | { error: string };

interface AchievementsApiResponse {
  playerstats?: {
    error?: string;
    achievements?: Array<{
      apiname: string;
      achieved: number;
      unlocktime?: number;
    }>;
  };
}

/** 抓取用户在指定游戏中的成就解锁数量与最早解锁时间戳 */
export async function fetchPlayerAchievements(
  apiKey: string,
  steamId: string,
  appid: number,
  client: ResilientHttpClient = new ResilientHttpClient({ requestIntervalMs: 1300 })
): Promise<PlayerAchievementsResult> {
  const url = `${ENDPOINTS.USER_STATS}/GetPlayerAchievements/v1/?key=${apiKey}&steamid=${steamId}&appid=${appid}&format=json`;
  const res = await client.fetch(url);
  const json = (await res.json().catch(() => null)) as AchievementsApiResponse | null;
  const ps = json?.playerstats;

  if (res.status === 400 || (res.status === 200 && ps?.error)) {
    return { error: ps?.error ?? `HTTP ${res.status}` };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const list = Array.isArray(ps?.achievements) ? ps.achievements : [];
  const unlocked = list.filter((a) => a.achieved === 1);
  const firstUnlockAt = unlocked
    .map((a) => a.unlocktime)
    .filter((t): t is number => typeof t === 'number' && t > 0)
    .sort((a, b) => a - b)[0];

  return {
    unlocked: unlocked.length,
    total: list.length,
    firstUnlockAt,
  };
}

// ==========================================
// 4. 标准化 RFC 兼容 CSV 编解码器 (Tabular Codec)
// ==========================================

export interface CsvColumn {
  key: string;
  label: string;
  readonly?: boolean;
  options?: string[];
}

export const CSV_COLUMNS: CsvColumn[] = [
  { key: 'appid', label: 'appid', readonly: true },
  { key: 'name', label: '游戏名(参考)', readonly: true },
  { key: 'name_zh', label: '中文名(可编辑)' },
  { key: 'my_status', label: '游玩状态', options: STATUS_LADDER.map((s) => s.label) },
  { key: 'my_rank', label: '最高段位' },
  { key: 'my_review', label: '短评' },
  { key: 'blog_url', label: '长评链接' },
  { key: 'play_year', label: '游玩年份' },
  { key: 'platform', label: '平台', options: ['PC', 'PlayStation', 'Xbox', 'Switch'] },
  { key: 'tags', label: '特色标签(分号分隔)' },
];

/** CSV 单元格转义: 符合 RFC 4180 标准 (含双引号、逗号、换行时用双引号包裹，内部引号双重转义) */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

/** RFC 4180 兼容的通用 CSV 文本解析器 (支持带 BOM、多行引号字段与转义引号) */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** 将二维字符串数组序列化为符合 RFC 标准且附带 UTF-8 BOM 的 CSV 文本 */
export function serializeCsv(rows: string[][]): string {
  const bom = '\uFEFF';
  const body = rows.map((r) => r.map((cell) => escapeCsvCell(cell)).join(',')).join('\r\n');
  return bom + body + '\r\n';
}

/** 将游戏列表与手写注释导出为 CSV 文本 (附带列选项提示) */
export function exportAnnotationsToCsv(
  games: SteamGame[],
  annotations: Record<string, Annotation>
): string {
  const header = CSV_COLUMNS.map((c) =>
    c.options ? `${c.label}(${c.options.join('/')})` : c.label
  );

  const rows: string[][] = [header];

  for (const game of games) {
    const ann = annotations[String(game.appid)] ?? {};
    const values: Record<string, unknown> = {
      appid: game.appid,
      name: game.name,
      name_zh: ann.name_zh ?? '',
      my_status: statusLabel(ann.my_status ?? DEFAULT_STATUS),
      my_rank: ann.my_rank ?? '',
      my_review: ann.my_review ?? '',
      blog_url: ann.blog_url ?? '',
      play_year: ann.play_year ?? '',
      platform: ann.platform ?? '',
      tags: Array.isArray(ann.tags) ? ann.tags.join(';') : '',
    };
    rows.push(CSV_COLUMNS.map((c) => (values[c.key] !== undefined ? String(values[c.key]) : '')));
  }

  return serializeCsv(rows);
}

export interface CsvImportResult {
  annotations: Record<string, Annotation>;
  updated: number;
  ignored: number;
  warnings: string[];
}

const HEADER_TO_KEY: Record<string, string> = {
  appid: 'appid',
  游戏名: 'name',
  中文名: 'name_zh',
  游玩状态: 'my_status',
  最高段位: 'my_rank',
  短评: 'my_review',
  长评链接: 'blog_url',
  游玩年份: 'play_year',
  平台: 'platform',
  特色标签: 'tags',
};

/** 从 CSV 文本安全导回更新手写注释 (三重安全防护) */
export function importAnnotationsFromCsv(
  csvText: string,
  currentAnnotations: Record<string, Annotation>,
  knownAppids?: Set<string>
): CsvImportResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('CSV 中没有有效数据行');
  }

  const header = rows[0];
  const idx: Record<string, number> = {};

  for (let i = 0; i < header.length; i++) {
    const h = header[i].split('(')[0].trim();
    const key = HEADER_TO_KEY[h];
    if (key) idx[key] = i;
  }

  if (idx.appid === undefined || idx.my_status === undefined) {
    throw new Error(
      `CSV 表头列不匹配。期望表头中包含 appid 与 游玩状态，实际表头: ${header.join(' | ')}`
    );
  }

  const annotations: Record<string, Annotation> = JSON.parse(JSON.stringify(currentAnnotations));
  const validAppids = knownAppids ?? new Set(Object.keys(annotations));

  let updated = 0;
  let ignored = 0;
  const warnings: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const appid = (row[idx.appid] ?? '').trim();

    // 安全防护 1: 只认已知 appid, 忽略新增行或空行
    if (!appid || !validAppids.has(appid)) {
      ignored++;
      continue;
    }

    const ann = annotations[appid] ?? {};

    // 中文名: 可编辑(用户手写优先), 空则清空
    if (idx.name_zh !== undefined) {
      const nameZh = (row[idx.name_zh] ?? '').trim();
      if (nameZh) {
        ann.name_zh = nameZh;
      } else {
        delete ann.name_zh;
      }
    }

    // 游玩状态: 非法值或空值安全回退为 DEFAULT_STATUS
    if (idx.my_status !== undefined) {
      const statusText = (row[idx.my_status] ?? '').trim();
      if (statusText) {
        if (isStatusLabel(statusText)) {
          ann.my_status = statusToKey(statusText);
        } else {
          warnings.push(`[${appid}] 游玩状态"${statusText}"非法, 回退为未通关`);
          ann.my_status = DEFAULT_STATUS;
        }
      } else {
        ann.my_status = DEFAULT_STATUS;
      }
    }

    // 最高段位: 自由文本, 空则清空
    if (idx.my_rank !== undefined) {
      const myRank = (row[idx.my_rank] ?? '').trim();
      if (myRank) {
        ann.my_rank = myRank;
      } else {
        delete ann.my_rank;
      }
    }

    // 短评: 空则清空
    if (idx.my_review !== undefined) {
      const review = (row[idx.my_review] ?? '').trim();
      if (review) {
        ann.my_review = review;
      } else {
        delete ann.my_review;
      }
    }

    // 长评链接: 空则清空
    if (idx.blog_url !== undefined) {
      const blogUrl = (row[idx.blog_url] ?? '').trim();
      if (blogUrl) {
        ann.blog_url = blogUrl;
      } else {
        delete ann.blog_url;
      }
    }

    // 游玩年份: 单年(2024)或区间(2021-2026), 空则清空, 非法值警告并跳过
    if (idx.play_year !== undefined) {
      const playYear = (row[idx.play_year] ?? '').trim();
      if (playYear) {
        if (isValidPlayYear(playYear)) {
          ann.play_year = playYear;
        } else {
          warnings.push(`[${appid}] 游玩年份"${playYear}"非法 (需 ${PLAY_YEAR_HINT}), 已跳过不写入`);
        }
      } else {
        delete ann.play_year;
      }
    }

    // 平台: 空则清空
    if (idx.platform !== undefined) {
      const platform = (row[idx.platform] ?? '').trim();
      if (platform) {
        ann.platform = platform;
      } else {
        delete ann.platform;
      }
    }

    // tags: 分号拆分, 空则清空
    if (idx.tags !== undefined) {
      const tagsRaw = (row[idx.tags] ?? '').trim();
      if (tagsRaw) {
        const tags = tagsRaw
          .split(/[;；]/)
          .map((t) => t.trim())
          .filter(Boolean);
        if (tags.length > 0) {
          ann.tags = tags;
        } else {
          delete ann.tags;
        }
      } else {
        delete ann.tags;
      }
    }

    annotations[appid] = ann;
    updated++;
  }

  return {
    annotations,
    updated,
    ignored,
    warnings,
  };
}

// ==========================================
// 5. 进程内可调用数据维护操作 (In-process Pipeline Operations)
// ==========================================

export function resolveLogger(customLogger?: Logger): Required<Logger> {
  return {
    log: customLogger?.log ?? ((msg: string) => console.log(msg)),
    warn: customLogger?.warn ?? ((msg: string) => console.warn(msg)),
    error: customLogger?.error ?? ((msg: string) => console.error(msg)),
  };
}

export interface EnrichMetadataOptions {
  gamesPath?: string;
  annotationsPath?: string;
  client?: ResilientHttpClient;
  logger?: Logger;
}

export interface EnrichMetadataResult {
  enriched: number;
  skipped: number;
  annotations: Record<string, Annotation>;
}

export async function runEnrichMetadata(
  options: EnrichMetadataOptions = {}
): Promise<EnrichMetadataResult> {
  const gamesPath = options.gamesPath ?? PATHS.GAMES;
  const annotationsPath = options.annotationsPath ?? PATHS.ANNOTATIONS;
  const logger = resolveLogger(options.logger);

  const { games } = loadGamesData(gamesPath);
  if (games.length === 0) {
    const msg = `读取 ${gamesPath} 失败或游戏列表为空`;
    logger.error(msg);
    throw new Error(msg);
  }

  const annotations = loadAnnotations(annotationsPath);
  const client = options.client ?? new ResilientHttpClient({ requestIntervalMs: 1600 });
  let enriched = 0;
  let skipped = 0;

  for (const game of games) {
    const key = String(game.appid);
    const ann = annotations[key] ?? {};
    const hasNameZh = Boolean(ann.name_zh);
    const hasTags = Array.isArray(ann.tags) && ann.tags.length > 0;
    const hasReleaseDate = Boolean(ann.release_date);

    if (hasNameZh && hasTags && hasReleaseDate) {
      skipped++;
      continue;
    }

    try {
      const detail = await fetchAppDetails(game.appid, client);
      if (!detail) {
        logger.warn(`appid ${game.appid} 无详情数据, 跳过`);
        skipped++;
        continue;
      }
      if (!hasNameZh && detail.name_zh) ann.name_zh = detail.name_zh;
      if (!hasTags && detail.genres.length > 0) ann.tags = detail.genres;
      if (!hasReleaseDate && detail.release_date) ann.release_date = detail.release_date;
      annotations[key] = ann;
      enriched++;
      logger.log(
        `[${key}] ${game.name} -> 中文名:${ann.name_zh ?? '-'} tags:[${(ann.tags ?? []).join(', ')}] 发售:${ann.release_date ?? '-'}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`appid ${game.appid} 请求失败:${msg}, 跳过(可重跑)`);
      skipped++;
    }
  }

  saveAnnotations(annotations, annotationsPath);
  logger.log(`完成: 丰富 ${enriched} 款, 跳过 ${skipped} 款 -> ${annotationsPath}`);
  return { enriched, skipped, annotations };
}

export interface SyncGamesOptions {
  apiKey?: string;
  steamId?: string;
  gamesPath?: string;
  client?: ResilientHttpClient;
  logger?: Logger;
}

export interface SyncGamesResult {
  count: number;
  data: SteamGamesData;
}

export async function runSyncGames(
  options: SyncGamesOptions = {}
): Promise<SyncGamesResult> {
  const apiKey = options.apiKey || process.env.STEAM_API_KEY;
  const steamId = options.steamId || process.env.STEAM_ID;
  const gamesPath = options.gamesPath ?? PATHS.GAMES;
  const logger = resolveLogger(options.logger);

  if (!apiKey || !steamId) {
    const msg = '缺少环境变量 STEAM_API_KEY 或 STEAM_ID';
    logger.error(msg);
    throw new Error(msg);
  }

  const client = options.client ?? new ResilientHttpClient();
  const data = await syncSteamGames({ apiKey, steamId, client });
  saveGamesData(data, gamesPath);
  logger.log(`同步完成: ${data.games.length} 款游戏 -> ${gamesPath}`);
  return { count: data.games.length, data };
}

export interface CheckAchievementsOptions {
  apiKey?: string;
  steamId?: string;
  gamesPath?: string;
  achievementsPath?: string;
  onlyAppid?: number | string;
  client?: ResilientHttpClient;
  logger?: Logger;
}

export interface CheckAchievementsResult {
  total: number;
  perfectCount: number;
  data: SteamAchievementsData;
}

export async function runCheckAchievements(
  options: CheckAchievementsOptions = {}
): Promise<CheckAchievementsResult> {
  const apiKey = options.apiKey || process.env.STEAM_API_KEY;
  const steamId = options.steamId || process.env.STEAM_ID;
  const gamesPath = options.gamesPath ?? PATHS.GAMES;
  const achievementsPath = options.achievementsPath ?? PATHS.ACHIEVEMENTS;
  const logger = resolveLogger(options.logger);

  if (!apiKey || !steamId) {
    const msg = '缺少环境变量 STEAM_API_KEY 或 STEAM_ID';
    logger.error(msg);
    throw new Error(msg);
  }

  let { games } = loadGamesData(gamesPath);
  const onlyAppid = options.onlyAppid ? String(options.onlyAppid) : undefined;
  if (onlyAppid) {
    games = games.filter((g) => String(g.appid) === onlyAppid);
  }

  if (games.length === 0) {
    const msg = `${gamesPath} 中没有可检查的游戏`;
    logger.error(msg);
    throw new Error(msg);
  }

  const client = options.client ?? new ResilientHttpClient({ requestIntervalMs: 1300 });
  const results: any[] = [];
  let perfectCount = 0;
  let noStatsCount = 0;

  for (let i = 0; i < games.length; i++) {
    const { appid, name } = games[i];
    let entry: any;
    try {
      const r = await fetchPlayerAchievements(apiKey, steamId, appid, client);
      entry = { appid, name };
      if ('error' in r) {
        if (/no stats/i.test(r.error)) {
          entry.hasStats = false;
          noStatsCount++;
        } else if (/not public|private/i.test(r.error)) {
          const msg = `隐私设置阻止成就查询: ${r.error}。请将 Steam 个人资料与“游戏详情”隐私设为 Public 后重试。`;
          logger.error(msg);
          throw new Error(msg);
        } else {
          entry.hasStats = false;
          entry.error = r.error;
          logger.warn(`appid ${appid}(${name}) 无成就数据: ${r.error}`);
          noStatsCount++;
        }
      } else {
        entry.hasStats = true;
        entry.unlocked = r.unlocked;
        entry.total = r.total;
        if (r.firstUnlockAt) entry.firstUnlockAt = r.firstUnlockAt;
        entry.perfect = r.total > 0 && r.unlocked === r.total;
        if (entry.perfect) perfectCount++;
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('隐私设置阻止成就查询')) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      entry = { appid, name, hasStats: false, error: msg };
      logger.warn(`appid ${appid}(${name}) 查询失败: ${msg}, 已跳过(可重跑补)`);
      noStatsCount++;
    }

    results.push(entry);
    const flag = entry.perfect ? ' [全成就]' : '';
    logger.log(`[${i + 1}/${games.length}] ${name} (${appid})${flag}`);
  }

  const output: SteamAchievementsData & { total?: number; perfectCount?: number } = {
    updatedAt: new Date().toISOString(),
    total: results.length,
    perfectCount,
    games: results,
  };

  saveAchievementsData(output, achievementsPath);

  logger.log('');
  logger.log(
    `检查完成: ${results.length} 款, 有成就 ${results.filter((g: any) => g.hasStats).length} 款, 全成就 ${perfectCount} 款`
  );
  logger.log('全成就(perfect 候选)清单:');
  for (const g of results.filter((g: any) => g.perfect)) {
    logger.log(`  [${g.appid}] ${g.name} (${g.unlocked}/${g.total})`);
  }
  logger.log(`完整结果 -> ${achievementsPath}`);

  return { total: results.length, perfectCount, data: output };
}

export interface FillPlayYearOptions {
  gamesPath?: string;
  annotationsPath?: string;
  logger?: Logger;
}

export interface FillPlayYearResult {
  filled: number;
  cleared: number;
  preserved: number;
  annotations: Record<string, Annotation>;
}

export async function runFillPlayYear(
  options: FillPlayYearOptions = {}
): Promise<FillPlayYearResult> {
  const gamesPath = options.gamesPath ?? PATHS.GAMES;
  const annotationsPath = options.annotationsPath ?? PATHS.ANNOTATIONS;
  const logger = resolveLogger(options.logger);

  const { games } = loadGamesData(gamesPath);
  if (games.length === 0) {
    const msg = `读取 ${gamesPath} 失败或为空`;
    logger.error(msg);
    throw new Error(msg);
  }

  const annotations = loadAnnotations(annotationsPath);

  let filled = 0;
  let cleared = 0;
  let preserved = 0;

  for (const game of games) {
    const key = String(game.appid);
    const ann = annotations[key];
    if (!ann) continue;

    // 区间值(含 '-')是策展数据: 既不覆盖也不清空
    if (typeof ann.play_year === 'string' && ann.play_year.includes('-')) {
      preserved++;
      continue;
    }

    const ts = game.last_played ?? 0;
    if (ts > 0) {
      const year = String(new Date(ts * 1000).getUTCFullYear());
      if (ann.play_year !== year) {
        ann.play_year = year;
        filled++;
      }
    } else if (ann.play_year) {
      // 从未运行过: 清空 play_year(没有最后运行年份可填)
      delete ann.play_year;
      cleared++;
    }
  }

  saveAnnotations(annotations, annotationsPath);
  logger.log(
    `完成: 填充 ${filled} 条, 清空 ${cleared} 条(从未运行), 保留区间 ${preserved} 条 -> ${annotationsPath}`
  );
  return { filled, cleared, preserved, annotations };
}

export interface JsonToCsvOptions {
  gamesPath?: string;
  annotationsPath?: string;
  csvPath?: string;
  logger?: Logger;
}

export interface JsonToCsvResult {
  rowCount: number;
  csvPath: string;
}

export async function runJsonToCsv(
  options: JsonToCsvOptions = {}
): Promise<JsonToCsvResult> {
  const gamesPath = options.gamesPath ?? PATHS.GAMES;
  const annotationsPath = options.annotationsPath ?? PATHS.ANNOTATIONS;
  const csvPath = options.csvPath ?? PATHS.CSV;
  const logger = resolveLogger(options.logger);

  const { games } = loadGamesData(gamesPath);
  const annotations = loadAnnotations(annotationsPath);
  const csvContent = exportAnnotationsToCsv(games, annotations);

  writeFileSync(csvPath, csvContent, 'utf-8');
  logger.log(`已导出 ${games.length} 行 -> ${csvPath}`);
  logger.log('在 Excel/WPS 中打开编辑, 填完后保存为 CSV(UTF-8), 再运行 csv-to-json');
  return { rowCount: games.length, csvPath };
}
export const runExportCsv = runJsonToCsv;

export interface CsvToJsonOptions {
  gamesPath?: string;
  annotationsPath?: string;
  csvPath?: string;
  logger?: Logger;
}

export async function runCsvToJson(
  options: CsvToJsonOptions = {}
): Promise<CsvImportResult> {
  const gamesPath = options.gamesPath ?? PATHS.GAMES;
  const annotationsPath = options.annotationsPath ?? PATHS.ANNOTATIONS;
  const csvPath = options.csvPath ?? PATHS.CSV;
  const logger = resolveLogger(options.logger);

  let csvText: string;
  try {
    csvText = readFileSync(csvPath, 'utf-8');
  } catch (err) {
    const msg = `读取 ${csvPath} 失败: ${err instanceof Error ? err.message : String(err)}`;
    logger.error(msg);
    logger.error('请先运行 json-to-csv 导出表格, 编辑后再运行本脚本。');
    throw new Error(msg);
  }

  const currentAnnotations = loadAnnotations(annotationsPath);
  const { games } = loadGamesData(gamesPath);
  const knownAppids =
    games.length > 0
      ? new Set(games.map((g) => String(g.appid)))
      : new Set(Object.keys(currentAnnotations));

  const result = importAnnotationsFromCsv(csvText, currentAnnotations, knownAppids);
  saveAnnotations(result.annotations, annotationsPath);

  logger.log(
    `完成: 更新 ${result.updated} 款, 忽略 ${result.ignored} 行(未知 appid 或空行) -> ${annotationsPath}`
  );

  if (result.warnings.length > 0) {
    logger.log(`\n警告(${result.warnings.length}):`);
    result.warnings.slice(0, 10).forEach((w) => logger.log(`  ${w}`));
    if (result.warnings.length > 10) logger.log(`  ...等共 ${result.warnings.length} 条`);
  }

  return result;
}
export const runImportCsv = runCsvToJson;

export interface AddReviewOptions {
  gamesPath?: string;
  annotationsPath?: string;
  ask?: (query: string) => Promise<string>;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  logger?: Logger;
}

export interface AddReviewResult {
  appid: string;
  updated: boolean;
  annotation: Annotation;
}

export async function runAddReview(
  options: AddReviewOptions = {}
): Promise<AddReviewResult | null> {
  const gamesPath = options.gamesPath ?? PATHS.GAMES;
  const annotationsPath = options.annotationsPath ?? PATHS.ANNOTATIONS;
  const logger = resolveLogger(options.logger);

  const { games } = loadGamesData(gamesPath);
  if (games.length === 0) {
    const msg = `读取 ${gamesPath} 失败或游戏列表为空`;
    logger.error(msg);
    throw new Error(msg);
  }
  const annotations = loadAnnotations(annotationsPath);

  let rl: ReturnType<typeof createInterface> | null = null;
  let ask: (q: string) => Promise<string>;

  if (options.ask) {
    ask = options.ask;
  } else {
    const inStream = options.input ?? defaultInput;
    const outStream = options.output ?? defaultOutput;
    if ((inStream as any).isTTY) {
      rl = createInterface({ input: inStream, output: outStream });
      ask = (q: string) => rl!.question(q);
    } else {
      let allLines: string[] = [];
      let cursor = 0;
      try {
        allLines = readFileSync(0, 'utf-8').split(/\r?\n/);
      } catch {
        // 管道读取若不可用则跳过
      }
      ask = async (q: string) => {
        outStream.write(q);
        const line = allLines[cursor] ?? '';
        cursor += 1;
        outStream.write(line + '\n');
        return line;
      };
    }
  }

  const STATUS_OPTIONS = STATUS_LADDER.map((s) => ({ key: s.key, label: s.label }));

  try {
    let selectedGame: SteamGame | null = null;
    while (!selectedGame) {
      const raw = (await ask('输入游戏名关键词或 appid(直接回车退出): ')).trim();
      if (!raw) return null;
      if (/^\d+$/.test(raw)) {
        const appid = Number(raw);
        const game = games.find((g) => g.appid === appid);
        if (game) {
          selectedGame = game;
          break;
        }
        logger.log(`appid ${appid} 不在 ${gamesPath} 中,请重试`);
        continue;
      }
      const q = raw.toLowerCase();
      const matches = games.filter((g) => {
        const nameZh = annotations[String(g.appid)]?.name_zh ?? '';
        return g.name.toLowerCase().includes(q) || nameZh.toLowerCase().includes(q);
      });
      if (matches.length === 0) {
        logger.log('没有匹配的游戏,换个关键词试试');
        continue;
      }
      if (matches.length === 1) {
        selectedGame = matches[0];
        break;
      }
      const shown = matches.slice(0, 10);
      shown.forEach((g, i) => {
        const nameZh = annotations[String(g.appid)]?.name_zh ?? '';
        const display = nameZh ? `${nameZh} (${g.name})` : g.name;
        logger.log(`  ${i + 1}. ${display}  [${g.appid}]  ${g.playtime_hours}h`);
      });
      const pick = (await ask('选择序号(回车选第 1 个): ')).trim();
      const n = pick === '' ? 1 : Number(pick);
      if (Number.isInteger(n) && n >= 1 && n <= shown.length) {
        selectedGame = shown[n - 1];
        break;
      }
      logger.log('序号无效,重试');
    }

    const appid = String(selectedGame.appid);
    const existing = annotations[appid] ?? {};
    const nameZh = existing.name_zh ?? '';
    const display = nameZh ? `${nameZh} (${selectedGame.name})` : selectedGame.name;
    logger.log(`\n已选中:${display}  [${appid}]  ${selectedGame.playtime_hours}h`);
    if (Object.keys(existing).length > 0) {
      logger.log(`当前注释: ${JSON.stringify(existing)}`);
    } else {
      logger.log('当前注释: (无)');
    }

    logger.log('\n游玩状态(六阶梯):');
    STATUS_OPTIONS.forEach((s, i) => {
      const mark = s.key === existing.my_status ? ' (当前)' : '';
      logger.log(`  ${i + 1}. ${s.label}${mark}`);
    });
    let status = existing.my_status ?? DEFAULT_STATUS;
    while (true) {
      const answer = (await ask('选择状态序号(回车保持当前/默认未通关): ')).trim();
      if (answer === '') {
        status = existing.my_status && isStatus(existing.my_status) ? existing.my_status : DEFAULT_STATUS;
        break;
      }
      const n = Number(answer);
      if (Number.isInteger(n) && n >= 1 && n <= STATUS_OPTIONS.length) {
        status = STATUS_OPTIONS[n - 1].key;
        break;
      }
      logger.log('请输入 1-6');
    }

    const rank = (await ask('🎮 如果这是竞技/网络游戏,请输入你的历史最高段位 (直接回车跳过): ')).trim();
    const review = (await ask('短评内容 (直接回车跳过): ')).trim();
    const blogUrl = (await ask('长评链接 (直接回车跳过,注意用小写路由): ')).trim();
    const playYear = (await ask('游玩年份 (直接回车跳过;单年如 2024 或区间如 2021-2026): ')).trim();
    if (playYear && !isValidPlayYear(playYear)) {
      logger.log(`游玩年份"${playYear}"非法(需 ${PLAY_YEAR_HINT}),已跳过不写入`);
    }
    const platform = (await ask('平台 (直接回车默认 PC): ')).trim() || 'PC';

    const updates: Partial<Annotation> = { my_status: status };
    if (rank) updates.my_rank = rank;
    if (review) updates.my_review = review;
    if (blogUrl) updates.blog_url = blogUrl;
    if (playYear && isValidPlayYear(playYear)) updates.play_year = playYear;
    if (platform) updates.platform = platform;

    annotations[appid] = { ...existing, ...updates };
    saveAnnotations(annotations, annotationsPath);

    logger.log(`\n已写入 ${annotationsPath}: ${JSON.stringify(annotations[appid], null, 2)}`);
    logger.log('提示:自动字段(中文名/tags/发售日期)未被触碰;推送上线用 git push。');

    return {
      appid,
      updated: true,
      annotation: annotations[appid],
    };
  } finally {
    if (rl) rl.close();
  }
}

// 统一导出语录录入操作供更新中心直接调度
export { runAddQuote, type AddQuoteOptions } from './add-quote.ts';
