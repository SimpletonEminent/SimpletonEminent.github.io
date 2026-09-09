// 气泡渲染模板模块 (Spec 01 / Spec 06)
// 职责: 构建期服务端渲染卡片点击展开的详情气泡 (.bubble-content) HTML 字符串。
// 从数据模块中剥离，交回组件呈现层维护，使数据仓库接口完全脱离 HTML 语法细节。

import { renderBadges } from './badge-render.ts';
import {
  formatHours,
  releaseYear,
  firstPlayDate,
  type MergedGame,
} from '../lib/steam-data.ts';

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
 * 气泡内部 HTML 内容(构建期服务端渲染,唯一入口)。
 * 输入 MergedGame,输出 .bubble-content 内的 HTML 字符串。
 * 各行的有无由数据决定(有数据才输出,空行自动消失);
 * 徽章与卡片同源(badgesFor),标签在服务端转义(esc)。
 */
export function renderBubbleContent(game: MergedGame): string {
  let html = '';

  // Row 1 游戏名称:EN + CN 并列
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">游戏名称</span>';
  html += '<span class="bubble-value">';
  html += esc(game.name);
  if (game.name_zh) {
    html += `<span class="bubble-name-zh">${esc(game.name_zh)}</span>`;
  }
  html += '</span></div>';

  // Row 2 游戏类型:标签胶囊,无标签时整行隐藏
  if (Array.isArray(game.tags) && game.tags.length > 0) {
    html += '<div class="bubble-row">';
    html += '<span class="bubble-label">游戏类型</span>';
    html += '<span class="bubble-value bubble-tags">';
    html += game.tags.map((tag) => `<span class="tag-pill">${esc(tag)}</span>`).join('');
    html += '</span></div>';
  }

  // Row 3 游玩状态:统一由徽章展示模板单源渲染 (Spec 08)
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">游玩状态</span>';
  html += `<span class="bubble-value">${renderBadges(game)}</span>`;
  html += '</div>';

  // Row 4 数据详情
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">数据详情</span>';
  html += '<span class="bubble-value">';
  html += `<strong>总游玩 ${formatHours(game.playtime_hours)} 小时</strong>`;
  html += '<span class="bubble-sep">·</span>';
  html += `近两周 ${formatHours(game.playtime_2weeks_hours)} 小时`;
  html += '</span></div>';

  // Row 5 成就进度:无成就系统(achievements 为 undefined)或总数为 0 时整行隐藏
  if (game.achievements && game.achievements.total > 0) {
    const { unlocked, total } = game.achievements;
    const percent = Math.round((unlocked / total) * 100);
    const trophy = percent === 100 ? ' 🏆' : '';
    html += '<div class="bubble-row">';
    html += '<span class="bubble-label">成就进度</span>';
    html += '<span class="bubble-value">';
    html += '<span class="achievement-wrap">';
    html += `<span class="achievement-bar"><span class="achievement-fill" style="width:${esc(percent)}%"></span></span>`;
    html += `<span class="achievement-text">${esc(percent)}% (${esc(unlocked)}/${esc(total)})${trophy}</span>`;
    html += '</span></span>';
    html += '</div>';
  }

  // Row 6 我的短评
  html += '<div class="bubble-row">';
  html += '<span class="bubble-label">我的短评</span>';
  if (game.my_review) {
    html += `<span class="bubble-value">${esc(game.my_review)}</span>`;
  } else {
    html += '<span class="bubble-value bubble-empty">暂无短评</span>';
  }
  html += '</div>';

  // Row 深度评测:blog_url 为空时整行隐藏
  if (game.blog_url) {
    html += '<div class="bubble-row">';
    html += '<span class="bubble-label">深度评测</span>';
    html += '<span class="bubble-value">';
    html += `<a class="bubble-link" href="${esc(game.blog_url)}">📄 查看我的深度评测</a>`;
    html += '</span></div>';
  }

  // 底部:Steam 商店入口 + 元数据(发售年份/首次游玩(估)/游玩年份/平台)
  html += '<div class="bubble-footer">';
  html += `<a class="store-link" href="https://store.steampowered.com/app/${game.appid}" target="_blank" rel="noopener noreferrer">前往 Steam 商店 ↗</a>`;
  const meta: string[] = [];
  const rYear = releaseYear(game.release_date);
  if (rYear) meta.push(`发售年份: ${rYear}`);
  // 首次游玩(估):来自成就 API 最早解锁时间(ADR-0008),无成就数据时不显示
  if (game.first_achievement_at) meta.push(`首次游玩(估): ${firstPlayDate(game.first_achievement_at)}`);
  if (game.play_year) meta.push(`游玩年份: ${esc(game.play_year)}`);
  if (game.platform) meta.push(`平台: ${esc(game.platform)}`);
  if (meta.length > 0) {
    html += `<p class="bubble-meta">${meta.join(' · ')}</p>`;
  }
  html += '</div>';

  return html;
}
