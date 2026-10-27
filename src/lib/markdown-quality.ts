import {
  parseMarkdownDocument,
  parseFenceDelimiter,
  maskInlineCode,
} from './markdown-scanner.ts';

export type MarkdownViolationKind =
  | 'redundant-h1'
  | 'broken-bold-space'
  | 'broken-escape-typo'
  | 'escaped-hyphen-prefix';

export interface MarkdownViolation {
  kind: MarkdownViolationKind;
  line: number;
  message: string;
  excerpt: string;
}

export interface InspectMarkdownOptions {
  checkEscapedHyphen?: boolean;
}

export function hasBrokenBoldSpacing(lineWithoutInlineCode: string): boolean {
  const tokenRegex = /\*\*/g;
  const indices: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(lineWithoutInlineCode)) !== null) {
    indices.push(match.index);
  }
  if (indices.length === 0) return false;
  if (indices.length % 2 !== 0) return true;

  for (let i = 0; i < indices.length; i += 2) {
    const openIdx = indices[i];
    const closeIdx = indices[i + 1];
    const inner = lineWithoutInlineCode.slice(openIdx + 2, closeIdx);
    if (inner.length === 0) return true;
    if (/^\s/.test(inner) || /\s$/.test(inner)) {
      return true;
    }
  }
  return false;
}

export function inspectMarkdownQuality(
  markdown: string,
  options: InspectMarkdownOptions = {}
): MarkdownViolation[] {
  const checkEscapedHyphen = options.checkEscapedHyphen ?? true;
  const violations: MarkdownViolation[] = [];

  const doc = parseMarkdownDocument(markdown);
  const { lines } = doc;
  let lineIdx = doc.bodyStartLine - 1;

  let inFence = false;
  let fenceMarker = '';
  let h1Count = 0;

  for (; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const lineNum = lineIdx + 1;
    const trimmed = rawLine.trim();

    const marker = parseFenceDelimiter(trimmed);
    if (marker) {
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    const withoutInlineCode = maskInlineCode(rawLine);

    if (/^#\s+\S/.test(trimmed)) {
      h1Count++;
      if (h1Count > 1) {
        violations.push({
          kind: 'redundant-h1',
          line: lineNum,
          message: '正文存在除开篇引语外的多余一级标题 (# )，请降级为 ## 或 ###',
          excerpt: trimmed,
        });
      }
    }

    if (hasBrokenBoldSpacing(withoutInlineCode)) {
      violations.push({
        kind: 'broken-bold-space',
        line: lineNum,
        message: '粗体标记 ** 内侧存在多余空格或未闭合，会导致加粗失效',
        excerpt: trimmed,
      });
    }

    if (/\*\*<[a-zA-Z]\\-/.test(withoutInlineCode)) {
      violations.push({
        kind: 'broken-escape-typo',
        line: lineNum,
        message: '存在异常的 **<x\\- 转义笔误',
        excerpt: trimmed,
      });
    }

    if (checkEscapedHyphen && /^\s*\\-\s/.test(withoutInlineCode)) {
      violations.push({
        kind: 'escaped-hyphen-prefix',
        line: lineNum,
        message: '正文行首存在遗留的 \\- 转义前缀，请使用标准自然段或列表',
        excerpt: trimmed,
      });
    }
  }

  return violations;
}
