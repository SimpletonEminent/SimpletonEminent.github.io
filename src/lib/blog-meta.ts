// 博客文章元信息解析模块 (Blog Metadata Resolver)
// 职责:
// 1. 判定当前条目是否为博客文章 (/blog/*) 与是否属于游戏长评
// 2. 动态继承 Steam 注释文件中的游戏类型标签 (或回退 frontmatter tags)
// 3. 判定双日期的展示策略 (只有更新时间严格晚于首次发布时间才显示)
// 4. 过滤并按年份分组普通文章数据 (用于 /blog/ 文章总览门户)
// 5. 单源化解析与富化阅读指标 (minutesRead 与 words)，收敛 AST 刺探 (Spec 16)

import { readFileSync } from 'node:fs';

export interface PostMetadata {
  isBlogPost: boolean;
  isGameReview: boolean;
  labelPrefix: string;
  tags: string[];
  appid?: number;
  galleryUrl?: string;
  pubDate?: string;
  updatedDate?: string;
  showUpdated: boolean;
}

export interface ReadingMetrics {
  minutesRead?: string;
  words?: number;
}

export interface AnnotationItem {
  tags?: string[];
  blog_url?: string;
}

export interface GeneralPostSummary {
  id: string;
  title: string;
  description: string;
  url: string;
  pubDate: string;
  updatedDate?: string;
  tags: string[];
  minutesRead?: string;
  words?: number;
}

export interface YearGroup {
  year: string;
  posts: GeneralPostSummary[];
}

export interface InputPostEntry {
  id: string;
  data: {
    title?: string;
    description?: string;
    pubDate?: string;
    updatedDate?: string;
    tags?: string[];
  };
  minutesRead?: string;
  words?: number;
  rendered?: unknown;
}

let memoizedAnnotations: Record<string, AnnotationItem> | null = null;
const readingMetricsCache = new WeakMap<object, ReadingMetrics>();

/** 读取并缓存 steam_annotations.json */
export function loadBlogAnnotations(): Record<string, AnnotationItem> {
  if (memoizedAnnotations) return memoizedAnnotations;
  try {
    const raw = readFileSync('src/data/steam_annotations.json', 'utf-8');
    memoizedAnnotations = JSON.parse(raw) as Record<string, AnnotationItem>;
  } catch {
    memoizedAnnotations = {};
  }
  return memoizedAnnotations;
}

/**
 * 统一解析博文阅读时长与字数指标纯函数 (Spec 16)
 *
 * 封装对不同阶段 entry 结构的探测接缝:
 * 1. 显式已富化的直接字段: entry.minutesRead / entry.words
 * 2. 外部异步 render(entry) 产物: rendered.remarkPluginFrontmatter 或 rendered.metadata.frontmatter
 * 3. Starlight 内部已渲染结构: entry.rendered.metadata.frontmatter 或 entry.rendered.remarkPluginFrontmatter
 * 4. Frontmatter 直接声明: entry.data.minutesRead / entry.data.words
 * 5. 模块级 WeakMap 缓存: 避免同一 entry 重复进行属性遍历
 *
 * @param entry 文档条目对象或包含渲染信息的对象
 * @param rendered 可选由 await render(entry) 得到的渲染产物
 */
export function resolveReadingMetrics(entry: unknown, rendered?: unknown): ReadingMetrics {
  if (!entry || typeof entry !== 'object') {
    return {};
  }

  // 1. 优先命中 WeakMap 缓存 (若未传入外部独立 rendered 对象)
  if (!rendered && readingMetricsCache.has(entry as object)) {
    return readingMetricsCache.get(entry as object)!;
  }

  const e = entry as Record<string, unknown>;
  const r = (rendered && typeof rendered === 'object' ? rendered : undefined) as Record<string, unknown> | undefined;
  const entryRendered = (e.rendered && typeof e.rendered === 'object' ? e.rendered : undefined) as Record<string, unknown> | undefined;
  const data = (e.data && typeof e.data === 'object' ? e.data : undefined) as Record<string, unknown> | undefined;

  // 探测候选源队列 (按优先级自上而下检索)
  const candidateSources: Array<Record<string, unknown> | undefined> = [
    // 自身已被富化的属性
    e,
    // 显式传入的 rendered 对象的各结构 (AST 插件产物)
    r?.remarkPluginFrontmatter as Record<string, unknown> | undefined,
    (r?.metadata as { frontmatter?: Record<string, unknown> } | undefined)?.frontmatter,
    // entry 内部挂载的 rendered 各结构 (Starlight 内部注入点)
    (entryRendered?.metadata as { frontmatter?: Record<string, unknown> } | undefined)?.frontmatter,
    entryRendered?.remarkPluginFrontmatter as Record<string, unknown> | undefined,
    // entry 内部可能直接挂载的 remarkPluginFrontmatter
    e.remarkPluginFrontmatter as Record<string, unknown> | undefined,
    // frontmatter data 兜底声明
    data,
  ];

  let resolvedMinutesRead: string | undefined;
  let resolvedWords: number | undefined;

  for (const src of candidateSources) {
    if (!src) continue;

    if (!resolvedMinutesRead && typeof src.minutesRead === 'string' && src.minutesRead.trim()) {
      resolvedMinutesRead = src.minutesRead.trim();
    }

    if (resolvedWords === undefined) {
      if (typeof src.words === 'number' && !Number.isNaN(src.words) && src.words > 0) {
        resolvedWords = src.words;
      } else if (typeof src.words === 'string' && /^\d+$/.test(src.words.trim())) {
        resolvedWords = Number.parseInt(src.words.trim(), 10);
      }
    }

    if (resolvedMinutesRead && resolvedWords !== undefined) {
      break;
    }
  }

  const result: ReadingMetrics = {
    minutesRead: resolvedMinutesRead,
    words: resolvedWords,
  };

  // 写入 WeakMap 缓存
  readingMetricsCache.set(entry as object, result);

  return result;
}

/**
 * 异步解析阅读指标 (支持传入 render 渲染器或自动使用 entry 内部渲染状态)
 * @param entry 文档条目
 * @param renderer 可选的 render(entry) 异步函数
 */
export async function resolveReadingMetricsAsync(
  entry: unknown,
  renderer?: (entry: unknown) => Promise<unknown>
): Promise<ReadingMetrics> {
  // 1. 如果同步就能提取到有效指标，直接返回
  const syncMetrics = resolveReadingMetrics(entry);
  if (syncMetrics.minutesRead && syncMetrics.words !== undefined) {
    return syncMetrics;
  }

  // 2. 如果提供了 renderer 且 entry 存在，则尝试异步渲染富化
  if (typeof renderer === 'function' && entry) {
    try {
      const rendered = await renderer(entry);
      return resolveReadingMetrics(entry, rendered);
    } catch {
      // 容错: 忽略非 Markdown 或渲染异常
    }
  }

  return syncMetrics;
}

/**
 * 批量富化文档集合条目中的阅读指标
 * @param entries 文档集合条目数组
 * @param renderer 可选的 render 函数 (如 astro:content 中的 render)
 */
export async function enrichPostEntries<T extends InputPostEntry>(
  entries: T[],
  renderer?: (entry: T) => Promise<unknown>
): Promise<Array<T & ReadingMetrics>> {
  return Promise.all(
    entries.map(async (entry) => {
      const metrics = await resolveReadingMetricsAsync(
        entry,
        renderer ? (e) => renderer(e as T) : undefined
      );
      return {
        ...entry,
        ...metrics,
      };
    })
  );
}

/**
 * 解析博文元数据核心纯函数
 * @param entryId 页面 entry id,如 "blog/djmax_review.md" 或 "about.md"
 * @param frontmatter 页面的 frontmatter 字段
 * @param injectedAnnotations 可选注入的注释数据 (供测试隔离使用)
 */
export function resolvePostMetadata(
  entryId: string,
  frontmatter: {
    pubDate?: string;
    updatedDate?: string;
    tags?: string[];
    [key: string]: unknown;
  } = {},
  injectedAnnotations?: Record<string, AnnotationItem>
): PostMetadata {
  // 仅在 /blog/* 路径下生效,其他页面 (如 about.md, games.mdx) 保持纯净
  const normalizedId = entryId.replace(/\\/g, '/');
  const isBlogPost = normalizedId.startsWith('blog/');

  if (!isBlogPost) {
    return {
      isBlogPost: false,
      isGameReview: false,
      labelPrefix: '',
      tags: [],
      showUpdated: false,
    };
  }

  // 提取标准化 URL,例如 "blog/djmax_review.md" -> "/blog/djmax_review"
  const cleanSlug = normalizedId.replace(/\.(md|mdx)$/, '');

  // 文章总览页 (/blog 或 /blog/index) 是聚合门户，不当作单篇博文渲染文章标签与字数
  if (cleanSlug === 'blog/index' || cleanSlug === 'blog') {
    return {
      isBlogPost: false,
      isGameReview: false,
      labelPrefix: '',
      tags: [],
      showUpdated: false,
    };
  }

  const targetUrl = '/' + cleanSlug.toLowerCase();

  const annotations = injectedAnnotations ?? loadBlogAnnotations();

  // 查找是否有关联的 Steam 游戏长评
  let matchedAnnotation: AnnotationItem | undefined;
  let matchedAppid: number | undefined;
  for (const [rawId, item] of Object.entries(annotations)) {
    if (typeof item.blog_url === 'string' && item.blog_url.trim().toLowerCase() === targetUrl) {
      matchedAnnotation = item;
      const parsedId = Number(rawId);
      if (!Number.isNaN(parsedId)) {
        matchedAppid = parsedId;
      }
      break;
    }
  }

  const isGameReview = Boolean(matchedAnnotation);
  const labelPrefix = isGameReview ? '🎮 游戏类型：' : '🏷️ 标签：';

  let tags: string[] = [];
  if (isGameReview && matchedAnnotation) {
    if (Array.isArray(matchedAnnotation.tags) && matchedAnnotation.tags.length > 0) {
      tags = matchedAnnotation.tags;
    } else if (Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0) {
      tags = frontmatter.tags;
    }
  } else if (Array.isArray(frontmatter.tags)) {
    tags = frontmatter.tags;
  }

  // 日期解析与显隐判定
  const pubDate = typeof frontmatter.pubDate === 'string' && frontmatter.pubDate.trim() ? frontmatter.pubDate.trim() : undefined;
  const updatedDate =
    typeof frontmatter.updatedDate === 'string' && frontmatter.updatedDate.trim()
      ? frontmatter.updatedDate.trim()
      : undefined;

  let showUpdated = false;
  if (pubDate && updatedDate) {
    const pTime = Date.parse(pubDate);
    const uTime = Date.parse(updatedDate);
    if (!Number.isNaN(pTime) && !Number.isNaN(uTime) && uTime > pTime) {
      showUpdated = true;
    }
  }

  const galleryUrl = isGameReview && matchedAppid ? `/games#game-${matchedAppid}` : undefined;

  return {
    isBlogPost: true,
    isGameReview,
    labelPrefix,
    tags,
    appid: matchedAppid,
    galleryUrl,
    pubDate,
    updatedDate,
    showUpdated,
  };
}

/**
 * 纯函数: 过滤非游戏评测的普通文章并按年份降序分组
 * @param entries 文档集合条目
 * @param injectedAnnotations 可选注入的注释数据 (测试隔离或传入已加载项)
 */
export function filterAndGroupGeneralPosts(
  entries: InputPostEntry[],
  injectedAnnotations?: Record<string, AnnotationItem>
): YearGroup[] {
  const annotations = injectedAnnotations ?? loadBlogAnnotations();

  // 收集已登记为游戏长评的 URL 集合 (全小写标准化)
  const reviewUrls = new Set<string>();
  for (const item of Object.values(annotations)) {
    if (typeof item.blog_url === 'string' && item.blog_url.trim()) {
      reviewUrls.add(item.blog_url.trim().toLowerCase());
    }
  }

  const generalPosts: GeneralPostSummary[] = [];

  for (const entry of entries) {
    const normalizedId = entry.id.replace(/\\/g, '/');
    if (!normalizedId.startsWith('blog/')) continue;

    const cleanSlug = normalizedId.replace(/\.(md|mdx)$/, '');
    if (cleanSlug === 'blog/index' || cleanSlug === 'blog') continue;

    const targetUrl = '/' + cleanSlug.toLowerCase();
    if (reviewUrls.has(targetUrl)) {
      // 属于游戏评测长评，严格排除
      continue;
    }

    const title = entry.data.title || cleanSlug.replace(/^blog\//, '');
    const description = entry.data.description || '';
    const pubDate = typeof entry.data.pubDate === 'string' ? entry.data.pubDate.trim() : '';
    const updatedDate =
      typeof entry.data.updatedDate === 'string' && entry.data.updatedDate.trim()
        ? entry.data.updatedDate.trim()
        : undefined;

    const tags = Array.isArray(entry.data.tags) ? entry.data.tags : [];

    // 统一通过 resolveReadingMetrics 获取阅读指标 (Spec 16)
    const { minutesRead, words } = resolveReadingMetrics(entry);

    // 标准化博客访问 URL (末尾带斜杠与 Starlight 路由一致)
    const finalUrl = `/blog/${cleanSlug.replace(/^blog\//, '')}/`;

    generalPosts.push({
      id: entry.id,
      title,
      description,
      url: finalUrl,
      pubDate,
      updatedDate,
      tags,
      minutesRead,
      words,
    });
  }

  // 按首次发布时间降序排序 (最新在前)
  generalPosts.sort((a, b) => {
    if (a.pubDate && b.pubDate) {
      return b.pubDate.localeCompare(a.pubDate);
    }
    if (a.pubDate) return -1;
    if (b.pubDate) return 1;
    return a.title.localeCompare(b.title);
  });

  // 按年份聚合分组
  const groupsMap = new Map<string, GeneralPostSummary[]>();
  for (const post of generalPosts) {
    let year = '其他';
    if (post.pubDate && post.pubDate.length >= 4) {
      const parsedYear = post.pubDate.slice(0, 4);
      if (/^\d{4}$/.test(parsedYear)) {
        year = parsedYear;
      }
    }
    const list = groupsMap.get(year);
    if (list) {
      list.push(post);
    } else {
      groupsMap.set(year, [post]);
    }
  }

  // 年份分组降序排序 (例如 2026 在 2025 前，"其他" 放末尾)
  const sortedYears = Array.from(groupsMap.keys()).sort((a, b) => {
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    return b.localeCompare(a);
  });

  return sortedYears.map((year) => ({
    year,
    posts: groupsMap.get(year) || [],
  }));
}

