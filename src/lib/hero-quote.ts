// 首页语录领域解析与随机算法模块 (Spec 14 / ADR-0014)
// 职责:
// 1. 结构化语录数据校验 (validateQuotes) 与安全兜底加载 (loadQuotes)
// 2. 纯函数防重随机选择算法 (pickRandomQuote)
// 3. 规范化文献出处格式化 (formatCitation) 与安全 HTML 转义渲染 (renderQuoteHtml)

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** 首页语录数据结构 */
export interface QuoteItem {
  /** 语录正文内容 */
  content: string;
  /** 可选文献出处、作者或日期 */
  source?: string;
}

/** 语录抽取结果 */
export interface PickQuoteResult {
  quote: QuoteItem;
  index: number;
}

/** 系统基准兜底语录 (保障数据损坏或缺失时全站不崩溃、不白屏) */
export const DEFAULT_FALLBACK_QUOTE: QuoteItem = {
  content: '探索技术边界的实验工坊，沉淀硬核游玩感悟的数字花园。',
};

/**
 * 校验任意外部数据是否符合语录数组格式，过滤残缺条目，若为空则安全回退基准语录
 */
export function validateQuotes(data: unknown): QuoteItem[] {
  if (!Array.isArray(data)) {
    return [DEFAULT_FALLBACK_QUOTE];
  }

  const valid: QuoteItem[] = [];
  for (const item of data) {
    if (item && typeof item === 'object' && typeof (item as { content?: unknown }).content === 'string') {
      const content = (item as { content: string }).content.trim();
      if (content.length > 0) {
        const quote: QuoteItem = { content };
        const rawSource = (item as { source?: unknown }).source;
        if (typeof rawSource === 'string' && rawSource.trim().length > 0) {
          quote.source = rawSource.trim();
        }
        valid.push(quote);
      }
    }
  }

  return valid.length > 0 ? valid : [DEFAULT_FALLBACK_QUOTE];
}

/**
 * 装载语录数据源 (优先读取注入数据，默认读取 src/data/quotes.json)
 */
export function loadQuotes(customData?: unknown): QuoteItem[] {
  if (customData !== undefined) {
    return validateQuotes(customData);
  }

  // 1. 优先尝试从工作区根目录读取 (适用于 Astro build/dev 与根目录测试)
  try {
    const cwdPath = resolve(process.cwd(), 'src/data/quotes.json');
    if (existsSync(cwdPath)) {
      const raw = readFileSync(cwdPath, 'utf-8');
      return validateQuotes(JSON.parse(raw));
    }
  } catch {
    // 忽略异常，继续尝试模块路径
  }

  // 2. 尝试从模块自身相对路径读取 (适用于独立模块调用或不同子进程)
  try {
    const fileUrl = new URL('../data/quotes.json', import.meta.url);
    const raw = readFileSync(fileUrl, 'utf-8');
    return validateQuotes(JSON.parse(raw));
  } catch {
    return [DEFAULT_FALLBACK_QUOTE];
  }
}

/**
 * 从语录列表中随机抽取一条，在条目数 > 1 时严格避开上一次展示的索引
 */
export function pickRandomQuote(quotes: QuoteItem[], previousIndex?: number): PickQuoteResult {
  const safeQuotes = quotes.length > 0 ? quotes : [DEFAULT_FALLBACK_QUOTE];

  if (safeQuotes.length <= 1) {
    return { quote: safeQuotes[0], index: 0 };
  }

  const validIndices = safeQuotes.map((_, i) => i);
  const candidates =
    previousIndex !== undefined && previousIndex >= 0 && previousIndex < safeQuotes.length
      ? validIndices.filter((i) => i !== previousIndex)
      : validIndices;

  // 极端防御: 如果过滤后候选为空，回退所有索引
  const pool = candidates.length > 0 ? candidates : validIndices;
  const candidateOffset = Math.floor(Math.random() * pool.length);
  const selectedIndex = pool[candidateOffset];

  return {
    quote: safeQuotes[selectedIndex],
    index: selectedIndex,
  };
}

/**
 * 格式化文献出处 (若未自带破折号前缀则自动补充中文破折号 "——")
 */
export function formatCitation(source?: string): string {
  if (!source || source.trim().length === 0) {
    return '';
  }
  const trimmed = source.trim();
  if (trimmed.startsWith('——') || trimmed.startsWith('--')) {
    return trimmed;
  }
  return `——${trimmed}`;
}

/**
 * 安全 HTML 实体转义 (抵御 XSS 风险)
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 渲染为适合直接插入页面的静态 HTML 字符串 (供服务端预渲染或内联替换使用)
 */
export function renderQuoteHtml(quote: QuoteItem): string {
  const contentHtml = `<span class="hero-quote-content">${escapeHtml(quote.content)}</span>`;
  if (quote.source) {
    const citation = escapeHtml(formatCitation(quote.source));
    const sourceHtml = ` <cite class="hero-quote-source">${citation}</cite>`;
    return `${contentHtml}${sourceHtml}`;
  }
  return contentHtml;
}
