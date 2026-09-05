// 回归测试:气泡构建期渲染纯函数(renderBubbleContent)
// 规则:给定 MergedGame → 输出气泡内部 HTML;各行有无由数据决定,特殊字符在服务端转义。
// 运行:npm test(node --experimental-strip-types scripts/test-bubble-render.ts)
import { renderBubbleContent, type MergedGame } from '../src/lib/steam-data.ts';

/** 构造测试用 MergedGame:默认全空字段,按需覆盖 */
function makeGame(partial: Partial<MergedGame> = {}): MergedGame {
  return {
    appid: 1,
    name: 'Test Game',
    playtime_hours: 10,
    playtime_2weeks_hours: 2,
    last_played: 0,
    cover: '',
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

// 长评
const withReview = renderBubbleContent(makeGame({ blog_url: '/blog/apex' }));
check('有长评 → 输出深度评测行', withReview.includes('深度评测'), true);
check('有长评 → 输出评测链接', withReview.includes('bubble-link'), true);
check('无长评 → 深度评测行不出现', renderBubbleContent(makeGame()).includes('深度评测'), false);

// 标签
const withTags = renderBubbleContent(makeGame({ tags: ['魂系', 'RPG'] }));
check('有 tags → 输出标签胶囊', withTags.includes('tag-pill'), true);
check('有 tags → 输出游戏类型行', withTags.includes('游戏类型'), true);
check('无 tags → 游戏类型行不出现', renderBubbleContent(makeGame()).includes('游戏类型'), false);

// 成就进度
const withAch = renderBubbleContent(makeGame({ achievements: { unlocked: 5, total: 10 } }));
check('成就 total>0 → 输出进度条', withAch.includes('achievement-bar'), true);
check('成就 total>0 → 输出成就进度行', withAch.includes('成就进度'), true);
check('无成就数据 → 进度条不出现', renderBubbleContent(makeGame()).includes('成就进度'), false);

// 段位
const withRank = renderBubbleContent(makeGame({ my_rank: '璀璨钻石 💎' }));
check('有段位 → 输出双徽章(rank-badge)', withRank.includes('rank-badge'), true);
check('有段位 → 状态徽章仍显示', withRank.includes('data-status='), true);
check('无段位 → 无 rank-badge', renderBubbleContent(makeGame()).includes('rank-badge'), false);

// 短评
check('短评为空 → 暂无短评占位', renderBubbleContent(makeGame()).includes('暂无短评'), true);
check('短评有值 → 无占位', renderBubbleContent(makeGame({ my_review: '很好玩' })).includes('暂无短评'), false);

// 首次游玩(估)
const withFirst = renderBubbleContent(makeGame({ first_achievement_at: 1700000000 }));
check('有首次游玩(估) → 输出该字段', withFirst.includes('首次游玩(估)'), true);
check('无成就数据 → 不输出首次游玩(估)', renderBubbleContent(makeGame()).includes('首次游玩(估)'), false);

// HTML 特殊字符转义(< & > " ')
const msg = '<b> & "q" \'a\' </b>';
const html = renderBubbleContent(makeGame({ name: msg, my_review: msg }));
check('特殊字符被转义', html.includes('&lt;b&gt; &amp; &quot;q&quot; &#39;a&#39; &lt;/b&gt;'), true);
check('原始标签不裸输出', html.includes('<b>'), false);

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
