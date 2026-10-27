import { readdirSync, readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createPromptSession } from './lib/cli-prompt.ts';
import { resolveLogger, type Logger } from './lib/steam-pipeline-core.ts';
import { parseMarkdownDocument } from '../src/lib/markdown-scanner.ts';
import {
  markdownToSteamBbcode,
  checkSteamReviewLength,
  STEAM_REVIEW_MAX_CHARS,
  type SteamBbcodeOptions,
  type SteamBbcodeLengthReport,
} from '../src/lib/steam-bbcode.ts';

const DEFAULT_BLOG_DIR = resolve(process.cwd(), 'src/content/docs/blog');

export interface BlogReviewCandidate {
  fileName: string;
  filePath: string;
  title: string;
  isReviewSlug: boolean;
}

export interface ExportSteamReviewOptions {
  blogDir?: string;
  ask?: (query: string) => Promise<string>;
  copyToClipboard?: (text: string) => boolean;
  bbcodeOptions?: SteamBbcodeOptions;
  logger?: Logger;
}

export interface ExportSteamReviewResult {
  fileName: string;
  title: string;
  bbcode: string;
  report: SteamBbcodeLengthReport;
  copied: boolean;
}

export function listBlogReviewCandidates(blogDir: string = DEFAULT_BLOG_DIR): BlogReviewCandidate[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(blogDir);
  } catch {
    return [];
  }

  const candidates: BlogReviewCandidate[] = [];
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const fullPath = resolve(blogDir, name);
    let raw = '';
    try {
      raw = readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }
    const stem = basename(name, '.md');
    const doc = parseMarkdownDocument(raw);
    const title = doc.frontmatter.title || stem;
    const isReviewSlug = stem.toLowerCase().endsWith('_review');
    candidates.push({
      fileName: name,
      filePath: fullPath,
      title,
      isReviewSlug,
    });
  }

  return candidates.sort((a, b) => {
    if (a.isReviewSlug !== b.isReviewSlug) {
      return a.isReviewSlug ? -1 : 1;
    }
    return a.fileName.localeCompare(b.fileName);
  });
}

export function copyTextToSystemClipboard(text: string): boolean {
  try {
    if (process.platform === 'win32') {
      const res = spawnSync('powershell', ['-NoProfile', '-Command', '$input | Set-Clipboard'], {
        input: text,
        encoding: 'utf-8',
      });
      if (res.status === 0) return true;
      const clipRes = spawnSync('clip', { input: text, encoding: 'utf-8' });
      return clipRes.status === 0;
    }
    if (process.platform === 'darwin') {
      const res = spawnSync('pbcopy', { input: text, encoding: 'utf-8' });
      return res.status === 0;
    }
    const res = spawnSync('xclip', ['-selection', 'clipboard'], {
      input: text,
      encoding: 'utf-8',
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

export async function runExportSteamReview(
  options: ExportSteamReviewOptions = {}
): Promise<ExportSteamReviewResult | null> {
  const blogDir = options.blogDir ?? DEFAULT_BLOG_DIR;
  const copyFn = options.copyToClipboard ?? copyTextToSystemClipboard;
  const logger = resolveLogger(options.logger);

  const candidates = listBlogReviewCandidates(blogDir);
  if (candidates.length === 0) {
    logger.error(`未在 ${blogDir} 中找到可导出的 Markdown 博文。`);
    return null;
  }

  const promptSession = createPromptSession({ ask: options.ask });
  const { ask } = promptSession;

  try {
    logger.log('\n============================================================');
    logger.log('       📤 博客长评导出为 Steam BBCode (Steam Review Exporter)');
    logger.log('============================================================');

    candidates.forEach((item, idx) => {
      const tag = item.isReviewSlug ? '🎮 [游戏评测]' : '📝 [普通文章]';
      logger.log(`  [${idx + 1}] ${tag} ${item.title} (${item.fileName})`);
    });
    logger.log('  [0] 取消返回');

    const rawPick = (await ask(`\n请选择要导出的文章序号 [1-${candidates.length}] (直接回车或输入 0 取消): `)).trim();
    if (!rawPick || rawPick === '0' || rawPick.toLowerCase() === 'q') {
      logger.log('已取消导出。');
      return null;
    }

    const pickNum = Number(rawPick);
    if (!Number.isInteger(pickNum) || pickNum < 1 || pickNum > candidates.length) {
      logger.error(`无效的序号 "${rawPick}"。`);
      return null;
    }

    const selected = candidates[pickNum - 1];
    const markdown = readFileSync(selected.filePath, 'utf-8');
    const bbcode = markdownToSteamBbcode(markdown, options.bbcodeOptions);
    const report = checkSteamReviewLength(bbcode, STEAM_REVIEW_MAX_CHARS);
    const copied = copyFn(bbcode);

    logger.log(`\n✅ 转码完成: 《${selected.title}》`);
    logger.log(`📊 字符数统计: ${report.ratioText} 字符`);

    if (report.isOverLimit) {
      logger.warn(
        `⚠️ 警告: 当前 BBCode 长度 (${report.length}) 已超出 Steam 商店评测 ${report.maxChars} 字符上限 (超出 ${Math.abs(report.remaining)} 字符)，发布前请适当精简！`
      );
    } else {
      logger.log(`✨ 长度符合 Steam 评测要求 (剩余可用 ${report.remaining} 字符)。`);
    }

    if (copied) {
      logger.log('📋 已自动复制到系统剪贴板，可直接粘贴至 Steam 评测输入框！');
    } else {
      logger.warn('⚠️ 未能写入系统剪贴板，以下输出转换后的 BBCode 原文:\n');
      logger.log(bbcode);
    }

    return {
      fileName: selected.fileName,
      title: selected.title,
      bbcode,
      report,
      copied,
    };
  } finally {
    promptSession.close();
  }
}

if (
  process.argv[1]?.endsWith('export-steam-review.ts') ||
  process.argv[1]?.endsWith('export-steam-review.js')
) {
  runExportSteamReview().catch((err) => {
    console.error('❌ 导出失败:', err);
    process.exit(1);
  });
}
