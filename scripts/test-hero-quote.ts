// 回归测试: 首页语录领域解析与随机算法模块 (test-hero-quote.ts, Spec 14 / ADR-0014)
// 契约验证:
// 1. 数据校验与安全回退 (validateQuotes / loadQuotes)
// 2. 真实生产环境语录数据源完整性 (src/data/quotes.json)
// 3. 纯函数防重随机选择算法 (pickRandomQuote)
// 4. 文献出处格式化 (formatCitation)
// 5. HTML 安全转义与渲染 (escapeHtml / renderQuoteHtml)
// 运行命令: node --experimental-strip-types scripts/test-hero-quote.ts

import {
  DEFAULT_FALLBACK_QUOTE,
  validateQuotes,
  loadQuotes,
  pickRandomQuote,
  formatCitation,
  escapeHtml,
  renderQuoteHtml,
  type QuoteItem,
} from '../src/lib/hero-quote.ts';

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
    console.error('FAIL', label, '\n  actual:  ', a, '\n  expected:', e);
  }
}

console.log('--- 测试首页语录解析与随机算法模块 (Hero Quote Resolver) ---');

// 1. 系统基准兜底常量校验
check('DEFAULT_FALLBACK_QUOTE 包含非空正文', typeof DEFAULT_FALLBACK_QUOTE.content === 'string' && DEFAULT_FALLBACK_QUOTE.content.length > 0, true);
check('DEFAULT_FALLBACK_QUOTE 来源默认为空', DEFAULT_FALLBACK_QUOTE.source, undefined);

// 2. validateQuotes 异常与边界输入防御
check('validateQuotes(null) 安全回退默认语录', validateQuotes(null), [DEFAULT_FALLBACK_QUOTE]);
check('validateQuotes(undefined) 安全回退默认语录', validateQuotes(undefined), [DEFAULT_FALLBACK_QUOTE]);
check('validateQuotes("string") 安全回退默认语录', validateQuotes('string'), [DEFAULT_FALLBACK_QUOTE]);
check('validateQuotes(123) 安全回退默认语录', validateQuotes(123), [DEFAULT_FALLBACK_QUOTE]);
check('validateQuotes({}) 安全回退默认语录', validateQuotes({}), [DEFAULT_FALLBACK_QUOTE]);
check('validateQuotes([]) 安全回退默认语录', validateQuotes([]), [DEFAULT_FALLBACK_QUOTE]);
check('validateQuotes([{}]) 过滤缺少 content 的对象并回退', validateQuotes([{}]), [DEFAULT_FALLBACK_QUOTE]);
check('validateQuotes([{ content: "" }]) 过滤空正文并回退', validateQuotes([{ content: '   ' }]), [DEFAULT_FALLBACK_QUOTE]);

// 3. validateQuotes 合法数据清洗与标准化
const rawData = [
  { content: '  第一句正文  ', source: '  文献出处 A  ' },
  { content: '第二句正文没有出处', source: '' },
  { content: '第三句出处非字符串', source: 12345 },
  { content: '   ' }, // 无效，应被剔除
  null, // 无效，应被剔除
];
const validated = validateQuotes(rawData);
check('validateQuotes 清洗后提取 3 条有效条目', validated.length, 3);
check('第一条正文去除两端空白', validated[0].content, '第一句正文');
check('第一条出处去除两端空白', validated[0].source, '文献出处 A');
check('第二条空出处字段被安全忽略', validated[1].source, undefined);
check('第三条非字符串出处被安全忽略', validated[2].source, undefined);

// 4. loadQuotes 真实文件加载与验证
const realQuotes = loadQuotes();
check('真实环境: loadQuotes 成功加载语录数组', Array.isArray(realQuotes), true);
check('真实环境: 语录数量至少为 3 条', realQuotes.length >= 3, true);
check('真实环境: 第一条为《关于领导方法的若干问题》中心工作', realQuotes[0].content.includes('只能有一个中心工作'), true);
check('真实环境: 第一条出处包含《关于领导方法的若干问题》', realQuotes[0].source?.includes('关于领导方法的若干问题'), true);
check('真实环境: 第二条为《关于领导方法的若干问题》一般号召', realQuotes[1].content.includes('一般号召'), true);
check('真实环境: 第三条包含原版探索技术边界标语', realQuotes[2].content.includes('探索技术边界'), true);

// 5. pickRandomQuote 随机性与非重复契约
const singleList: QuoteItem[] = [{ content: '唯一语录' }];
check('单条语录列表必定返回索引 0', pickRandomQuote(singleList, 0).index, 0);
check('单条语录列表内容匹配', pickRandomQuote(singleList, 0).quote.content, '唯一语录');

const multiList: QuoteItem[] = [
  { content: '语录 0' },
  { content: '语录 1' },
  { content: '语录 2' },
  { content: '语录 3' },
];
// 测试不带 previousIndex 时返回合法范围
const initialPick = pickRandomQuote(multiList);
check('无前序索引时返回合法索引', initialPick.index >= 0 && initialPick.index < 4, true);

// 重点契约: 连续 200 次随机抽取，前序为 1 时，结果绝对不能为 1
let repeatDetected = false;
for (let i = 0; i < 200; i++) {
  const res = pickRandomQuote(multiList, 1);
  if (res.index === 1) {
    repeatDetected = true;
    break;
  }
}
check('多条语录下 200 次抽取严格避开上一次索引 (previousIndex=1)', repeatDetected, false);

// 边界测试: 传入越界的 previousIndex (如 999) 依然安全返回合法索引
const outOfBoundsPick = pickRandomQuote(multiList, 999);
check('越界 previousIndex 依然返回有效索引', outOfBoundsPick.index >= 0 && outOfBoundsPick.index < 4, true);

// 6. formatCitation 文献出处格式化
check('formatCitation(undefined) 返回空串', formatCitation(undefined), '');
check('formatCitation("") 返回空串', formatCitation(''), '');
check('formatCitation("   ") 返回空串', formatCitation('   '), '');
check('未带破折号时自动补齐中文破折号 ——', formatCitation('毛泽东选集'), '——毛泽东选集');
check('自带中文破折号保持原样', formatCitation('——毛泽东选集'), '——毛泽东选集');
check('自带双横线保持原样', formatCitation('--毛泽东选集'), '--毛泽东选集');
check('两端空白自动裁剪', formatCitation('  毛泽东选集  '), '——毛泽东选集');

// 7. escapeHtml 安全转义
check('escapeHtml 普通文本原样保留', escapeHtml('普通文本'), '普通文本');
check('escapeHtml 转义 & 符号', escapeHtml('A&B'), 'A&amp;B');
check('escapeHtml 转义 < 与 > 标签', escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
check('escapeHtml 转义双引号与单引号', escapeHtml('"hello" \'world\''), '&quot;hello&quot; &#039;world&#039;');

// 8. renderQuoteHtml HTML 组装
const simpleQuote: QuoteItem = { content: '单纯的一句话' };
check(
  '无出处语录只渲染 content span',
  renderQuoteHtml(simpleQuote),
  '<span class="hero-quote-content">单纯的一句话</span>'
);

const citedQuote: QuoteItem = { content: '有出处的名言', source: '文献出处' };
check(
  '有出处语录渲染 content span 与 cite 标签',
  renderQuoteHtml(citedQuote),
  '<span class="hero-quote-content">有出处的名言</span> <cite class="hero-quote-source">——文献出处</cite>'
);

const xssQuote: QuoteItem = {
  content: '<img src=x onerror=alert(1)>',
  source: '<b>危险标签</b>',
};
const xssRendered = renderQuoteHtml(xssQuote);
check('XSS 内容在 content 中被完整转义', xssRendered.includes('&lt;img'), true);
check('XSS 内容在 source 中被完整转义', xssRendered.includes('&lt;b&gt;'), true);
check('无裸露的未转义 HTML 注入', xssRendered.includes('<img') || xssRendered.includes('<b>'), false);

console.log(`\n测试汇总: 全部 ${total} 个检查, 失败 ${failures} 个`);
if (failures > 0) {
  console.error(`❌ 测试未通过，存在 ${failures} 处断言失败`);
  process.exit(1);
} else {
  console.log('✅ 全部通过: 首页语录解析与随机算法模块契约测试完美通过');
}
