// 回归测试: 徽章展示模板模块 (Status Badge Module, Spec 08 / Spec 15)
// 职责: 外部黑盒断言徽章 HTML 标记结构、样式类名、词汇文案、无障碍属性 (aria-label) 与 XSS 转义。
// 运行: npm test (node --experimental-strip-types scripts/test-badge-render.ts)

import {
  renderBadges,
  renderBadgesHtml,
  renderBadge,
  esc,
  type BadgeGameInput,
} from '../src/components/game-presentation.ts';
import { statusKeys, statusText } from '../src/lib/play-status.ts';

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

console.log('--- 测试徽章展示模板模块 (Status Badge Module) ---');

const ALL_STATUSES = statusKeys();

// 1. 六阶梯状态全覆盖 (无段位 → 单徽章, 含 class、data-status、文案与 aria-label)
for (const status of ALL_STATUSES) {
  const label = statusText(status);
  const game: BadgeGameInput = { my_status: status };
  const html = renderBadges(game);

  check(`${status}: 包含 status-badge 类名`, html.includes('class="status-badge"'), true);
  check(`${status}: 包含 data-status="${status}"`, html.includes(`data-status="${status}"`), true);
  check(`${status}: 包含展示文本 "${label}"`, html.includes(`>${label}</span>`), true);
  check(`${status}: 包含无障碍属性 aria-label="游玩状态：${label}"`, html.includes(`aria-label="游玩状态：${label}"`), true);
  check(`${status}: 无段位时绝不包含 rank-badge`, html.includes('rank-badge'), false);
  check(`${status}: 无段位时绝不包含段位 aria-label`, html.includes('aria-label="段位：'), false);
}

// 2. 有段位 (段位追加、双徽章并排、段位无障碍语义)
for (const status of ALL_STATUSES) {
  const label = statusText(status);
  const rank = '璀璨钻石 💎';
  const game: BadgeGameInput = { my_status: status, my_rank: rank };
  const html = renderBadges(game);

  check(`有段位 / ${status}: 状态徽章存在`, html.includes(`data-status="${status}"`), true);
  check(`有段位 / ${status}: 状态无障碍属性正确`, html.includes(`aria-label="游玩状态：${label}"`), true);
  check(`有段位 / ${status}: 段位徽章存在 (rank-badge)`, html.includes('class="status-badge rank-badge"'), true);
  check(`有段位 / ${status}: 段位展示文本正确`, html.includes(`>${rank}</span>`), true);
  check(`有段位 / ${status}: 段位无障碍属性正确`, html.includes(`aria-label="段位：${rank}"`), true);

  // 顺序断言: 状态徽章必须排在段位徽章前面
  const statusIdx = html.indexOf(`data-status="${status}"`);
  const rankIdx = html.indexOf('class="status-badge rank-badge"');
  check(`有段位 / ${status}: 状态徽章在段位徽章之前`, statusIdx < rankIdx, true);
}

// 3. 空白与未定义段位防御性处理
check('段位为空字符串时只输出单徽章', renderBadges({ my_status: 'ongoing', my_rank: '' }).includes('rank-badge'), false);
check('段位为纯空格时只输出单徽章', renderBadges({ my_status: 'ongoing', my_rank: '   ' }).includes('rank-badge'), false);
check('段位为 undefined 时只输出单徽章', renderBadges({ my_status: 'completed' }).includes('rank-badge'), false);

// 4. XSS 防护与特殊字符安全转义
const dangerousRank = '<b> & "test" \'attack\' </b>';
const escapedHtml = renderBadges({ my_status: 'completed', my_rank: dangerousRank });
check('特殊字符被正确转义 (文本内容)', escapedHtml.includes('&lt;b&gt; &amp; &quot;test&quot; &#39;attack&#39; &lt;/b&gt;'), true);
check('特殊字符在 aria-label 中亦被安全转义', escapedHtml.includes('aria-label="段位：&lt;b&gt; &amp; &quot;test&quot; &#39;attack&#39; &lt;/b&gt;"'), true);
check('原始危险 HTML 标签不裸输出', escapedHtml.includes('<b>'), false);

// 5. 单个徽章渲染辅助函数 (renderBadge)
const statusBadgeHtml = renderBadge({ kind: 'status', value: 'perfect' });
check('renderBadge(status) 渲染正确结构', statusBadgeHtml, '<span class="status-badge" data-status="perfect" aria-label="游玩状态：全成就">全成就</span>');

const rankBadgeHtml = renderBadge({ kind: 'rank', value: '线上150级 🚗' });
check('renderBadge(rank) 渲染正确结构', rankBadgeHtml, '<span class="status-badge rank-badge" aria-label="段位：线上150级 🚗">线上150级 🚗</span>');

// 6. 别名一致性
check('renderBadgesHtml 与 renderBadges 严格一致', renderBadgesHtml({ my_status: 'retired', my_rank: '大师' }), renderBadges({ my_status: 'retired', my_rank: '大师' }));

// 7. 转义工具 esc 函数
check('esc 转义全部 5 种敏感字符', esc('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');

console.log(failures === 0 ? `\n✅ 全部通过: ${total} 个检查通过` : `\n❌ 失败: ${failures} / ${total} 个检查未通过`);
process.exit(failures === 0 ? 0 : 1);
