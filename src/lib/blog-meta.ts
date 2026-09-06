// 博客文章元信息解析模块 (Blog Metadata Resolver)
// 职责:
// 1. 判定当前条目是否为博客文章 (/blog/*) 与是否属于游戏长评
// 2. 动态继承 Steam 注释文件中的游戏类型标签 (或回退 frontmatter tags)
// 3. 判定双日期的展示策略 (只有更新时间严格晚于首次发布时间才显示)

import { readFileSync } from 'node:fs';

export interface PostMetadata {
  isBlogPost: boolean;
  isGameReview: boolean;
  labelPrefix: string;
  tags: string[];
  pubDate?: string;
  updatedDate?: string;
  showUpdated: boolean;
}

export interface AnnotationItem {
  tags?: string[];
  blog_url?: string;
}

let memoizedAnnotations: Record<string, AnnotationItem> | null = null;

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
  const targetUrl = '/' + cleanSlug.toLowerCase();

  const annotations = injectedAnnotations ?? loadBlogAnnotations();

  // 查找是否有关联的 Steam 游戏长评
  let matchedAnnotation: AnnotationItem | undefined;
  for (const item of Object.values(annotations)) {
    if (typeof item.blog_url === 'string' && item.blog_url.trim().toLowerCase() === targetUrl) {
      matchedAnnotation = item;
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

  return {
    isBlogPost: true,
    isGameReview,
    labelPrefix,
    tags,
    pubDate,
    updatedDate,
    showUpdated,
  };
}
