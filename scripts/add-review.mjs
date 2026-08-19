// 交互式手写注释录入 CLI:一次录入一款游戏的游玩状态/段位/短评/长评/年份/平台
// 用法(必须在项目根目录): npm run review
//
// 写入 src/data/steam_annotations.json(合并更新):
// - 永不触碰自动字段(name_zh / tags / release_date 等本脚本不提问的字段)
// - 直接回车(跳过)的字段不写入/不覆盖,已有值保持原样
// - 游玩状态为六阶梯菜单(ADR-0007);平台回车默认 PC
// - 段位/短评/长评/年份为空则不写该字段
// 输入支持 TTY 交互与管道/重定向(测试或批处理)两种模式。
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const GAMES_FILE = 'public/steam_games.json';
const ANNOT_FILE = 'src/data/steam_annotations.json';

/** 六阶梯游玩状态(ADR-0007) */
const STATUS_OPTIONS = [
  { key: 'uncompleted', label: '未通关' },
  { key: 'completed', label: '已通关' },
  { key: 'perfect', label: '全成就' },
  { key: 'ongoing', label: '持续游玩' },
  { key: 'hiatus', label: '暂退长草' },
  { key: 'retired', label: '已退役' },
];
const STATUS_KEYS = new Set(STATUS_OPTIONS.map((s) => s.key));

function loadJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`读取 ${file} 失败:${err.message}`);
    console.error('请在项目根目录运行: npm run review');
    process.exit(1);
  }
}

// ---- 输入层:TTY 用 readline;非 TTY(管道)一次性读入全部行逐行消费,
//      避免 readline 在快速管道输入下丢失行的问题 ----
let rl = null;
let ask;
if (input.isTTY) {
  rl = createInterface({ input, output });
  ask = (q) => rl.question(q);
} else {
  const allLines = readFileSync(0, 'utf-8').split(/\r?\n/);
  let cursor = 0;
  ask = async (q) => {
    output.write(q);
    const line = allLines[cursor] ?? '';
    cursor += 1;
    output.write(line + '\n');
    return line;
  };
}

const gamesData = loadJson(GAMES_FILE);
const games = Array.isArray(gamesData.games) ? gamesData.games : [];
const annotations = loadJson(ANNOT_FILE);

/** 挑选游戏:输入名称关键词(匹配英文名/中文名)或 appid */
async function pickGame() {
  for (;;) {
    const raw = (await ask('输入游戏名关键词或 appid(直接回车退出): ')).trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) {
      const appid = Number(raw);
      const game = games.find((g) => g.appid === appid);
      if (game) return game;
      console.log(`appid ${appid} 不在 ${GAMES_FILE} 中,请重试`);
      continue;
    }
    const q = raw.toLowerCase();
    const matches = games.filter((g) => {
      const nameZh = annotations[String(g.appid)]?.name_zh ?? '';
      return g.name.toLowerCase().includes(q) || nameZh.toLowerCase().includes(q);
    });
    if (matches.length === 0) {
      console.log('没有匹配的游戏,换个关键词试试');
      continue;
    }
    if (matches.length === 1) return matches[0];
    const shown = matches.slice(0, 10);
    shown.forEach((g, i) => {
      const nameZh = annotations[String(g.appid)]?.name_zh ?? '';
      const display = nameZh ? `${nameZh} (${g.name})` : g.name;
      console.log(`  ${i + 1}. ${display}  [${g.appid}]  ${g.playtime_hours}h`);
    });
    const pick = (await ask('选择序号(回车选第 1 个): ')).trim();
    const n = pick === '' ? 1 : Number(pick);
    if (Number.isInteger(n) && n >= 1 && n <= shown.length) return shown[n - 1];
    console.log('序号无效,重试');
  }
}

/** 六阶梯状态菜单:回车保持当前值(无当前值则默认未通关) */
async function promptStatus(current) {
  console.log('\n游玩状态(六阶梯):');
  STATUS_OPTIONS.forEach((s, i) => {
    const mark = s.key === current ? ' (当前)' : '';
    console.log(`  ${i + 1}. ${s.label}${mark}`);
  });
  for (;;) {
    const answer = (await ask('选择状态序号(回车保持当前/默认未通关): ')).trim();
    if (answer === '') return STATUS_KEYS.has(current) ? current : 'uncompleted';
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= STATUS_OPTIONS.length) return STATUS_OPTIONS[n - 1].key;
    console.log('请输入 1-6');
  }
}

async function run() {
  const game = await pickGame();
  if (!game) {
    console.log('已退出,未做任何修改。');
    return;
  }

  const appid = String(game.appid);
  const existing = annotations[appid] ?? {};
  const nameZh = existing.name_zh ?? '';
  const display = nameZh ? `${nameZh} (${game.name})` : game.name;
  console.log(`\n已选中:${display}  [${appid}]  ${game.playtime_hours}h`);
  if (Object.keys(existing).length > 0) {
    console.log('当前注释:', JSON.stringify(existing));
  } else {
    console.log('当前注释: (无)');
  }

  const status = await promptStatus(existing.my_status);

  const rank = (await ask('🎮 如果这是竞技/网络游戏,请输入你的历史最高段位 (直接回车跳过): ')).trim();
  const review = (await ask('短评内容 (直接回车跳过): ')).trim();
  const blogUrl = (await ask('长评链接 (直接回车跳过,注意用小写路由): ')).trim();
  const playYear = (await ask('游玩年份 (直接回车跳过): ')).trim();
  if (playYear && !/^\d{4}$/.test(playYear)) {
    console.log(`游玩年份"${playYear}"非法(需 4 位数字年份),已跳过不写入`);
  }
  const platform = (await ask('平台 (直接回车默认 PC): ')).trim() || 'PC';

  // 合并更新:只写用户明确给出的字段,其余保持原样
  const updates = { my_status: status };
  if (rank) updates.my_rank = rank;
  if (review) updates.my_review = review;
  if (blogUrl) updates.blog_url = blogUrl;
  if (playYear && /^\d{4}$/.test(playYear)) updates.play_year = playYear;
  if (platform) updates.platform = platform;

  annotations[appid] = { ...existing, ...updates };
  writeFileSync(ANNOT_FILE, `${JSON.stringify(annotations, null, 2)}\n`, 'utf-8');

  console.log(`\n已写入 ${ANNOT_FILE}:`, JSON.stringify(annotations[appid], null, 2));
  console.log('提示:自动字段(中文名/tags/发售日期)未被触碰;推送上线用 git push。');
}

run()
  .catch((err) => {
    if (err && (err.name === 'AbortError' || err.code === 'ERR_USE_AFTER_CLOSE')) {
      process.exit(0);
    }
    console.error('出错:', err?.message ?? err);
    process.exit(1);
  })
  .finally(() => {
    if (rl) rl.close();
  });
