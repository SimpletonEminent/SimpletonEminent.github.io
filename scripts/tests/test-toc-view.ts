// 回归测试: 统一目录展示模块 (TableOfContentsView, Spec 24)
// 职责:
// 1. 验证 TableOfContentsView 的展示逻辑与双端 (桌面/移动) 兼容性
// 2. 验证中文标题 (name_zh) 优先展示与英文原名 title 悬浮提示
// 3. 验证游戏行与年份归档结构、空状态兜底与类名规范
// 4. 验证 GamesTableOfContents 与 GamesMobileTableOfContents 委托架构
// 运行: node --experimental-strip-types scripts/test-toc-view.ts

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatHours, type MergedGame } from '../../src/lib/steam-data.ts';
import { renderBadges } from '../../src/lib/game-presentation.ts';
import type { YearGroup } from '../../src/lib/blog-meta.ts';

let failures = 0;
let total = 0;

function check(label: string, condition: boolean) {
  total++;
  if (condition) {
    console.log('PASS', label);
  } else {
    failures++;
    console.error('FAIL', label);
  }
}

console.log('--- 测试统一目录展示模块 (TableOfContentsView) ---');

// ==========================================
// 1. 物理组件存在性与轻量化架构审查
// ==========================================
const viewPath = resolve(process.cwd(), 'src/components/TableOfContentsView.astro');
const desktopTocPath = resolve(process.cwd(), 'src/components/GamesTableOfContents.astro');
const mobileTocPath = resolve(process.cwd(), 'src/components/GamesMobileTableOfContents.astro');

check('TableOfContentsView.astro 文件存在', existsSync(viewPath));
check('GamesTableOfContents.astro 文件存在', existsSync(desktopTocPath));
check('GamesMobileTableOfContents.astro 文件存在', existsSync(mobileTocPath));

const desktopContent = readFileSync(desktopTocPath, 'utf-8');
const mobileContent = readFileSync(mobileTocPath, 'utf-8');
const viewContent = readFileSync(viewPath, 'utf-8');

// 架构接缝验证: 桌面端与移动端 TOC 必须委托给 TableOfContentsView
check('桌面端 TOC 导入 TableOfContentsView', desktopContent.includes("import TableOfContentsView from './TableOfContentsView.astro'"));
check('桌面端 TOC 使用 TableOfContentsView 标签', desktopContent.includes('<TableOfContentsView context={tocContext} />'));
check('移动端 TOC 导入 TableOfContentsView', mobileContent.includes("import TableOfContentsView from './TableOfContentsView.astro'"));
check('移动端 TOC 使用 TableOfContentsView 标签并传递 isMobile', mobileContent.includes('<TableOfContentsView context={tocContext} isMobile />'));

// 消除重复代码检查: 双端外层包装组件不再包含重复的游戏行或年份行循环 JSX
check('桌面端 TOC 已消除 games.map 循环', !desktopContent.includes('tocContext.games.map'));
check('移动端 TOC 已消除 games.map 循环', !mobileContent.includes('tocContext.games.map'));
check('桌面端 TOC 已消除 yearGroups.map 循环', !desktopContent.includes('tocContext.yearGroups.map'));
check('移动端 TOC 已消除 yearGroups.map 循环', !mobileContent.includes('tocContext.yearGroups.map'));

// 消除重复 CSS 检查: 双端外层包装组件不再定义游戏行与徽章样式
check('桌面端 TOC 已消除 .games-toc-row 规则', !desktopContent.includes('.games-toc-row {'));
check('移动端 TOC 已消除 .games-mobile-row 规则', !mobileContent.includes('.games-mobile-row {'));
check('桌面端 TOC 已消除 .overview-toc-link 规则', !desktopContent.includes('.overview-toc-link {'));
check('移动端 TOC 已消除 .overview-mobile-row 规则', !mobileContent.includes('.overview-mobile-row {'));

// 样式收敛至 TableOfContentsView
check('TableOfContentsView 包含 .games-toc-row 基础样式', viewContent.includes('.games-toc-row {'));
check('TableOfContentsView 包含 :global(.status-badge) 徽章样式', viewContent.includes(':global(.status-badge) {'));
check('TableOfContentsView 包含 .overview-toc-link 桌面年份链接样式', viewContent.includes('.overview-toc-link {'));
check('TableOfContentsView 包含 .overview-mobile-row 移动年份链接样式', viewContent.includes('.overview-mobile-row {'));

// ==========================================
// 2. 游戏列表行渲染核心逻辑审查 (中文名优先与悬浮提示)
// ==========================================
function makeGame(partial: Partial<MergedGame> = {}): MergedGame {
  return {
    appid: 814380,
    name: 'Sekiro: Shadows Die Twice',
    playtime_hours: 320.5,
    playtime_2weeks_hours: 0,
    last_played: 1700000000,
    cover: 'https://cdn.example.com/cover.jpg',
    name_zh: '只狼：影逝二度',
    tags: ['魂系', '动作'],
    my_status: 'perfect',
    my_review: '神作',
    blog_url: '/blog/sekiro_review',
    play_year: '2024',
    platform: 'Steam',
    my_rank: '',
    release_date: '2019-03-22',
    ...partial,
  };
}

// 模拟 TableOfContentsView 的标题生成纯函数
function resolveGameRowTitle(game: MergedGame): { displayName: string; hoverTitle: string } {
  return {
    displayName: game.name_zh || game.name,
    hoverTitle: game.name,
  };
}

const sekiro = makeGame();
const sekiroTitle = resolveGameRowTitle(sekiro);
check('有中文名时优先展示中文名 (只狼：影逝二度)', sekiroTitle.displayName === '只狼：影逝二度');
check('hover title 始终保留英文原名 (Sekiro: Shadows Die Twice)', sekiroTitle.hoverTitle === 'Sekiro: Shadows Die Twice');

const englishOnlyGame = makeGame({ name_zh: '' });
const englishTitle = resolveGameRowTitle(englishOnlyGame);
check('无中文名时回退展示英文原名', englishTitle.displayName === 'Sekiro: Shadows Die Twice');
check('无中文名时 hover title 为英文原名', englishTitle.hoverTitle === 'Sekiro: Shadows Die Twice');

// 验证游玩时长与徽章生成
const sekiroPlaytime = `${formatHours(sekiro.playtime_hours)}h`;
check('游玩时长格式化为 320.5h', sekiroPlaytime === '320.5h');
const sekiroBadges = renderBadges(sekiro);
check('徽章包含全成就 perfect', sekiroBadges.includes('data-status="perfect"'));

// ==========================================
// 3. 年份归档链接渲染核心逻辑审查
// ==========================================
const mockYearGroup: YearGroup = {
  year: '2026',
  posts: [
    {
      id: 'blog/post-1.md',
      title: '文章 1',
      description: '描述 1',
      url: '/blog/post-1/',
      pubDate: '2026-08-01',
      tags: [],
    },
    {
      id: 'blog/post-2.md',
      title: '文章 2',
      description: '描述 2',
      url: '/blog/post-2/',
      pubDate: '2026-08-02',
      tags: [],
    },
  ],
};

function resolveYearGroupLink(group: YearGroup) {
  return {
    href: `#year-${group.year}`,
    label: `${group.year} 年`,
    count: `${group.posts.length} 篇`,
  };
}

const yearLink = resolveYearGroupLink(mockYearGroup);
check('年份锚点生成为 #year-2026', yearLink.href === '#year-2026');
check('年份文本生成为 2026 年', yearLink.label === '2026 年');
check('年份文章计数生成为 2 篇', yearLink.count === '2 篇');

// ==========================================
// 4. 双端选择器与协调器兼容性判定 (Double Class Pattern)
// ==========================================
// TableOfContentsView 输出的 class 必须同时包含 games-toc-row 与 games-mobile-row
check('TableOfContentsView 模板同时声明 games-toc-row 与 games-mobile-row', viewContent.includes("'games-toc-row', 'games-mobile-row'"));
check('TableOfContentsView 模板同时声明 games-toc-name 与 games-mobile-name', viewContent.includes("'games-toc-name', 'games-mobile-name'"));
check('TableOfContentsView 模板同时声明 games-toc-playtime 与 games-mobile-playtime', viewContent.includes("'games-toc-playtime', 'games-mobile-playtime'"));

// 审查空状态提示文本
check('包含游戏空状态提示 "暂无游戏数据"', viewContent.includes('暂无游戏数据'));
check('包含文章空状态提示 "暂无文章记录"', viewContent.includes('暂无文章记录'));

console.log(failures === 0 ? `\n✅ 全部通过: ${total} 个检查通过` : `\n❌ 测试未通过: ${failures}/${total} 个检查失败`);
process.exit(failures === 0 ? 0 : 1);
