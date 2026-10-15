// 游玩年份预填脚本: 把 play_year 覆盖为 Steam API 最后运行时间的年份 (Spec 07 / Issue #22)
// 用法: node scripts/fill-play-year.mjs

import { runFillPlayYear } from './steam-pipeline-core.ts';

runFillPlayYear().catch((err) => {
  console.error(`fill-play-year 异常中断: ${err.message}`);
  process.exit(1);
});
