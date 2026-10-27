import { runAddQuote, type AddQuoteOptions } from './lib/steam-pipeline-core.ts';

export { runAddQuote, type AddQuoteOptions };

if (process.argv[1]?.endsWith('add-quote.ts') || process.argv[1]?.endsWith('add-quote.js')) {
  runAddQuote().catch((err) => {
    console.error('❌ 执行失败:', err);
    process.exit(1);
  });
}
