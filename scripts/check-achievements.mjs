// 一次性成就检查脚本: 找出已 100% 全成就 (perfect) 的游戏 (Spec 07)
// 用法(需要环境变量): STEAM_API_KEY=xxx STEAM_ID=xxx node scripts/check-achievements.mjs
//   可选 --appid=1172470: 仅检查指定游戏 (快速验证用)

import {
  PATHS,
  loadGamesData,
  saveAchievementsData,
  fetchPlayerAchievements,
  ResilientHttpClient,
} from './steam-pipeline-core.ts';

const apiKey = process.env.STEAM_API_KEY;
const steamId = process.env.STEAM_ID;

if (!apiKey || !steamId) {
  console.error('缺少环境变量 STEAM_API_KEY 或 STEAM_ID');
  process.exit(1);
}

const onlyAppid = process.argv.find((a) => a.startsWith('--appid='))?.split('=')[1];
let { games } = loadGamesData();

if (onlyAppid) {
  games = games.filter((g) => String(g.appid) === onlyAppid);
}

if (games.length === 0) {
  console.error(`${PATHS.GAMES} 中没有可检查的游戏`);
  process.exit(1);
}

const client = new ResilientHttpClient({ requestIntervalMs: 1300 });

async function main() {
  const results = [];
  let perfectCount = 0;
  let noStatsCount = 0;

  for (let i = 0; i < games.length; i++) {
    const { appid, name } = games[i];
    let entry;
    try {
      const r = await fetchPlayerAchievements(apiKey, steamId, appid, client);
      entry = { appid, name };
      if ('error' in r) {
        if (/no stats/i.test(r.error)) {
          entry.hasStats = false;
          noStatsCount++;
        } else if (/not public|private/i.test(r.error)) {
          console.error(`隐私设置阻止成就查询: ${r.error}`);
          console.error('请将 Steam 个人资料与“游戏详情”隐私设为 Public 后重试。');
          process.exit(1);
        } else {
          entry.hasStats = false;
          entry.error = r.error;
          console.warn(`appid ${appid}(${name}) 无成就数据: ${r.error}`);
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
      const msg = err instanceof Error ? err.message : String(err);
      entry = { appid, name, hasStats: false, error: msg };
      console.warn(`appid ${appid}(${name}) 查询失败: ${msg}, 已跳过(可重跑补)`);
      noStatsCount++;
    }

    results.push(entry);
    const flag = entry.perfect ? ' [全成就]' : '';
    console.log(`[${i + 1}/${games.length}] ${name} (${appid})${flag}`);
  }

  const output = {
    updatedAt: new Date().toISOString(),
    total: results.length,
    perfectCount,
    games: results,
  };

  saveAchievementsData(output);

  console.log('');
  console.log(
    `检查完成: ${results.length} 款, 有成就 ${results.filter((g) => g.hasStats).length} 款, 全成就 ${perfectCount} 款`
  );
  console.log('全成就(perfect 候选)清单:');
  for (const g of results.filter((g) => g.perfect)) {
    console.log(`  [${g.appid}] ${g.name} (${g.unlocked}/${g.total})`);
  }
  console.log(`完整结果 -> ${PATHS.ACHIEVEMENTS}`);
}

main().catch((err) => {
  console.error(`成就检查中断: ${err.message}`);
  process.exit(1);
});
