// 回归测试: 数据装载记忆化 (Spec 04)
import { loadMergedGames, getSortPresets } from '../src/lib/steam-data.ts';

let failures = 0;
let total = 0;

function check(label: string, condition: boolean) {
  total++;
  if (condition) {
    console.log('PASS', label);
  } else {
    failures++;
    console.error('FAIL', label);
  }
}

// 1. 同一进程内连续两次调用返回相同引用
const call1 = loadMergedGames();
const call2 = loadMergedGames();

check('loadMergedGames() 多次调用返回相同对象引用', call1 === call2);
check('games 数组引用相同', call1.games === call2.games);

// 2. getSortPresets 返回相同引用
const presets1 = getSortPresets();
const presets2 = getSortPresets();

check('getSortPresets() 多次调用返回相同对象引用', presets1 === presets2);
check('sortPresets.playtime 数组引用相同', presets1.playtime === presets2.playtime);

// 3. Spec 19 (Issue #19): steam-data.ts 严禁透传重导出游玩状态领域词汇符号
import * as steamData from '../src/lib/steam-data.ts';

const FORBIDDEN_SYMBOLS = [
  'statusText',
  'statusLabel',
  'statusWeight',
  'statusToKey',
  'keyToStatus',
  'statusKeys',
  'isStatus',
  'STATUS_LADDER',
  'DEFAULT_STATUS',
];

for (const sym of FORBIDDEN_SYMBOLS) {
  check(`steam-data.ts 不透传重导出 ${sym}`, !(sym in steamData));
}

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
