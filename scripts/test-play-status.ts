// 回归测试:游玩状态唯一词汇模块(src/lib/play-status.ts)
// 只测外部行为——给定状态键/中文,返回正确文案/权重/映射;不测模块内部实现。
// 运行:npm test(node --experimental-strip-types scripts/test-play-status.ts)
import {
  STATUS_LADDER,
  DEFAULT_STATUS,
  statusText,
  statusLabel,
  statusWeight,
  statusToKey,
  keyToStatus,
  isStatus,
  isStatusLabel,
  statusKeys,
  type Status,
} from '../src/lib/play-status.ts';

let failures = 0;
let total = 0;
function check(label: string, actual: unknown, expected: unknown) {
  total++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('PASS', label);
  } else {
    failures++;
    console.error('FAIL', label, '| actual:', a, '| expected:', e);
  }
}

// 六阶梯每个键的 statusLabel 返回正确中文
const EXPECT_LABEL: Record<Status, string> = {
  uncompleted: '未通关',
  completed: '已通关',
  perfect: '全成就',
  ongoing: '持续游玩',
  hiatus: '暂退长草',
  retired: '已退役',
};
for (const key of statusKeys()) {
  check('statusLabel(' + key + ')', statusLabel(key), EXPECT_LABEL[key]);
  check('statusText(' + key + ')', statusText(key), EXPECT_LABEL[key]);
}

// statusWeight 排序:全成就 > 已通关 > 持续游玩 > 未通关 > 暂退长草 > 已退役
const weightOrder: Status[] = ['perfect', 'completed', 'ongoing', 'uncompleted', 'hiatus', 'retired'];
const weights = weightOrder.map((k) => statusWeight(k));
check('statusWeight 降序', weights, [6, 5, 4, 3, 2, 1]);
for (let i = 1; i < weights.length; i++) {
  check('statusWeight 第' + i + '项 > 第' + (i + 1) + '项', weights[i - 1] > weights[i], true);
}

// statusToKey / keyToStatus 双向一致(所有中文 ↔ 键往返不丢失)
for (const entry of STATUS_LADDER) {
  // 中文 → 键 → 中文 往返
  check('statusToKey(' + entry.label + ')', statusToKey(entry.label), entry.key);
  check('keyToStatus 往返 ' + entry.key, keyToStatus(entry.key), entry.key);
  check('statusToKey 往返 ' + entry.label, statusToKey(statusLabel(entry.key)), entry.key);
}

// 中文 ↔ 键 集合一致性:全部键都能取到文案,全部文案都能取到键
check('STATUS_LADDER 共 6 级', STATUS_LADDER.length, 6);
check('statusKeys() 共 6 个', statusKeys().length, 6);
check('isStatus(perfect)', isStatus('perfect'), true);
check('isStatus(bogus)', isStatus('bogus'), false);
check('isStatusLabel(全成就)', isStatusLabel('全成就'), true);
check('isStatusLabel(乱写的)', isStatusLabel('乱写的'), false);

// 非法输入返回安全默认(未知键 → 未通关)
check('statusText(未知键) 回退未通关', statusText('bogus'), '未通关');
check('statusLabel(未知键) 回退未通关', statusLabel('bogus' as Status), '未通关');
check('statusWeight(未知键)', statusWeight('bogus'), 0);
check('statusToKey(未知文案)', statusToKey('乱写的'), DEFAULT_STATUS);
check('keyToStatus(未知键)', keyToStatus('bogus'), DEFAULT_STATUS);
check('DEFAULT_STATUS 为未通关', DEFAULT_STATUS, 'uncompleted');

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
