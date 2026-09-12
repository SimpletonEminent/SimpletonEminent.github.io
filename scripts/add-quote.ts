// 交互式语录录入 CLI (Spec 14 / ADR-0014)
// 用法(必须在项目根目录): npm run add-quote
//
// 写入 src/data/quotes.json:
// - 正文非空校验，支持输入 q 或 exit 取消
// - 文献出处为可选输入，直接回车跳过
// - 自动排重提醒 (已有完全相同正文时二次确认)
// - 输入支持 TTY 交互模式与管道/重定向模式 (便于自动化与测试)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { type QuoteItem } from '../src/lib/hero-quote.ts';

const QUOTES_FILE = resolve(process.cwd(), 'src/data/quotes.json');

// ---- 输入层: TTY 用 readline; 非 TTY (管道) 一次性读入全部行逐行消费 ----
let rl: ReturnType<typeof createInterface> | null = null;
let ask: (q: string) => Promise<string>;

if (input.isTTY) {
  rl = createInterface({ input, output });
  ask = (q: string) => rl!.question(q);
} else {
  const allLines = readFileSync(0, 'utf-8').split(/\r?\n/);
  let cursor = 0;
  ask = async (q: string) => {
    output.write(q);
    const line = allLines[cursor] ?? '';
    cursor += 1;
    output.write(line + '\n');
    return line;
  };
}

async function main() {
  console.log('\n============================================================');
  console.log('         💬 首页语录交互式录入控制台 (Add Hero Quote)');
  console.log('============================================================');
  console.log('提示: 输入 "q" 或 "exit" 可随时退出录入。\n');

  // 1. 获取语录正文
  let content = '';
  while (!content) {
    const raw = (await ask('📝 请输入语录正文内容: ')).trim();
    if (raw.toLowerCase() === 'q' || raw.toLowerCase() === 'exit') {
      console.log('已取消录入。');
      if (rl) rl.close();
      return;
    }
    if (raw.length === 0) {
      console.log('⚠️ 语录正文不能为空，请重新输入。');
      continue;
    }
    content = raw;
  }

  // 2. 获取文献出处 (可选)
  const rawSource = (await ask('📖 请输入文献出处/作者 (可选，直接回车跳过): ')).trim();
  const source = rawSource.length > 0 ? rawSource : undefined;

  // 3. 读取当前语录库
  let existingQuotes: QuoteItem[] = [];
  if (existsSync(QUOTES_FILE)) {
    try {
      const raw = readFileSync(QUOTES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existingQuotes = parsed;
      }
    } catch {
      console.error(`⚠️ 读取现有语录文件失败，将新建数组。`);
    }
  }

  // 4. 重复性检查
  const duplicate = existingQuotes.some((q) => q.content.trim() === content);
  if (duplicate) {
    console.log('\n⚠️ 检测到语录库中已存在完全相同的正文内容！');
    const confirm = (await ask('是否依然确认追加？(y/N): ')).trim().toLowerCase();
    if (confirm !== 'y' && confirm !== 'yes') {
      console.log('已取消追加。');
      if (rl) rl.close();
      return;
    }
  }

  // 5. 追加新语录
  const newQuote: QuoteItem = { content };
  if (source) {
    newQuote.source = source;
  }

  existingQuotes.push(newQuote);

  // 6. 落盘写回
  writeFileSync(QUOTES_FILE, JSON.stringify(existingQuotes, null, 2) + '\n', 'utf-8');

  console.log('\n✨ 录入成功！');
  console.log(`📌 新增条目: "${content}"${source ? ` (${source})` : ''}`);
  console.log(`📊 当前语录库总数: ${existingQuotes.length} 条`);
  console.log(`📁 数据文件已更新: src/data/quotes.json\n`);

  if (rl) rl.close();
}

main().catch((err) => {
  console.error('❌ 执行失败:', err);
  if (rl) rl.close();
  process.exit(1);
});
