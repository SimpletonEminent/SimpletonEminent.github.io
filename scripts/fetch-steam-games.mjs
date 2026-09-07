// 抓取 Steam 游戏数据, 生成 public/steam_games.json (Spec 07)
// 用法(需要环境变量): STEAM_API_KEY=xxx STEAM_ID=xxx node scripts/fetch-steam-games.mjs
//
// 失败语义: 任何非 2xx 响应或返回空游戏列表 -> 进程以非零码退出,
// 调用方(CI)应中止并保留上一次成功的数据文件。

import { PATHS, saveGamesData, syncSteamGames } from './steam-pipeline-core.ts';

const apiKey = process.env.STEAM_API_KEY;
const steamId = process.env.STEAM_ID;

if (!apiKey || !steamId) {
  console.error('缺少环境变量 STEAM_API_KEY 或 STEAM_ID');
  process.exit(1);
}

async function main() {
  const data = await syncSteamGames({ apiKey, steamId });
  saveGamesData(data);
  console.log(`同步完成: ${data.games.length} 款游戏 -> ${PATHS.GAMES}`);
}

main().catch((err) => {
  console.error(`同步失败: ${err.message}`);
  process.exit(1);
});
