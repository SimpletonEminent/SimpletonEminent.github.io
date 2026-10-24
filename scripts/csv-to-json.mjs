// 导回脚本: 把编辑后的 steam.csv 转回注释文件 (仅更新手写字段, Spec 07 / Issue #22)
// 用法: node --experimental-strip-types scripts/csv-to-json.mjs
// 读取: steam.csv (PATHS.CSV)
// 写入: src/data/steam_annotations.json (PATHS.ANNOTATIONS, 合并更新, 自动字段永不触碰)

import { runCsvToJson } from './lib/steam-pipeline-core.ts';

runCsvToJson().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
