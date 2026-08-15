// 导出脚本:把注释文件导出为 CSV 表格,供 Excel/WPS 批量编辑手写字段
// 用法: node scripts/json-to-csv.mjs
// 产物: steam.csv(UTF-8 BOM,Excel 打开中文不乱码)
//
// 设计要点(Q1-Q4 决策):
// - 只含手写字段 + 只读参考列(appid/游戏名),自动字段(中文名/发售日期)不进表
// - 通关状态预置三态、平台预置常用值(供 Excel 数据验证下拉)
// - tags 用分号分隔,空 = 空数组
// - 游玩年份为纯文本年份
import { readFileSync, writeFileSync } from 'node:fs';

const GAMES_FILE = 'public/steam_games.json';
const ANNOT_FILE = 'src/data/steam_annotations.json';
const OUT_FILE = 'steam.csv';

// 手写字段列(与 csv-to-json.mjs 保持一致)
const COLUMNS = [
  { key: 'appid', label: 'appid', readonly: true },
  { key: 'name', label: '游戏名(参考)', readonly: true },
  { key: 'name_zh', label: '中文名(可编辑)' },
  { key: 'my_status', label: '通关状态', options: ['未通关', '已通关', '全成就'] },
  { key: 'my_review', label: '短评' },
  { key: 'blog_url', label: '长评链接' },
  { key: 'play_year', label: '游玩年份', options: ['2012','2013','2014','2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026'] },
  { key: 'platform', label: '平台', options: ['PC', 'PlayStation', 'Xbox', 'Switch'] },
  { key: 'tags', label: '特色标签(分号分隔)' },
];

let games = [];
try {
  games = JSON.parse(readFileSync(GAMES_FILE, 'utf-8')).games ?? [];
} catch {
  games = [];
}

let annotations = {};
try {
  annotations = JSON.parse(readFileSync(ANNOT_FILE, 'utf-8'));
} catch {
  annotations = {};
}

/** CSV 单元格转义:含逗号/引号/换行时加引号,内部引号翻倍 */
function esc(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvCell(c) {
  return esc(c.options ? `${c.options.join('|')}|${c.value ?? ''}` : c.value ?? '');
}

// 首行:列名 + 选项提示(选项用 | 分隔,便于 Excel 识别)
const header = COLUMNS.map((c) => (c.options ? `${c.label}(${c.options.join('/')})` : c.label)).join(',');

const rows = [];
rows.push(header);

// 以游戏数据为基准(保证全部游戏都在表里),合并注释中的手写值
for (const game of games) {
  const ann = annotations[String(game.appid)] ?? {};
  const statusMap = { completed: '已通关', perfect: '全成就', uncompleted: '未通关' };
  const values = {
    appid: game.appid,
    name: game.name,
    name_zh: ann.name_zh ?? '',
    my_status: statusMap[ann.my_status] ?? '未通关',
    my_review: ann.my_review ?? '',
    blog_url: ann.blog_url ?? '',
    play_year: ann.play_year ?? '',
    platform: ann.platform ?? '',
    tags: Array.isArray(ann.tags) ? ann.tags.join(';') : '',
  };
  rows.push(COLUMNS.map((c) => esc(values[c.key])).join(','));
}

// UTF-8 BOM:Excel 打开中文不乱码
const bom = '\uFEFF';
writeFileSync(OUT_FILE, bom + rows.join('\r\n') + '\r\n', 'utf-8');
console.log(`已导出 ${games.length} 行 -> ${OUT_FILE}`);
console.log('在 Excel/WPS 中打开编辑,填完后保存为 CSV(UTF-8),再运行 csv-to-json');
