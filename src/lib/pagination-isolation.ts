// 博客双栏目上下篇翻页隔离纯函数模块 (Ticket 04 / ADR-0015)
// 职责:
// 1. 以侧边栏 (sidebar) 的叶子嵌套子组作为唯一分页隔离边界
// 2. 确保「技术与生活」与「游戏评测」各自在同子组内部顺序寻址，首篇无上一篇、末篇无下一篇，绝不跨组串流
// 3. 确保独立门户与顶层单页 (`/`, `/games`, `/blog/`, `/about`) 底部不产生上下篇翻页链接

export interface SidebarLinkItem {
  type: 'link';
  label: string;
  href: string;
  isCurrent?: boolean;
  badge?: unknown;
  attrs?: Record<string, unknown>;
}

export interface SidebarGroupItem<T extends SidebarLinkItem = SidebarLinkItem> {
  type: 'group';
  label: string;
  entries: Array<SidebarNode<T>>;
  collapsed?: boolean;
  badge?: unknown;
}

export type SidebarNode<T extends SidebarLinkItem = SidebarLinkItem> =
  | T
  | SidebarGroupItem<T>;

export interface LeafSidebarGroup<T extends SidebarLinkItem = SidebarLinkItem> {
  label: string;
  links: T[];
}

export interface PaginationResult<T extends SidebarLinkItem = SidebarLinkItem> {
  prev: T | undefined;
  next: T | undefined;
  groupLabel?: string;
}

/**
 * 规范化路由路径以支持容错匹配:
 * - 解码 URI 百分号编码 (兼容中文 slug 如 `/blog/如何通过github-pages和astro构建个人博客/`)
 * - 统一加前导 `/` 并去除尾部 `/` (根路径 `/` 除外)
 */
export function normalizeRoutePath(pathname: string): string {
  const raw = pathname.trim();
  if (!raw) return '/';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const withLeading = decoded.startsWith('/') ? decoded : `/${decoded}`;
  if (withLeading === '/') return '/';
  return withLeading.replace(/\/+$/, '');
}

/**
 * 判断两个路径是否指向同一路由条目
 */
export function routePathsMatch(pathA: string, pathB: string): boolean {
  return normalizeRoutePath(pathA) === normalizeRoutePath(pathB);
}

/**
 * 判定一个侧边栏分组是否为「叶子文章子组」:
 * 仅当分组非空，且其直接子条目全部为 `type === 'link'`（不包含任何下级 `group`）时返回 true。
 * 例如:
 * - `技术与生活` (全为 link) -> true
 * - `游戏评测` (全为 link) -> true
 * - `📝 博客` (内含 `/blog/` link + 两个子 group) -> false
 */
export function isLeafLinkGroup<T extends SidebarLinkItem>(
  group: SidebarGroupItem<T>
): boolean {
  return (
    Array.isArray(group.entries) &&
    group.entries.length > 0 &&
    group.entries.every((entry) => entry.type === 'link')
  );
}

/**
 * 从完整侧边栏树中提取所有叶子嵌套子组
 * 顶层独立链接 (`/`, `/games`, `/about`) 与非叶子分组下的门户链接 (`/blog/`) 均被自动排除。
 */
export function extractLeafGroups<T extends SidebarLinkItem>(
  sidebar: Array<SidebarNode<T>>
): Array<LeafSidebarGroup<T>> {
  const result: Array<LeafSidebarGroup<T>> = [];

  for (const node of sidebar) {
    if (node.type === 'group') {
      if (isLeafLinkGroup(node)) {
        result.push({
          label: node.label,
          links: node.entries.filter((e): e is T => e.type === 'link'),
        });
      } else {
        result.push(...extractLeafGroups(node.entries));
      }
    }
  }

  return result;
}

/**
 * 基于侧边栏叶子子组解析当前页面的同栏目上下篇翻页链接 (ADR-0015)
 */
export function resolveSectionalPagination<T extends SidebarLinkItem>(
  sidebar: Array<SidebarNode<T>>,
  currentPathname?: string
): PaginationResult<T> {
  if (!Array.isArray(sidebar) || sidebar.length === 0) {
    return { prev: undefined, next: undefined };
  }

  const leafGroups = extractLeafGroups(sidebar);
  const hasPathname = typeof currentPathname === 'string' && currentPathname.trim().length > 0;

  for (const group of leafGroups) {
    const idx = group.links.findIndex((link) => {
      if (hasPathname && routePathsMatch(link.href, currentPathname!)) {
        return true;
      }
      if (!hasPathname && link.isCurrent === true) {
        return true;
      }
      return false;
    });

    // 若提供了 currentPathname 但未命中路径，尝试用 isCurrent 兜底
    const resolvedIdx =
      idx !== -1
        ? idx
        : group.links.findIndex((link) => link.isCurrent === true && (!hasPathname || routePathsMatch(link.href, currentPathname!)));

    if (resolvedIdx !== -1) {
      const prev = resolvedIdx > 0 ? group.links[resolvedIdx - 1] : undefined;
      const next =
        resolvedIdx < group.links.length - 1 ? group.links[resolvedIdx + 1] : undefined;
      return {
        prev,
        next,
        groupLabel: group.label,
      };
    }
  }

  return { prev: undefined, next: undefined };
}
