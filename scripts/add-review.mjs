// 交互式手写注释录入 CLI:一次录入一款游戏的游玩状态/段位/短评/长评/年份/平台 (Spec 07 / Issue #22)
// 用法(必须在项目根目录): npm run review

import { runAddReview } from './lib/steam-pipeline-core.ts';

runAddReview().catch((err) => {
  if (err && (err.name === 'AbortError' || err.code === 'ERR_USE_AFTER_CLOSE')) {
    process.exit(0);
  }
  console.error('出错:', err?.message ?? err);
  process.exit(1);
});
