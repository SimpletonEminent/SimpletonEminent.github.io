import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isLeafLinkGroup,
  extractLeafGroups,
  resolveSectionalPagination,
  normalizeRoutePath,
  type SidebarNode,
  type SidebarLinkItem,
} from '../../src/lib/pagination-isolation.ts';

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

console.log('--- 测试博客双栏目上下篇翻页隔离与门户页无分页覆盖 (Ticket 04 / ADR-0015) ---');

function link(label: string, href: string, isCurrent = false): SidebarLinkItem {
  return { type: 'link', label, href, isCurrent };
}

const mockSidebar: SidebarNode[] = [
  link('🏠 首页', '/'),
  link('🎮 游戏画廊', '/games/'),
  {
    type: 'group',
    label: '📝 博客',
    entries: [
      link('📑 文章总览', '/blog/'),
      {
        type: 'group',
        label: '技术与生活',
        entries: [
          link('Steam指南写作推荐', '/blog/steam指南写作推荐/'),
          link('如何安装MSST音乐音源分离工作流', '/blog/如何安装msst音乐音源分离工作流/'),
          link('如何优雅地构建个人博客网站', '/blog/如何通过github-pages和astro构建个人博客/'),
          link('微PE安装Win11白屏解决', '/blog/微pe安装win11卡在等待清理完成白屏报错解决/'),
        ],
      },
      {
        type: 'group',
        label: '游戏评测',
        entries: [
          link('DJMAX RESPECT V', '/blog/djmax_review/'),
          link('天国：拯救2', '/blog/kcd2_review/'),
          link('逆转裁判123', '/blog/phoenix_wright_ace_attorney_trilogy_review/'),
          link('闪避刺客', '/blog/sanabi_review/'),
          link('只狼：影逝二度', '/blog/sekiro_review/'),
          link('桌游模拟器', '/blog/tts_review/'),
        ],
      },
    ],
  },
  link('👤 关于我', '/about/'),
];

const leafGroups = extractLeafGroups(mockSidebar);
check('仅提取出 2 个叶子嵌套子组 (技术与生活、游戏评测)', leafGroups.length === 2);
check('第 1 个叶子子组为 技术与生活 (4 篇)', leafGroups[0]?.label === '技术与生活' && leafGroups[0]?.links.length === 4);
check('第 2 个叶子子组为 游戏评测 (6 篇)', leafGroups[1]?.label === '游戏评测' && leafGroups[1]?.links.length === 6);

const blogContainerGroup = mockSidebar[2];
if (blogContainerGroup.type === 'group') {
  check('包含子分组的父容器「📝 博客」不被判定为叶子子组', isLeafLinkGroup(blogContainerGroup) === false);
}

// 1. 门户与单页不渲染翻页
for (const portalPath of ['/', '/games', '/games/', '/blog', '/blog/', '/about', '/about/']) {
  const res = resolveSectionalPagination(mockSidebar, portalPath);
  check(
    `门户/顶层单页 "${portalPath}" prev 与 next 均为 undefined`,
    res.prev === undefined && res.next === undefined
  );
}

// 2. 「技术与生活」栏目内部翻页与边界隔离
const techFirst = resolveSectionalPagination(mockSidebar, '/blog/steam指南写作推荐/');
check('技术与生活首篇: prev 为 undefined (不串流到 /blog/)', techFirst.prev === undefined);
check(
  '技术与生活首篇: next 指向同组第 2 篇',
  techFirst.next?.href === '/blog/如何安装msst音乐音源分离工作流/'
);

const techMiddle = resolveSectionalPagination(
  mockSidebar,
  encodeURI('/blog/如何通过github-pages和astro构建个人博客/')
);
check(
  '技术与生活中篇 (支持 URI 编码中文路径): prev 指向同组上一篇',
  techMiddle.prev?.href === '/blog/如何安装msst音乐音源分离工作流/'
);
check(
  '技术与生活中篇: next 指向同组下一篇',
  techMiddle.next?.href === '/blog/微pe安装win11卡在等待清理完成白屏报错解决/'
);

const techLast = resolveSectionalPagination(
  mockSidebar,
  '/blog/微pe安装win11卡在等待清理完成白屏报错解决'
);
check(
  '技术与生活末篇: prev 指向同组倒数第 2 篇',
  techLast.prev?.href === '/blog/如何通过github-pages和astro构建个人博客/'
);
check(
  '技术与生活末篇: next 严格为 undefined (绝不串流进游戏评测首篇 djmax_review)',
  techLast.next === undefined
);

// 3. 「游戏评测」栏目内部翻页与边界隔离
const reviewFirst = resolveSectionalPagination(mockSidebar, '/blog/djmax_review/');
check(
  '游戏评测首篇 (djmax_review): prev 严格为 undefined (绝不串流进技术与生活末篇)',
  reviewFirst.prev === undefined
);
check('游戏评测首篇: next 指向 kcd2_review', reviewFirst.next?.href === '/blog/kcd2_review/');

const reviewMiddle = resolveSectionalPagination(mockSidebar, '/blog/sekiro_review/');
check('游戏评测中篇 (sekiro): prev 指向 sanabi_review', reviewMiddle.prev?.href === '/blog/sanabi_review/');
check('游戏评测中篇 (sekiro): next 指向 tts_review', reviewMiddle.next?.href === '/blog/tts_review/');

const reviewLast = resolveSectionalPagination(mockSidebar, '/blog/tts_review/');
check('游戏评测末篇 (tts_review): prev 指向 sekiro_review', reviewLast.prev?.href === '/blog/sekiro_review/');
check(
  '游戏评测末篇 (tts_review): next 严格为 undefined (绝不串流进 /about)',
  reviewLast.next === undefined
);

// 4. normalizeRoutePath 规范化验证
check('normalizeRoutePath 忽略尾随斜杠差异', normalizeRoutePath('/games/') === normalizeRoutePath('/games'));
check('normalizeRoutePath 根路径保持为 /', normalizeRoutePath('/') === '/');

// 5. 组件与配置契约检查
const paginationCompPath = resolve(process.cwd(), 'src/components/Pagination.astro');
check('src/components/Pagination.astro 组件文件存在', existsSync(paginationCompPath));

const paginationCompRaw = readFileSync(paginationCompPath, 'utf-8');
check(
  'Pagination.astro 导入 resolveSectionalPagination 纯函数',
  paginationCompRaw.includes('resolveSectionalPagination')
);
check(
  'Pagination.astro 复用 Starlight DefaultPagination',
  paginationCompRaw.includes('@astrojs/starlight/components/Pagination.astro')
);

const astroConfigRaw = readFileSync(resolve(process.cwd(), 'astro.config.mjs'), 'utf-8');
check(
  'astro.config.mjs 已注册 Pagination 组件覆盖',
  astroConfigRaw.includes("Pagination: './src/components/Pagination.astro'")
);

console.log(
  failures === 0
    ? `\n✅ 全部通过: ${total} 个检查通过`
    : `\n❌ 失败: ${failures} / ${total} 个检查未通过`
);
process.exit(failures === 0 ? 0 : 1);
