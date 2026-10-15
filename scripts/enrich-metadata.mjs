// 一次性元数据丰富脚本: 为注释文件预填中文名、官方 genres (作为 tags 建议值) 与发售日期 (Spec 07 / Issue #22)
// 用法: node scripts/enrich-metadata.mjs

import { runEnrichMetadata } from './steam-pipeline-core.ts';

runEnrichMetadata().catch((err) => {
  console.error(`enrich 异常中断: ${err.message}`);
  process.exit(1);
});
