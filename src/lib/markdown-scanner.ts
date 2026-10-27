export interface ParsedMarkdownDocument {
  frontmatterRaw: string;
  frontmatter: Record<string, string>;
  body: string;
  lines: string[];
  bodyStartLine: number;
}

export function parseMarkdownDocument(markdown: string): ParsedMarkdownDocument {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const frontmatter: Record<string, string> = {};
  let frontmatterRaw = '';
  let bodyStartIdx = 0;

  if (lines[0]?.trim() === '---') {
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIdx = i;
        break;
      }
    }
    if (endIdx !== -1) {
      const fmLines = lines.slice(1, endIdx);
      frontmatterRaw = fmLines.join('\n');
      for (const fmLine of fmLines) {
        const kvMatch = /^([A-Za-z0-9_-]+):\s*(.+?)\s*$/.exec(fmLine);
        if (kvMatch) {
          const key = kvMatch[1];
          const val = kvMatch[2].replace(/^["']|["']$/g, '').trim();
          frontmatter[key] = val;
        }
      }
      bodyStartIdx = endIdx + 1;
    }
  }

  const bodyLines = lines.slice(bodyStartIdx);
  return {
    frontmatterRaw,
    frontmatter,
    body: bodyLines.join('\n'),
    lines,
    bodyStartLine: bodyStartIdx + 1,
  };
}

export function parseFenceDelimiter(trimmedLine: string): string | null {
  const match = /^(`{3,}|~{3,})/.exec(trimmedLine);
  return match ? match[1][0] : null;
}

export function maskInlineCode(line: string, placeholder = 'CODE'): string {
  return line.replace(/`[^`]*`/g, placeholder);
}
