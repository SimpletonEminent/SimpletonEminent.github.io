// 游玩年份预填脚本: 把 play_year 覆盖为 Steam API 最后运行时间的年份 (Spec 07)
// 用法: node scripts/fill-play-year.mjs

import {
  PATHS,
  loadGamesData,
  loadAnnotations,
  saveAnnotations,
} from './steam-pipeline-core.ts';

const { games } = loadGamesData();
if (games.length === 0) {
  console.error(`读取 ${PATHS.GAMES} 失败或为空`);
  process.exit(1);
}

const annotations = loadAnnotations();

let filled = 0;
let cleared = 0;
let preserved = 0;

for (const game of games) {
  const key = String(game.appid);
  const ann = annotations[key];
  if (!ann) continue;

  // 区间值(含 '-')是策展数据: 既不覆盖也不清空
  if (typeof ann.play_year === 'string' && ann.play_year.includes('-')) {
    preserved++;
    continue;
  }

  const ts = game.last_played ?? 0;
  if (ts > 0) {
    const year = String(new Date(ts * 1000).getUTCFullYear());
    if (ann.play_year !== year) {
      ann.play_year = year;
      filled++;
    }
  } else if (ann.play_year) {
    // 从未运行过: 清空 play_year(没有最后运行年份可填)
    delete ann.play_year;
    cleared++;
  }
}

saveAnnotations(annotations);
console.log(
  `完成: 填充 ${filled} 条, 清空 ${cleared} 条(从未运行), 保留区间 ${preserved} 条 -> ${PATHS.ANNOTATIONS}`
);
