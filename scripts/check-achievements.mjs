// 一次性成就检查脚本:找出已 100% 全成就(perfect)的游戏
// 用法(需要环境变量): STEAM_API_KEY=xxx STEAM_ID=xxx node scripts/check-achievements.mjs
//   可选 --appid=1172470:仅检查指定游戏(快速验证用)
//
// 读取 public/steam_games.json 的游戏列表,逐款调用
// ISteamUserStats/GetPlayerAchievements/v1 统计成就解锁情况,并记录最早成就解锁时间
// (firstUnlockAt,Unix 秒)——「首次游玩(估)」的唯一数据源(ADR-0008)。
// 完整结果写入 public/steam_achievements.json,并在控制台打印全成就清单。
// 属一次性/手动工具,不进每日同步链路;注释文件的 my_status 仍由手工维护。

import { readFileSync, writeFileSync } from 'node:fs';

const STEAM_STATS_API = 'https://api.steampowered.com/ISteamUserStats';
const GAMES_FILE = 'public/steam_games.json';
const OUT_FILE = 'public/steam_achievements.json';
const REQUEST_INTERVAL_MS = 1300; // 保守间隔(突发限流约 200 次/5 分钟)
const RETRY_MAX = 3;
const RETRY_DELAY_MS = 2000;

const apiKey = process.env.STEAM_API_KEY;
const steamId = process.env.STEAM_ID;

if (!apiKey || !steamId) {
  console.error('缺少环境变量 STEAM_API_KEY 或 STEAM_ID');
  process.exit(1);
}

const onlyAppid = process.argv.find((a) => a.startsWith('--appid='))?.split('=')[1];

let games;
try {
  games = JSON.parse(readFileSync(GAMES_FILE, 'utf-8')).games ?? [];
} catch (err) {
  console.error(`读取 ${GAMES_FILE} 失败:${err.message}`);
  process.exit(1);
}
if (onlyAppid) {
  games = games.filter((g) => String(g.appid) === onlyAppid);
}

if (games.length === 0) {
  console.error(`${GAMES_FILE} 中没有可检查的游戏`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 带重试的成就查询;返回 { error } 或 { unlocked, total } */
async function fetchAchievements(appid) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const res = await fetch(
        `${STEAM_STATS_API}/GetPlayerAchievements/v1/?key=${apiKey}&steamid=${steamId}&appid=${appid}&format=json`
      );
      const json = await res.json().catch(() => null);
      const ps = json?.playerstats;
      if (res.status === 400 || (res.status === 200 && ps?.error)) {
        return { error: ps?.error ?? `HTTP ${res.status}` };
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const list = Array.isArray(ps?.achievements) ? ps.achievements : [];
      const unlocked = list.filter((a) => a.achieved === 1);
      // 最早成就解锁时间(Unix 秒):已解锁成就中 unlocktime 的最小值;无已解锁或全为 0 → undefined
      const firstUnlockAt = unlocked
        .map((a) => a.unlocktime)
        .filter((t) => typeof t === 'number' && t > 0)
        .sort((a, b) => a - b)[0];
      return {
        unlocked: unlocked.length,
        total: list.length,
        firstUnlockAt,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_MAX) {
        const delay = RETRY_DELAY_MS * 2 ** (attempt - 1);
        console.warn(`重试 ${attempt}/${RETRY_MAX}: appid=${appid} -> ${lastErr.message},${delay}ms 后重试`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

const results = [];
let perfectCount = 0;
let noStatsCount = 0;

for (let i = 0; i < games.length; i++) {
  const { appid, name } = games[i];
  let entry;
  try {
    const r = await fetchAchievements(appid);
    entry = { appid, name };
    if (r.error) {
      if (/no stats/i.test(r.error)) {
        entry.hasStats = false;
        noStatsCount++;
      } else if (/not public|private/i.test(r.error)) {
        console.error(`隐私设置阻止成就查询:${r.error}`);
        console.error('请将 Steam 个人资料与「游戏详情」隐私设为 Public 后重试。');
        process.exit(1);
      } else {
        entry.hasStats = false;
        entry.error = r.error;
        console.warn(`appid ${appid}(${name}) 无成就数据:${r.error}`);
        noStatsCount++;
      }
    } else {
      entry.hasStats = true;
      entry.unlocked = r.unlocked;
      entry.total = r.total;
      if (r.firstUnlockAt) entry.firstUnlockAt = r.firstUnlockAt;
      entry.perfect = r.total > 0 && r.unlocked === r.total;
      if (entry.perfect) perfectCount++;
    }
  } catch (err) {
    // 单款查询失败(如服务器 500)不应中断整批:记录后继续,汇总时可见
    entry = { appid, name, hasStats: false, error: err.message };
    console.warn(`appid ${appid}(${name}) 查询失败:${err.message},已跳过(可重跑补)`);
    noStatsCount++;
  }

  results.push(entry);
  const flag = entry.perfect ? ' [全成就]' : '';
  console.log(`[${i + 1}/${games.length}] ${name} (${appid})${flag}`);
  await sleep(REQUEST_INTERVAL_MS);
}

const output = {
  updatedAt: new Date().toISOString(),
  total: results.length,
  perfectCount,
  games: results,
};
writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');

console.log('');
console.log(`检查完成:${results.length} 款,有成就 ${results.filter((g) => g.hasStats).length} 款,全成就 ${perfectCount} 款`);
console.log('全成就(perfect 候选)清单:');
for (const g of results.filter((g) => g.perfect)) {
  console.log(`  [${g.appid}] ${g.name} (${g.unlocked}/${g.total})`);
}
console.log(`完整结果 -> ${OUT_FILE}`);
