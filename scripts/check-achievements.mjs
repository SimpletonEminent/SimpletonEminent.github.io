// 一次性成就检查脚本: 找出已 100% 全成就 (perfect) 的游戏 (Spec 07 / Issue #22)
// 用法(需要环境变量): STEAM_API_KEY=xxx STEAM_ID=xxx node scripts/check-achievements.mjs
//   可选 --appid=1172470: 仅检查指定游戏 (快速验证用)

import { runCheckAchievements } from './steam-pipeline-core.ts';

const onlyAppid = process.argv.find((a) => a.startsWith('--appid='))?.split('=')[1];

runCheckAchievements({ onlyAppid }).catch((err) => {
  console.error(`成就检查中断: ${err.message}`);
  process.exit(1);
});
