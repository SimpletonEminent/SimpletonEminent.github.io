// 抓取 Steam 游戏数据, 生成 public/steam_games.json (Spec 07 / Issue #22)
// 用法(需要环境变量): STEAM_API_KEY=xxx STEAM_ID=xxx node scripts/fetch-steam-games.mjs

import { runSyncGames } from './lib/steam-pipeline-core.ts';

runSyncGames().catch((err) => {
  console.error(`同步失败: ${err.message}`);
  process.exit(1);
});
