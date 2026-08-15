// 导回脚本:把编辑后的 steam.csv 转回注释文件(仅更新手写字段)
// 用法: node scripts/csv-to-json.mjs
// 读取: steam.csv(项目根目录)
// 写入: src/data/steam_annotations.json(合并更新,自动字段永不触碰)
//
// 三重安全保护(Q5 决策):
// 1. 以原 JSON 的 appid 为基准,表格新增行忽略
// 2. 非法状态值回退"未通关"并打印警告
// 3. 自动字段(name_zh/release_date)绝不触碰
import { readFileSync, writeFileSync } from 'node:fs';

const CSV_FILE = 'steam.csv';
const GAMES_FILE = 'public/steam_games.json';
const ANNOT_FILE = 'src/data/steam_annotations.json';

const STATUS_VALUES = new Set(['未通关', '已通关', '全成就']);

function parseCSV(text) {
  // 去掉 BOM
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}


let csvText;
try {
  csvText = readFileSync(CSV_FILE, 'utf-8');
} catch (err) {
  console.error(`读取 ${CSV_FILE} 失败:${err.message}`);
  console.error('请先运行 json-to-csv 导出表格,编辑后再运行本脚本。');
  process.exit(1);
}

let annotations = {};
try {
  annotations = JSON.parse(readFileSync(ANNOT_FILE, 'utf-8'));
} catch {
  annotations = {};
}

let knownAppids = new Set();
try {
  knownAppids = new Set((JSON.parse(readFileSync(GAMES_FILE, 'utf-8')).games ?? []).map((g) => String(g.appid)));
} catch {
  // 读不到游戏数据时,以注释文件已有 appid 为基准
  knownAppids = new Set(Object.keys(annotations));
}

const rows = parseCSV(csvText);
if (rows.length < 2) {
  console.error('CSV 中没有数据行');
  process.exit(1);
}

// 列名 → 键映射(中文表头 → 内部键)
const HEADER_TO_KEY = {
  'appid': 'appid',
  '游戏名(参考)': 'name',
  '通关状态': 'my_status',
  '短评': 'my_review',
  '长评链接': 'blog_url',
  '游玩年份': 'play_year',
  '平台': 'platform',
  '特色标签': 'tags',
};

const header = rows[0];
const idx = {};
for (let i = 0; i < header.length; i++) {
  // 剥离选项提示后缀(如 "通关状态(未通关/已通关/全成就)" -> "通关状态")
  const h = header[i].split('(')[0].trim();
  const key = HEADER_TO_KEY[h];
  if (key) idx[key] = i;
}

// 校验列映射:缺关键列则报错(注意列索引 0 是合法值,不能用 !idx 判断)
if (idx.appid === undefined || idx.my_status === undefined) {
  console.error(`CSV 表头列不匹配。期望表头: ${Object.keys(HEADER_TO_KEY).join(', ')}`);
  console.error(`实际表头: ${header.join(' | ')}`);
  process.exit(1);
}

let updated = 0;
let ignoredRows = 0;
let warnings = [];

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const appid = (row[idx.appid] ?? '').trim();
  if (!appid || !knownAppids.has(appid)) {
    ignoredRows++;
    continue; // 安全保护 1:只认已知 appid
  }
  const ann = annotations[appid] ?? {};

  // 通关状态:非法值回退未通关(安全保护 2)
  const status = (row[idx.my_status] ?? '').trim();
  if (status) {
    if (STATUS_VALUES.has(status)) {
      ann.my_status = status === '未通关' ? 'uncompleted' : status === '已通关' ? 'completed' : 'perfect';
    } else {
      warnings.push(`[${appid}] 通关状态"${status}"非法,回退为未通关`);
      ann.my_status = 'uncompleted';
    }
  }

  const review = (row[idx.my_review] ?? '').trim();
  if (review) ann.my_review = review;

  const blogUrl = (row[idx.blog_url] ?? '').trim();
  if (blogUrl) ann.blog_url = blogUrl;

  const playYear = (row[idx.play_year] ?? '').trim();
  if (playYear) ann.play_year = playYear;

  const platform = (row[idx.platform] ?? '').trim();
  if (platform) ann.platform = platform;

  // tags:分号分隔拆分,trim 去空格,空 = 不覆盖
  const tagsRaw = (row[idx.tags] ?? '').trim();
  if (tagsRaw) {
    const tags = tagsRaw
      .split(/[;；]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) ann.tags = tags;
  }

  annotations[appid] = ann;
  updated++;
}

writeFileSync(ANNOT_FILE, `${JSON.stringify(annotations, null, 2)}\n`, 'utf-8');
console.log(`完成:更新 ${updated} 款,忽略 ${ignoredRows} 行(未知 appid 或空行) -> ${ANNOT_FILE}`);
if (warnings.length > 0) {
  console.log(`\n警告(${warnings.length}):`);
  warnings.slice(0, 10).forEach((w) => console.log(`  ${w}`));
  if (warnings.length > 10) console.log(`  ...等共 ${warnings.length} 条`);
}
