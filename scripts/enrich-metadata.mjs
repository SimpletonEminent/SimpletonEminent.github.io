// 一次性元数据丰富脚本:为注释文件预填中文名、官方 genres(作为 tags 建议值)与发售日期
// 用法: node scripts/enrich-metadata.mjs
//
// 读取 public/steam_games.json(自动数据)与 src/data/steam_annotations.json(手工注释),
// 对每个缺少 name_zh / tags / release_date 的游戏,调用 Steam Store appdetails?l=schinese
// 抓取中文名、官方 genres 与发售日期,写入注释文件。已存在的字段永不覆盖(手工优先)。
// 仅需手动运行一次(或想增补新游戏时),不属于每日同步链路。
//
// 注意:appdetails 限流约 200 次/5 分钟,脚本内置间隔,游戏多时请分批运行。

import { readFileSync, writeFileSync } from 'node:fs';

const GAMES_FILE = 'public/steam_games.json';
const ANNOT_FILE = 'src/data/steam_annotations.json';
const REQUEST_INTERVAL_MS = 1600; // 保守间隔,避免 429

let annotations;
try {
  annotations = JSON.parse(readFileSync(ANNOT_FILE, 'utf-8'));
} catch {
  annotations = {};
}

let games;
try {
  games = JSON.parse(readFileSync(GAMES_FILE, 'utf-8')).games ?? [];
} catch (err) {
  console.error(`读取 ${GAMES_FILE} 失败:${err.message}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAppDetails(appid) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=schinese&cc=cn`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.[String(appid)]?.data;
  if (!data) return null;
  return {
    name_zh: data.name ?? '',
    genres: (data.genres ?? []).map((g) => g.description).filter(Boolean),
    release_date: data.release_date?.date ?? '',
  };
}

let enriched = 0;
let skipped = 0;

for (const game of games) {
  const key = String(game.appid);
  const ann = annotations[key] ?? {};
  const hasNameZh = Boolean(ann.name_zh);
  const hasTags = Array.isArray(ann.tags) && ann.tags.length > 0;
  const hasReleaseDate = Boolean(ann.release_date);

  if (hasNameZh && hasTags && hasReleaseDate) {
    skipped++;
    continue;
  }

  try {
    const detail = await fetchAppDetails(game.appid);
    if (!detail) {
      console.warn(`appid ${game.appid} 无详情数据,跳过`);
      skipped++;
      continue;
    }
    if (!hasNameZh && detail.name_zh) ann.name_zh = detail.name_zh;
    if (!hasTags && detail.genres.length > 0) ann.tags = detail.genres;
    if (!hasReleaseDate && detail.release_date) ann.release_date = detail.release_date;
    annotations[key] = ann;
    enriched++;
    console.log(
      `[${key}] ${game.name} -> 中文名:${ann.name_zh ?? '-'} tags:[${(ann.tags ?? []).join(', ')}] 发售:${ann.release_date ?? '-'}`
    );
  } catch (err) {
    console.warn(`appid ${game.appid} 请求失败:${err.message},跳过(可重跑)`);
    skipped++;
  }

  await sleep(REQUEST_INTERVAL_MS);
}

writeFileSync(ANNOT_FILE, `${JSON.stringify(annotations, null, 2)}\n`, 'utf-8');
console.log(`完成:丰富 ${enriched} 款,跳过 ${skipped} 款 -> ${ANNOT_FILE}`);
