import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectMarkdownQuality, hasBrokenBoldSpacing } from '../../src/lib/markdown-quality.ts';

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

console.log('--- 测试 Markdown 排版质量与 TOC 配置门禁 (Ticket 01 & Ticket 03) ---');

check('正常粗体不报错', hasBrokenBoldSpacing('这是 **正常加粗** 与 **第二处** 文本') === false);
check('开标记内侧带空格检出异常', hasBrokenBoldSpacing('这是 ** 失效加粗** 文本') === true);
check('闭标记内侧带空格检出异常', hasBrokenBoldSpacing('这是 **失效加粗 ** 文本') === true);
check('双侧带空格检出异常', hasBrokenBoldSpacing('这是 ** 失效加粗 ** 文本') === true);

const validSample = `---
title: "测试文章"
description: "描述"
pubDate: "2026-08-15"
---

# 开篇引语 Hook

正文第一段 **加粗正常**，行内代码 \`** 忽略空格 **\` 不误报。

\`\`\`bash
# 代码块中的注释不应被当作冗余 H1
echo "** 也不应触发粗体报错 **"
\\- 代码块中的反斜杠连字符也不报错
\`\`\`

## 第一大节

### 1.1 小节
`;

const validViolations = inspectMarkdownQuality(validSample);
check('合规 Markdown 样本零违规 (含代码块 # 注释与行内代码)', validViolations.length === 0);

const invalidSample = `---
title: "违规样本"
---

# 第一个 H1

正文里出现了 ** 空格加粗** 错误。
\\- 遗留的段首转义连字符
**<a\\-传奇难度**：转义笔误

# 第二个多余的 H1
`;

const invalidViolations = inspectMarkdownQuality(invalidSample);
check(
  '检出多余 H1 (redundant-h1)',
  invalidViolations.some((v) => v.kind === 'redundant-h1')
);
check(
  '检出加粗内侧空格 (broken-bold-space)',
  invalidViolations.some((v) => v.kind === 'broken-bold-space')
);
check(
  '检出 **<a\\- 转义笔误 (broken-escape-typo)',
  invalidViolations.some((v) => v.kind === 'broken-escape-typo')
);
check(
  '检出段首 \\- 转义残留 (escaped-hyphen-prefix)',
  invalidViolations.some((v) => v.kind === 'escaped-hyphen-prefix')
);

const astroConfigRaw = readFileSync(resolve(process.cwd(), 'astro.config.mjs'), 'utf-8');
check(
  'astro.config.mjs 中 tableOfContents.minHeadingLevel 已设为 2',
  /tableOfContents:\s*\{\s*minHeadingLevel:\s*2,\s*maxHeadingLevel:\s*4\s*\}/.test(astroConfigRaw)
);

const blogDir = resolve(process.cwd(), 'src/content/docs/blog');
const mdFiles = readdirSync(blogDir).filter((f) => f.endsWith('.md'));

check('blog 目录下存在至少 10 篇 Markdown 博文', mdFiles.length >= 10);

for (const fileName of mdFiles) {
  const fullPath = resolve(blogDir, fileName);
  const content = readFileSync(fullPath, 'utf-8');
  const violations = inspectMarkdownQuality(content, { checkEscapedHyphen: true });
  const detail =
    violations.length > 0
      ? violations.map((v) => `L${v.line} [${v.kind}]: ${v.excerpt}`).join('; ')
      : '';
  check(`真实博文零排版违规: ${fileName}`, violations.length === 0, detail);
}

console.log(
  failures === 0
    ? `\n✅ 全部通过: ${total} 个检查通过`
    : `\n❌ 失败: ${failures} / ${total} 个检查未通过`
);
process.exit(failures === 0 ? 0 : 1);
