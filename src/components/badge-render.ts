// 徽章展示模板模块 (Status Badge Module, Spec 08)
// 职责: 集中单源渲染游玩状态与段位徽章标记 (Markup)，
// 统一封装 badgesFor 规则调用、词汇文案转换、无障碍语义 (aria-label) 与 XSS 转义。
// 供画廊卡片、桌面 TOC、移动端 TOC (通过 StatusBadges.astro) 以及气泡面板 (bubble-render.ts) 共同消费。

import { statusText } from '../lib/play-status.ts';
import { badgesFor, type Badge, type MergedGame } from '../lib/steam-data.ts';

export type BadgeGameInput = Pick<MergedGame, 'my_status'> & {
  my_rank?: string;
};

/** HTML 转义: 服务端渲染阶段防止 XSS */
export function esc(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * 渲染单个徽章的标准 HTML 标记
 */
export function renderBadge(badge: Badge): string {
  if (badge.kind === 'status') {
    const label = statusText(badge.value);
    return `<span class="status-badge" data-status="${esc(badge.value)}" aria-label="游玩状态：${esc(label)}">${esc(label)}</span>`;
  }
  return `<span class="status-badge rank-badge" aria-label="段位：${esc(badge.value)}">${esc(badge.value)}</span>`;
}

/**
 * 渲染指定游戏的全部徽章 HTML 标记
 * 内部自动调用领域 rules badgesFor(game) 并结合词汇模块与无障碍标签完成单源结构输出。
 */
export function renderBadges(game: BadgeGameInput): string {
  const badges = badgesFor(game);
  return badges.map(renderBadge).join('');
}

export const renderBadgesHtml = renderBadges;
