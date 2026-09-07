// 导出脚本: 把注释文件导出为 CSV 表格, 供 Excel/WPS 批量编辑手写字段 (Spec 07)
// 用法: node --experimental-strip-types scripts/json-to-csv.mjs
// 产物: steam.csv (UTF-8 BOM, Excel 打开中文不乱码)

import { writeFileSync } from 'node:fs';
import {
  PATHS,
  loadGamesData,
  loadAnnotations,
  exportAnnotationsToCsv,
} from './steam-pipeline-core.ts';

const { games } = loadGamesData();
const annotations = loadAnnotations();
const csvContent = exportAnnotationsToCsv(games, annotations);

writeFileSync(PATHS.CSV, csvContent, 'utf-8');
console.log(`已导出 ${games.length} 行 -> ${PATHS.CSV}`);
console.log('在 Excel/WPS 中打开编辑, 填完后保存为 CSV(UTF-8), 再运行 csv-to-json');
