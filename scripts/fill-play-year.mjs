// 游玩年份预填脚本:把 play_year 覆盖为 Steam API 最后运行时间的年份
// 用法: node scripts/fill-play-year.mjs
//
// 读取 public/steam_games.json 的 last_played(Unix 秒)时间戳,
// 提取年份写入注释文件的 play_year 字段。
// 规则(2026-08-19 修订):
// - 单年值(如 "2021"):覆盖为最后运行年份(旧行为,用户已明确)
// - 区间值(如 "2021-2026",含 '-'):视为策展数据,不覆盖、不清空
// - 从未运行过(last_played=0)且为单年:清空(无数据不填)
// 属一次性/按需工具,不进每日同步链路。

import { readFileSync, writeFileSync } from 'node:fs';

const GAMES_FILE = 'public/steam_games.json';
const ANNOT_FILE = 'src/data/steam_annotations.json';

let games;
try {
  games = JSON.parse(readFileSync(GAMES_FILE, 'utf-8')).games ?? [];
} catch (err) {
  console.error(`读取 ${GAMES_FILE} 失败:${err.message}`);
  process.exit(1);
}

let annotations = {};
try {
  annotations = JSON.parse(readFileSync(ANNOT_FILE, 'utf-8'));
} catch {
  annotations = {};
}

let filled = 0;
let cleared = 0;
let preserved = 0;

for (const game of games) {
  const key = String(game.appid);
  const ann = annotations[key];
  if (!ann) continue;

  // 区间值(含 '-')是策展数据:既不覆盖也不清空
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
    // 从未运行过:清空 play_year(没有最后运行年份可填)
    delete ann.play_year;
    cleared++;
  }
}

writeFileSync(ANNOT_FILE, `${JSON.stringify(annotations, null, 2)}\n`, 'utf-8');
console.log(`完成:填充 ${filled} 条,清空 ${cleared} 条(从未运行),保留区间 ${preserved} 条 -> ${ANNOT_FILE}`);
