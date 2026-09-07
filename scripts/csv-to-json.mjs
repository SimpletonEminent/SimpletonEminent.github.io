// 导回脚本: 把编辑后的 steam.csv 转回注释文件 (仅更新手写字段, Spec 07)
// 用法: node --experimental-strip-types scripts/csv-to-json.mjs
// 读取: steam.csv (PATHS.CSV)
// 写入: src/data/steam_annotations.json (PATHS.ANNOTATIONS, 合并更新, 自动字段永不触碰)

import { readFileSync } from 'node:fs';
import {
  PATHS,
  loadGamesData,
  loadAnnotations,
  saveAnnotations,
  importAnnotationsFromCsv,
} from './steam-pipeline-core.ts';

let csvText;
try {
  csvText = readFileSync(PATHS.CSV, 'utf-8');
} catch (err) {
  console.error(`读取 ${PATHS.CSV} 失败: ${err.message}`);
  console.error('请先运行 json-to-csv 导出表格, 编辑后再运行本脚本。');
  process.exit(1);
}

const currentAnnotations = loadAnnotations();
const { games } = loadGamesData();
const knownAppids =
  games.length > 0
    ? new Set(games.map((g) => String(g.appid)))
    : new Set(Object.keys(currentAnnotations));

try {
  const { annotations, updated, ignored, warnings } = importAnnotationsFromCsv(
    csvText,
    currentAnnotations,
    knownAppids
  );

  saveAnnotations(annotations);
  console.log(
    `完成: 更新 ${updated} 款, 忽略 ${ignored} 行(未知 appid 或空行) -> ${PATHS.ANNOTATIONS}`
  );

  if (warnings.length > 0) {
    console.log(`\n警告(${warnings.length}):`);
    warnings.slice(0, 10).forEach((w) => console.log(`  ${w}`));
    if (warnings.length > 10) console.log(`  ...等共 ${warnings.length} 条`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
