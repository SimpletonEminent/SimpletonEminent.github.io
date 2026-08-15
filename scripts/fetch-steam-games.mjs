// 抓取 Steam 游戏数据,生成 public/steam_games.json
// 用法(需要环境变量): STEAM_API_KEY=xxx STEAM_ID=xxx node scripts/fetch-steam-games.mjs
//
// 失败语义:任何非 2xx 响应或返回空游戏列表 -> 进程以非零码退出,
// 调用方(CI)应中止并保留上一次成功的数据文件。

import { writeFileSync } from 'node:fs';

const STEAM_API = 'https://api.steampowered.com/IPlayerService';
const COVER_BASE = 'https://cdn.akamai.steamstatic.com/steam/apps';
const RETRY_MAX = 3;
const RETRY_DELAY_MS = 2000;

const apiKey = process.env.STEAM_API_KEY;
const steamId = process.env.STEAM_ID;

if (!apiKey || !steamId) {
  console.error('缺少环境变量 STEAM_API_KEY 或 STEAM_ID');
  process.exit(1);
}

/** 带指数退避重试的 fetch,仅接受 2xx,否则抛错。 */
async function fetchJson(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} (attempt ${attempt})`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_MAX) {
        const delay = RETRY_DELAY_MS * 2 ** (attempt - 1);
        console.warn(`重试 ${attempt}/${RETRY_MAX}: ${url.split('?')[0]} -> ${lastErr.message},${delay}ms 后重试`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

function hours(minutes) {
  return Math.round((minutes / 60) * 10) / 10;
}

async function main() {
  // 1) 全部拥有的游戏(含免费游戏),带 appinfo 才有 name 与封面 hash
  const owned = await fetchJson(
    `${STEAM_API}/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`
  );
  const ownedGames = owned?.response?.games ?? [];
  if (ownedGames.length === 0) {
    console.error('GetOwnedGames 返回空列表:请检查 STEAM_ID 是否正确,以及 Steam 隐私设置中"游戏详情"是否公开');
    process.exit(1);
  }

  // 2) 近两周玩过的游戏(滚动 14 天窗口),用于 playtime_2weeks
  const recent = await fetchJson(
    `${STEAM_API}/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${steamId}&count=0&format=json`
  );
  const recentMap = new Map((recent?.response?.games ?? []).map((g) => [g.appid, g]));

  const games = ownedGames
    .map((g) => {
      const recentGame = recentMap.get(g.appid);
      return {
        appid: g.appid,
        name: g.name,
        playtime_hours: hours(g.playtime_forever ?? 0),
        playtime_2weeks_hours: hours(recentGame?.playtime_2weeks ?? 0),
        // 最后运行时间戳(Unix 秒),来自 GetOwnedGames 的 rtime_last_played;从未运行过为 0
        last_played: g.rtime_last_played ?? 0,
        cover: `${COVER_BASE}/${g.appid}/library_600x900.jpg`,
      };
    })
    // 总时长降序
    .sort((a, b) => b.playtime_hours - a.playtime_hours);

  const output = {
    updatedAt: new Date().toISOString(),
    games,
  };

  writeFileSync('public/steam_games.json', `${JSON.stringify(output, null, 2)}\n`, 'utf-8');
  console.log(`同步完成:${games.length} 款游戏 -> public/steam_games.json`);
}

main().catch((err) => {
  console.error(`同步失败:${err.message}`);
  process.exit(1);
});
