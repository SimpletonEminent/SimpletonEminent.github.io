// 回归测试:徽章组合规则(ADR-0007 v2)
// 规则:游玩状态徽章永远显示;填了段位则追加段位徽章,段位绝不顶替状态。
// 运行:npm test(node --experimental-strip-types scripts/test-badges.ts)
import { badgesFor, type Status } from '../src/lib/steam-data.ts';

const STATUSES: Status[] = ['uncompleted', 'completed', 'perfect', 'ongoing', 'hiatus', 'retired'];

function makeGame(my_status: Status, my_rank: string) {
  return { my_status, my_rank };
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('PASS', label);
  } else {
    failures++;
    console.error('FAIL', label, '| actual:', a, '| expected:', e);
  }
}

for (const status of STATUSES) {
  // 无段位 → 仅状态徽章
  check('无段位 / ' + status, badgesFor(makeGame(status, '')), [
    { kind: 'status', value: status },
  ]);
  // 有段位 → 状态 + 段位(段位绝不顶替状态)
  check('有段位 / ' + status, badgesFor(makeGame(status, '铂金')), [
    { kind: 'status', value: status },
    { kind: 'rank', value: '铂金' },
  ]);
}
// 空白段位视为未填写
check('空白段位', badgesFor(makeGame('ongoing', '   ')), [{ kind: 'status', value: 'ongoing' }]);

console.log(failures === 0 ? 'ALL PASS (' + (STATUSES.length * 2 + 1) + ' checks)' : failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
