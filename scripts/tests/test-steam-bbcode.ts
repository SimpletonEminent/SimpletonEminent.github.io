import {
  markdownToSteamBbcode,
  checkSteamReviewLength,
  STEAM_REVIEW_MAX_CHARS,
} from '../../src/lib/steam-bbcode.ts';
import {
  runExportSteamReview,
  listBlogReviewCandidates,
} from '../export-steam-review.ts';

let failures = 0;
let total = 0;

function check(label: string, condition: boolean, detail?: string) {
  total++;
  if (condition) {
    console.log('PASS', label);
  } else {
    failures++;
    console.error('FAIL', label, detail ?? '');
  }
}

console.log('--- 测试 Steam 评测 BBCode 导出器 (Ticket 02 / ADR-0016) ---');

const sampleMd = `---
title: "测试游戏长评"
description: "简介"
pubDate: "2026-08-19"
---

# 开篇引语大标题

---

这是一段包含 **核心卖点** 与 *机制术语* 以及 ~~废案~~ 的正文，附带 [SteamDB 链接](https://steamdb.info/app/814380/)。

## 二级章节

### 三级小节

- 第一条无序列表 **重点**
- 第二条无序列表

1. 第一步有序操作
2. 第二步有序操作

<details><summary>点击查看后果</summary>只能下周目再完成这个支线了</details>

<details><summary>如果你能接受——</summary>本质视觉小说</details>

| 维度 | 评价 |
| --- | --- |
| **价格** | [史低134](https://steamdb.info/) |
| 时长 | 80小时 |
`;

const bbcode = markdownToSteamBbcode(sampleMd);

check('剥离 YAML frontmatter', !bbcode.includes('pubDate:') && !bbcode.includes('title:'));
check('H1 转换为 [h1]...[/h1]', bbcode.includes('[h1]开篇引语大标题[/h1]'));
check('H2 转换为 [h2]...[/h2]', bbcode.includes('[h2]二级章节[/h2]'));
check('H3 转换为 [h3]...[/h3]', bbcode.includes('[h3]三级小节[/h3]'));
check('--- 分隔线转换为 [hr][/hr]', bbcode.includes('[hr][/hr]'));
check('**粗体** 转换为 [b]...[/b]', bbcode.includes('[b]核心卖点[/b]'));
check('*斜体* 转换为 [i]...[/i]', bbcode.includes('[i]机制术语[/i]'));
check('~~删除线~~ 转换为 [strike]...[/strike]', bbcode.includes('[strike]废案[/strike]'));
check(
  '[文本](url) 转换为 [url=url]文本[/url]',
  bbcode.includes('[url=https://steamdb.info/app/814380/]SteamDB 链接[/url]')
);
check(
  '无序列表转换为 [list][*]...[/list]',
  bbcode.includes('[list]\n[*]第一条无序列表 [b]重点[/b]\n[*]第二条无序列表\n[/list]')
);
check(
  '有序列表转换为 [olist][*]...[/olist]',
  bbcode.includes('[olist]\n[*]第一步有序操作\n[*]第二步有序操作\n[/olist]')
);
check(
  '<details> 剧透折叠转换为 提示：[spoiler]内容[/spoiler]',
  bbcode.includes('点击查看后果：[spoiler]只能下周目再完成这个支线了[/spoiler]')
);
check(
  '末尾自带破折号的 <details> summary 不重复追加冒号',
  bbcode.includes('如果你能接受——[spoiler]本质视觉小说[/spoiler]')
);
check(
  'Markdown 管道表格转换为 [table][tr][th][td] 结构',
  bbcode.includes('[table]\n[tr]\n[th]维度[/th]\n[th]评价[/th]\n[/tr]\n[tr]\n[td][b]价格[/b][/td]\n[td][url=https://steamdb.info/]史低134[/url][/td]\n[/tr]\n[tr]\n[td]时长[/td]\n[td]80小时[/td]\n[/tr]\n[/table]')
);

const dashModeBbcode = markdownToSteamBbcode('- 列表项A\n- 列表项B', { listMode: 'dash' });
check('listMode: dash 支持输出段首 - 模式', dashModeBbcode === '- 列表项A\n- 列表项B');

const shortReport = checkSteamReviewLength('简短评测文本');
check('8000 字符上限常量为 8000', STEAM_REVIEW_MAX_CHARS === 8000);
check('未超限文本 isOverLimit 为 false', shortReport.isOverLimit === false);
check('ratioText 格式为 xxxx / 8000', shortReport.ratioText === '6 / 8000');

const exactReport = checkSteamReviewLength('a'.repeat(8000));
check('恰好 8000 字符时 isOverLimit 为 false', exactReport.isOverLimit === false && exactReport.remaining === 0);

const overReport = checkSteamReviewLength('中'.repeat(8005));
check('超出 8000 字符时 isOverLimit 为 true', overReport.isOverLimit === true && overReport.remaining === -5);

const candidates = listBlogReviewCandidates();
check('可扫描出真实博客目录下的评测候选文件', candidates.length >= 6);
check('游戏评测 (_review.md) 优先排列在前', candidates[0]?.isReviewSlug === true);

let clipboardCaptured = '';
const logs: string[] = [];
const exportResult = await runExportSteamReview({
  ask: async () => '1',
  copyToClipboard: (text) => {
    clipboardCaptured = text;
    return true;
  },
  logger: {
    log: (m) => logs.push(m),
    warn: (m) => logs.push(m),
    error: (m) => logs.push(m),
  },
});

check('runExportSteamReview 选择序号 1 成功返回导出结果', exportResult !== null);
check('runExportSteamReview 自动写入剪贴板', clipboardCaptured.length > 0 && exportResult?.copied === true);
check(
  'runExportSteamReview 输出字符占比 xxxx / 8000',
  logs.some((l) => /\d+\s*\/\s*8000/.test(l))
);

const cancelResult = await runExportSteamReview({
  ask: async () => '0',
  copyToClipboard: () => true,
  logger: { log: () => {}, warn: () => {}, error: () => {} },
});
check('runExportSteamReview 输入 0 取消返回 null', cancelResult === null);

console.log(
  failures === 0
    ? `\n✅ 全部通过: ${total} 个检查通过`
    : `\n❌ 失败: ${failures} / ${total} 个检查未通过`
);
process.exit(failures === 0 ? 0 : 1);
