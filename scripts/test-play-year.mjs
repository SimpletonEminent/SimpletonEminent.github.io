// 回归测试:游玩年份格式(scripts/lib/play-year.mjs)
// 规则:单年(如 "2024")或区间(如 "2021-2026",起点 ≤ 终点)。
// 运行:npm test(node scripts/test-play-year.mjs)
import { isValidPlayYear } from './lib/play-year.mjs';

const cases = [
  ['2024', true],
  ['2021-2026', true],
  ['2021-2021', true],
  ['2013', true],
  ['202', false],
  ['2021-', false],
  ['-2026', false],
  ['2021-2026x', false],
  ['2026-2021', false], // 倒置区间(终点早于起点)
  ['', false],
  ['abcd', false],
  ['2021 2026', false],
  [null, false],
  [2024, false],
];

let failures = 0;
for (const [input, expected] of cases) {
  const actual = isValidPlayYear(input);
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(input), '→', actual, expected ? '(期望 true)' : '(期望 false)');
}
console.log(failures === 0 ? 'ALL PASS (' + cases.length + ' checks)' : failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
