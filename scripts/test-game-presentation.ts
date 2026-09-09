// 回归测试: 游戏卡片呈现管线统一模块 (Game Presentation Pipeline, Spec 15)
// 职责: 统一黑盒断言单源化安全转义 (esc)、徽章标记结构 (renderBadge, renderBadges) 与气泡面板 HTML (renderBubbleContent)。
// 运行: npm test (node --experimental-strip-types scripts/test-game-presentation.ts)

import {
  esc,
  renderBadge,
  renderBadges,
  renderBadgesHtml,
  renderBubbleContent,
  type BadgeGameInput,
} from '../src/components/game-presentation.ts';
import { statusKeys, statusText } from '../src/lib/play-status.ts';
import type { MergedGame } from '../src/lib/steam-data.ts';

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

console.log('--- 测试游戏卡片呈现管线模块 (Game Presentation Pipeline) ---');

// ==========================================
// 1. 单源化 HTML 安全转义 (esc)
// ==========================================
check('esc: 全部 5 种敏感字符完整转义', esc('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
check('esc: 包含数字及普通字符串正常处理', esc('Player1 & 123'), 'Player1 &amp; 123');
check('esc: 处理 null 或 undefined 安全转换为字符串', esc(null), 'null');

// ==========================================
// 2. 徽章呈现规范 (六阶梯状态与段位)
// ==========================================
const ALL_STATUSES = statusKeys();

for (const status of ALL_STATUSES) {
  const label = statusText(status);
  const game: BadgeGameInput = { my_status: status };
  const html = renderBadges(game);

  check(`Badge/${status}: 包含 status-badge`, html.includes('class="status-badge"'), true);
  check(`Badge/${status}: 包含 data-status="${status}"`, html.includes(`data-status="${status}"`), true);
  check(`Badge/${status}: 文本 "${label}"`, html.includes(`>${label}</span>`), true);
  check(`Badge/${status}: aria-label="游玩状态：${label}"`, html.includes(`aria-label="游玩状态：${label}"`), true);
  check(`Badge/${status}: 无段位时无 rank-badge`, html.includes('rank-badge'), false);
}

// 有段位追加测试
for (const status of ALL_STATUSES) {
  const label = statusText(status);
  const rank = '璀璨钻石 💎';
  const game: BadgeGameInput = { my_status: status, my_rank: rank };
  const html = renderBadges(game);

  check(`Badge+Rank/${status}: 状态存在`, html.includes(`data-status="${status}"`), true);
  check(`Badge+Rank/${status}: 状态无障碍属性正确`, html.includes(`aria-label="游玩状态：${label}"`), true);
  check(`Badge+Rank/${status}: 段位存在`, html.includes('class="status-badge rank-badge"'), true);
  check(`Badge+Rank/${status}: 段位文本正确`, html.includes(`>${rank}</span>`), true);
  check(`Badge+Rank/${status}: 段位无障碍属性正确`, html.includes(`aria-label="段位：${rank}"`), true);

  const statusIdx = html.indexOf(`data-status="${status}"`);
  const rankIdx = html.indexOf('class="status-badge rank-badge"');
  check(`Badge+Rank/${status}: 状态排在段位前`, statusIdx < rankIdx, true);
}

// 边界防御与特殊字符
check('Badge 防御: 空字符串段位只出单徽章', renderBadges({ my_status: 'ongoing', my_rank: '' }).includes('rank-badge'), false);
check('Badge 防御: 空白字符段位只出单徽章', renderBadges({ my_status: 'ongoing', my_rank: '   ' }).includes('rank-badge'), false);
check('Badge 防御: undefined 段位只出单徽章', renderBadges({ my_status: 'completed' }).includes('rank-badge'), false);

const dangerousRank = '<b> & "test" \'attack\' </b>';
const escapedBadgeHtml = renderBadges({ my_status: 'completed', my_rank: dangerousRank });
check('Badge XSS: 特殊字符内容转义', escapedBadgeHtml.includes('&lt;b&gt; &amp; &quot;test&quot; &#39;attack&#39; &lt;/b&gt;'), true);
check('Badge XSS: aria-label 安全转义', escapedBadgeHtml.includes('aria-label="段位：&lt;b&gt; &amp; &quot;test&quot; &#39;attack&#39; &lt;/b&gt;"'), true);
check('Badge XSS: 原始 HTML 标签不裸输出', escapedBadgeHtml.includes('<b>'), false);

// 单徽章辅助函数及别名
check(
  'renderBadge(status): 单状态徽章结构',
  renderBadge({ kind: 'status', value: 'perfect' }),
  '<span class="status-badge" data-status="perfect" aria-label="游玩状态：全成就">全成就</span>'
);
check(
  'renderBadge(rank): 单段位徽章结构',
  renderBadge({ kind: 'rank', value: '线上150级 🚗' }),
  '<span class="status-badge rank-badge" aria-label="段位：线上150级 🚗">线上150级 🚗</span>'
);
check('renderBadgesHtml 严格别名一致', renderBadgesHtml({ my_status: 'retired' }), renderBadges({ my_status: 'retired' }));

// ==========================================
// 3. 详情气泡呈现规范 (renderBubbleContent)
// ==========================================
function makeGame(partial: Partial<MergedGame> = {}): MergedGame {
  return {
    appid: 101,
    name: 'Sample Game',
    playtime_hours: 25.5,
    playtime_2weeks_hours: 3.2,
    last_played: 1700000000,
    cover: 'https://example.com/cover.jpg',
    name_zh: '',
    tags: [],
    my_status: 'uncompleted',
    my_review: '',
    blog_url: '',
    play_year: '',
    platform: '',
    my_rank: '',
    release_date: '',
    ...partial,
  };
}

// 气泡中徽章单源渲染集成
const bubbleWithRank = renderBubbleContent(makeGame({ my_status: 'ongoing', my_rank: '超凡大师 🏆' }));
check('Bubble 状态行包含 renderBadges 输出', bubbleWithRank.includes('data-status="ongoing"'), true);
check('Bubble 状态行包含 rank-badge', bubbleWithRank.includes('class="status-badge rank-badge"'), true);

// 气泡各行动态条件渲染
const withReview = renderBubbleContent(makeGame({ blog_url: '/blog/sample' }));
check('Bubble: 有长评输出深度评测行', withReview.includes('深度评测') && withReview.includes('bubble-link'), true);
check('Bubble: 无长评深度评测行隐藏', renderBubbleContent(makeGame()).includes('深度评测'), false);

const withTags = renderBubbleContent(makeGame({ tags: ['动作', 'Roguelike'] }));
check('Bubble: 有 tags 输出胶囊', withTags.includes('tag-pill') && withTags.includes('游戏类型'), true);
check('Bubble: 无 tags 游戏类型行隐藏', renderBubbleContent(makeGame()).includes('游戏类型'), false);

const withAch = renderBubbleContent(makeGame({ achievements: { unlocked: 8, total: 10 } }));
check('Bubble: 成就有进度条', withAch.includes('achievement-bar') && withAch.includes('80%'), true);
check('Bubble: 无成就隐藏成就行', renderBubbleContent(makeGame()).includes('成就进度'), false);

const withFirstPlay = renderBubbleContent(makeGame({ first_achievement_at: 1650000000 }));
check('Bubble: 有成就首解输出首次游玩(估)', withFirstPlay.includes('首次游玩(估)'), true);
check('Bubble: 无成就首解不输出首次游玩(估)', renderBubbleContent(makeGame()).includes('首次游玩(估)'), false);

check('Bubble: 短评为空时展示占位', renderBubbleContent(makeGame()).includes('暂无短评'), true);
check('Bubble: 短评有值时展示短评内容', renderBubbleContent(makeGame({ my_review: '精品佳作' })).includes('精品佳作'), true);

// 气泡 XSS 防护验证
const dirtyText = '<script>alert(1)</script> & "bad" \'tag\'';
const dirtyBubble = renderBubbleContent(makeGame({ name: dirtyText, my_review: dirtyText, tags: [dirtyText] }));
check('Bubble XSS: 名称/短评/标签全部安全转义', dirtyBubble.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;bad&quot; &#39;tag&#39;'), true);
check('Bubble XSS: 原始 script 标签不裸输出', dirtyBubble.includes('<script>'), false);

console.log(failures === 0 ? `\n✅ 全部通过: ${total} 个检查通过` : `\n❌ 失败: ${failures} / ${total} 个检查未通过`);
process.exit(failures === 0 ? 0 : 1);
