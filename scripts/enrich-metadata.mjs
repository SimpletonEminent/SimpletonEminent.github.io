// 一次性元数据丰富脚本: 为注释文件预填中文名、官方 genres (作为 tags 建议值) 与发售日期 (Spec 07)
// 用法: node scripts/enrich-metadata.mjs

import {
  PATHS,
  loadGamesData,
  loadAnnotations,
  saveAnnotations,
  fetchAppDetails,
  ResilientHttpClient,
} from './steam-pipeline-core.ts';

const annotations = loadAnnotations();
const { games } = loadGamesData();

if (games.length === 0) {
  console.error(`读取 ${PATHS.GAMES} 失败或游戏列表为空`);
  process.exit(1);
}

const client = new ResilientHttpClient({ requestIntervalMs: 1600 });
let enriched = 0;
let skipped = 0;

async function main() {
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
      const detail = await fetchAppDetails(game.appid, client);
      if (!detail) {
        console.warn(`appid ${game.appid} 无详情数据, 跳过`);
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
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`appid ${game.appid} 请求失败:${msg}, 跳过(可重跑)`);
      skipped++;
    }
  }

  saveAnnotations(annotations);
  console.log(`完成: 丰富 ${enriched} 款, 跳过 ${skipped} 款 -> ${PATHS.ANNOTATIONS}`);
}

main().catch((err) => {
  console.error(`enrich 异常中断: ${err.message}`);
  process.exit(1);
});
