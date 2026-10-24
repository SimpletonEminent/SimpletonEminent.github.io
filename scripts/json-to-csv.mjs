// 导出脚本: 把注释文件导出为 CSV 表格, 供 Excel/WPS 批量编辑手写字段 (Spec 07 / Issue #22)
// 用法: node --experimental-strip-types scripts/json-to-csv.mjs
// 产物: steam.csv (UTF-8 BOM, Excel 打开中文不乱码)

import { runJsonToCsv } from './lib/steam-pipeline-core.ts';

runJsonToCsv().catch((err) => {
  console.error(`json-to-csv 导出失败: ${err.message}`);
  process.exit(1);
});
