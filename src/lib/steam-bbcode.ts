// Steam 评测导出器纯函数模块 (Markdown 反向转 Steam BBCode, Ticket 02 / ADR-0016)
// 职责:
// 1. 将博客单源标准 Markdown 转换为适配 Steam 商店评测的 BBCode 文本
// 2. 自动剥离 YAML Frontmatter 与站内画廊锚点胶囊，支持标题、粗斜体、删除线、分隔线、链接、列表、代码块转换
// 3. 支持 `<details><summary>提示</summary>内容</details>` 转 `提示：[spoiler]内容[/spoiler]`
// 4. 支持 Markdown 管道表格转 `[table][tr][th][td]` 结构
// 5. 提供 Steam 商店评测 8000 字符上限校验纯函数

import { parseMarkdownDocument, parseFenceDelimiter } from './markdown-scanner.ts';

export const STEAM_REVIEW_MAX_CHARS = 8000;

export interface SteamBbcodeOptions {
  /**
   * 列表转换模式:
   * - 'bbcode': 无序列表转 `[list][*]...[/list]`，有序列表转 `[olist][*]...[/olist]` (默认)
   * - 'dash': 转换为段首 `- ` 纯文本模式
   */
  listMode?: 'bbcode' | 'dash';
}

export interface SteamBbcodeLengthReport {
  length: number;
  maxChars: number;
  ratioText: string;
  isOverLimit: boolean;
  remaining: number;
}

/**
 * 校验生成的 Steam BBCode 字符数是否超出 Steam 评测上限 (默认 8000 字符)
 */
export function checkSteamReviewLength(
  bbcode: string,
  maxChars: number = STEAM_REVIEW_MAX_CHARS
): SteamBbcodeLengthReport {
  const length = Array.from(bbcode).length;
  const isOverLimit = length > maxChars;
  const remaining = maxChars - length;
  return {
    length,
    maxChars,
    ratioText: `${length} / ${maxChars}`,
    isOverLimit,
    remaining,
  };
}

/**
 * 转换行内 Markdown 语法为 Steam BBCode
 * 顺序: 行内代码保护 -> `<details>` 剧透 -> 链接 -> 粗斜体/粗体/斜体/删除线
 */
export function convertInlineMarkdownToBbcode(text: string): string {
  const codePlaceholders: string[] = [];
  let work = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(code);
    return `@@INLINE_CODE_${idx}@@`;
  });

  // 1. 处理行内 <details><summary>提示</summary>内容</details>
  work = convertDetailsToSpoiler(work);

  // 2. 处理下划线 <u>...</u>
  work = work.replace(/<u>([\s\S]*?)<\/u>/gi, '[u]$1[/u]');

  // 3. 处理链接 [文本](url)
  work = work.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const cleanLabel = label.trim();
    const cleanUrl = url.trim();
    return `[url=${cleanUrl}]${cleanLabel}[/url]`;
  });

  // 4. 处理粗斜体 ***text***
  work = work.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '[b][i]$1[/i][/b]');

  // 5. 处理粗体 **text**
  work = work.replace(/\*\*([\s\S]+?)\*\*/g, (_m, content: string) => `[b]${content.trim()}[/b]`);

  // 6. 处理删除线 ~~text~~
  work = work.replace(/~~([\s\S]+?)~~/g, '[strike]$1[/strike]');

  // 7. 处理斜体 *text* (避免误伤独立星号)
  work = work.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (_m, content: string) => `[i]${content.trim()}[/i]`);

  // 8. 清理 HTML <br> / <br/> 标签为换行
  work = work.replace(/<br\s*\/?>/gi, '\n');

  // 还原行内代码
  work = work.replace(/@@INLINE_CODE_(\d+)@@/g, (_m, idxStr: string) => {
    const idx = Number(idxStr);
    return codePlaceholders[idx] ?? '';
  });

  return work;
}

/**
 * 将 `<details><summary>提示</summary>内容</details>` 转换为 `提示：[spoiler]内容[/spoiler]`
 */
export function convertDetailsToSpoiler(input: string): string {
  return input.replace(
    /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi,
    (_m, rawSummary: string, rawBody: string) => {
      const summary = rawSummary.trim();
      const body = rawBody.trim();
      if (!summary) {
        return `[spoiler]${body}[/spoiler]`;
      }
      // 若提示词末尾已带冒号或破折号，则直接衔接，否则补齐中文冒号 `：`
      const needsColon = !/[：:—\-]$/.test(summary);
      const sep = needsColon ? '：' : '';
      return `${summary}${sep}[spoiler]${body}[/spoiler]`;
    }
  );
}

/**
 * 判断一行是否为 Markdown 表格分隔行 (如 `| --- | :---: | --- |`)
 */
function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
  const cells = trimmed
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/**
 * 解析管道表格单行单元格
 */
function parseTableCells(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((cell) => convertInlineMarkdownToBbcode(cell.trim()));
}

/**
 * 将博客标准 Markdown 反向转换为适配 Steam 商店评测的 BBCode
 */
export function markdownToSteamBbcode(
  markdown: string,
  options: SteamBbcodeOptions = {}
): string {
  const listMode = options.listMode ?? 'bbcode';
  const doc = parseMarkdownDocument(markdown);
  const body = convertDetailsToSpoiler(doc.body);
  const lines = body.split('\n');
  const outLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    const fenceChar = parseFenceDelimiter(trimmed);
    if (fenceChar) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fenceChar.repeat(3))) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      outLines.push(`[code]\n${codeLines.join('\n')}\n[/code]`);
      continue;
    }

    // B. 处理分隔线 `---`
    if (/^---+$/.test(trimmed)) {
      outLines.push('[hr][/hr]');
      i++;
      continue;
    }

    // C. 处理标题 `# / ## / ### / ####`
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3);
      const titleText = convertInlineMarkdownToBbcode(headingMatch[2].trim());
      outLines.push(`[h${level}]${titleText}[/h${level}]`);
      i++;
      continue;
    }

    // D. 处理 Markdown 管道表格
    if (
      trimmed.startsWith('|') &&
      trimmed.endsWith('|') &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headers = parseTableCells(trimmed);
      const tableLines: string[] = ['[table]', '[tr]'];
      for (const h of headers) {
        tableLines.push(`[th]${h}[/th]`);
      }
      tableLines.push('[/tr]');

      i += 2; // 跳过表头与分隔线
      while (i < lines.length) {
        const rowTrimmed = lines[i].trim();
        if (!rowTrimmed.startsWith('|') || !rowTrimmed.endsWith('|')) break;
        const cells = parseTableCells(rowTrimmed);
        tableLines.push('[tr]');
        for (const c of cells) {
          tableLines.push(`[td]${c}[/td]`);
        }
        tableLines.push('[/tr]');
        i++;
      }
      tableLines.push('[/table]');
      outLines.push(tableLines.join('\n'));
      continue;
    }

    // E. 处理无序列表 (`- item` 或 `* item`)
    if (/^[-*]\s+.+$/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+.+$/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*]\s+/, '');
        items.push(convertInlineMarkdownToBbcode(itemText));
        i++;
      }
      if (listMode === 'dash') {
        for (const item of items) {
          outLines.push(`- ${item}`);
        }
      } else {
        outLines.push('[list]');
        for (const item of items) {
          outLines.push(`[*]${item}`);
        }
        outLines.push('[/list]');
      }
      continue;
    }

    // F. 处理有序列表 (`1. item` 或 `1、item`)
    if (/^\d+[.、]\s*.+$/.test(trimmed) && /^\d+\.\s+.+$/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+.+$/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
        items.push(convertInlineMarkdownToBbcode(itemText));
        i++;
      }
      if (listMode === 'dash') {
        items.forEach((item, idx) => {
          outLines.push(`${idx + 1}. ${item}`);
        });
      } else {
        outLines.push('[olist]');
        for (const item of items) {
          outLines.push(`[*]${item}`);
        }
        outLines.push('[/olist]');
      }
      continue;
    }

    // G. 普通段落行 (兼容剥离历史遗留行首 `\- ` 转义)
    if (trimmed === '') {
      outLines.push('');
      i++;
      continue;
    }

    const cleanedLine = rawLine.replace(/^\s*\\-\s*/, '');
    outLines.push(convertInlineMarkdownToBbcode(cleanedLine));
    i++;
  }

  // 合并超过 2 个的连续空行，去除首尾多余空白
  return outLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
