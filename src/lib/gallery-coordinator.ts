// 客户端画廊交互协调器(深度协调器模块,Spec 05 / Issue #5)
//
// 本模块全面接管游戏画廊(Gallery)卡片气泡展开、选中高亮双向联动、
// 外部点击关闭以及卡片网格与两重视口 Overview 列表(桌面端 / 移动端)的三处 DOM 排序重排。
//
// 架构优势:
// 1. 消除原先散落在 3 个 Astro 组件内的 window CustomEvents(steam:select, steam:highlight, steam:sort)。
// 2. 消除 SteamGallery 中通过 closest('[data-games-toc]') 窥探侧边栏私有选择器的接缝泄漏。
// 3. 补全移动端 Overview 列表在画廊排序切换时的 DOM 重排同步(修复原有不同步缺陷)。
// 4. 组件模板完全退化为纯静态声明式结构,交互与状态集中在单一深模块。

export interface SortPresets {
  [key: string]: number[];
}

export interface GalleryCoordinatorOptions {
  /** 游戏画廊根容器(.steam-gallery) */
  gallery?: HTMLElement | null;
  /** 桌面端 Overview 列表根容器([data-games-toc]) */
  desktopToc?: HTMLElement | null;
  /** 移动端 Overview 列表根容器([data-games-mobile-toc]) */
  mobileToc?: HTMLElement | null;
  /** 预计算的排序映射(若不传则从 gallery 的 data-sort-presets 属性读取) */
  sortPresets?: SortPresets;
  /** 是否偏好减少动画(测试可注入,默认从 window.matchMedia 读取) */
  isReducedMotion?: () => boolean;
  /** 获取当前 Hash 的函数(测试可注入,默认读取 window.location.hash) */
  getCurrentHash?: () => string;
}

export interface GalleryCoordinator {
  /** 当前选中的游戏 appid,null 表示未展开任何气泡 */
  readonly activeAppid: number | null;
  /** 当前激活的排序维度键名 */
  readonly currentSortKey: string;
  /** 选中指定 appid 的游戏(展开气泡并联动高亮双端列表) */
  selectGame(appid: number, options?: { scrollIntoView?: boolean }): void;
  /** 收起当前展开项并清除高亮 */
  closeActive(): void;
  /** 按指定维度重排画廊网格、桌面列表及移动端列表 */
  sortBy(key: string): void;
  /** 销毁监听器与定时器,释放资源 */
  destroy(): void;
}

function isHtmlElement(node: unknown): node is HTMLElement {
  return typeof HTMLElement !== 'undefined'
    ? node instanceof HTMLElement
    : Boolean(node && typeof node === 'object' && 'tagName' in node);
}

const COORDINATOR_INSTANCE_KEY = '__galleryCoordinatorInstance';

/**
 * 初始化客户端画廊协调器。
 * 单例保证:同一画廊容器多次调用幂等返回已有实例。
 */
export function initGalleryCoordinator(options?: GalleryCoordinatorOptions): GalleryCoordinator | null {
  const gallery = options?.gallery ?? (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.steam-gallery') : null);
  if (!gallery) return null;
  const galleryEl = gallery;

  // 幂等守卫:若已经初始化过,直接复用实例
  const existing = (galleryEl as unknown as Record<string, unknown>)[COORDINATOR_INSTANCE_KEY] as GalleryCoordinator | undefined;
  if (existing) return existing;

  const desktopToc = options?.desktopToc ?? (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-games-toc]') : null);
  const mobileToc = options?.mobileToc ?? (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-games-mobile-toc]') : null);

  // 解析排序预设
  let sortPresets: SortPresets = options?.sortPresets ?? {};
  if (Object.keys(sortPresets).length === 0 && galleryEl.dataset.sortPresets) {
    try {
      sortPresets = JSON.parse(galleryEl.dataset.sortPresets) as SortPresets;
    } catch {
      sortPresets = {};
    }
  }

  const isReducedMotion = options?.isReducedMotion ?? (() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // 索引 DOM 节点,消除各组件维护的独立 Map
  const cardItemByAppid = new Map<number, HTMLElement>();
  const desktopRowByAppid = new Map<number, HTMLElement>();
  const mobileRowByAppid = new Map<number, HTMLElement>();

  const cardItems = Array.from(galleryEl.querySelectorAll<HTMLElement>('.card-item'));
  for (const item of cardItems) {
    const id = Number(item.dataset.appid);
    if (!isNaN(id)) cardItemByAppid.set(id, item);
  }

  if (desktopToc) {
    const rows = Array.from(desktopToc.querySelectorAll<HTMLElement>('.games-toc-row'));
    for (const row of rows) {
      const id = Number(row.dataset.appid);
      if (!isNaN(id)) desktopRowByAppid.set(id, row);
    }
  }

  if (mobileToc) {
    const rows = Array.from(mobileToc.querySelectorAll<HTMLElement>('.games-mobile-row'));
    for (const row of rows) {
      const id = Number(row.dataset.appid);
      if (!isNaN(id)) mobileRowByAppid.set(id, row);
    }
  }

  // 状态维护(唯一事实来源)
  let activeAppid: number | null = null;
  const sortSelect = galleryEl.querySelector<HTMLSelectElement>('.sort-select');
  let currentSortKey = sortSelect?.value || 'recent';
  const closeTimers = new WeakMap<HTMLElement, number>();

  function positionBubble(item: HTMLElement) {
    const bubble = item.querySelector<HTMLElement>('.bubble');
    if (!bubble) return;
    bubble.style.top = `${item.offsetTop + item.offsetHeight + 8}px`;
  }

  function openBubble(item: HTMLElement) {
    const bubble = item.querySelector<HTMLElement>('.bubble');
    const card = item.querySelector<HTMLElement>('.card');
    if (!bubble || !card) return;

    const pending = closeTimers.get(item);
    if (pending !== undefined && typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
      window.clearTimeout(pending);
      closeTimers.delete(item);
    }

    bubble.hidden = false;
    positionBubble(item);
    // 强制回流以保证 0fr 到 1fr 动画触发
    void bubble.offsetHeight;
    item.classList.add('expanded');
    card.setAttribute('aria-expanded', 'true');
  }

  function closeBubble(item: HTMLElement) {
    const bubble = item.querySelector<HTMLElement>('.bubble');
    const card = item.querySelector<HTMLElement>('.card');
    if (!bubble || !card) return;

    item.classList.remove('expanded');
    card.setAttribute('aria-expanded', 'false');

    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      const timer = window.setTimeout(() => {
        if (!item.classList.contains('expanded')) {
          bubble.hidden = true;
        }
        closeTimers.delete(item);
      }, 300);
      closeTimers.set(item, timer as unknown as number);
    } else {
      bubble.hidden = true;
    }
  }

  function setSelected(item: HTMLElement, on: boolean) {
    const card = item.querySelector<HTMLElement>('.card');
    if (card) card.classList.toggle('selected', on);
  }

  function updateHighlights(appid: number | null) {
    for (const [id, row] of desktopRowByAppid) {
      row.classList.toggle('active', id === appid);
    }
    for (const [id, row] of mobileRowByAppid) {
      row.classList.toggle('active', id === appid);
    }
  }

  function closeActive() {
    if (activeAppid === null) return;
    const item = cardItemByAppid.get(activeAppid);
    if (item) {
      closeBubble(item);
      setSelected(item, false);
    }
    activeAppid = null;
    updateHighlights(null);
  }

  function selectGame(appid: number, selectOptions?: { scrollIntoView?: boolean }) {
    if (activeAppid === appid) {
      closeActive();
      return;
    }

    if (activeAppid !== null) {
      const prev = cardItemByAppid.get(activeAppid);
      if (prev) {
        closeBubble(prev);
        setSelected(prev, false);
      }
    }

    const item = cardItemByAppid.get(appid);
    if (!item) return;

    openBubble(item);
    setSelected(item, true);
    activeAppid = appid;
    updateHighlights(appid);

    if (selectOptions?.scrollIntoView && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({
        behavior: isReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }

  function sortBy(key: string) {
    const order = sortPresets[key];
    if (!order || !Array.isArray(order)) return;

    closeActive();

    // 1. 重排画廊网格
    const gridEl = galleryEl.querySelector('.gallery');
    if (gridEl) {
      for (const appid of order) {
        const item = cardItemByAppid.get(appid);
        if (item) gridEl.appendChild(item);
      }
    }

    // 2. 同步重排桌面端 Overview 列表
    if (desktopToc) {
      const desktopList = desktopToc.querySelector('.games-toc-list');
      if (desktopList) {
        for (const appid of order) {
          const row = desktopRowByAppid.get(appid);
          if (row) desktopList.appendChild(row);
        }
      }
    }

    // 3. 同步重排移动端 Overview 列表(修复原生缺失同步的缺陷)
    if (mobileToc) {
      const mobileList = mobileToc.querySelector('.dropdown');
      if (mobileList) {
        for (const appid of order) {
          const row = mobileRowByAppid.get(appid);
          if (row) mobileList.appendChild(row);
        }
      }
    }

    currentSortKey = key;
    if (sortSelect && sortSelect.value !== key) {
      sortSelect.value = key;
    }
  }

  // 事件委托绑定
  const handleGalleryClick = (event: MouseEvent) => {
    const target = event.target;
    if (!isHtmlElement(target)) return;
    const card = target.closest('.card');
    if (!isHtmlElement(card)) return;
    const item = card.closest('.card-item');
    if (!isHtmlElement(item)) return;
    const appid = Number(item.dataset.appid);
    if (!isNaN(appid)) selectGame(appid);
  };
  galleryEl.addEventListener('click', handleGalleryClick);

  const handleSortChange = () => {
    if (sortSelect && sortSelect.value !== currentSortKey) {
      sortBy(sortSelect.value);
    }
  };
  if (sortSelect) {
    sortSelect.addEventListener('change', handleSortChange);
  }

  const handleDesktopTocClick = (event: MouseEvent) => {
    const target = event.target;
    if (!isHtmlElement(target)) return;
    const row = target.closest('.games-toc-row');
    if (!isHtmlElement(row)) return;
    const appid = Number(row.dataset.appid);
    if (!isNaN(appid)) selectGame(appid, { scrollIntoView: true });
  };
  if (desktopToc) {
    desktopToc.addEventListener('click', handleDesktopTocClick);
  }

  const mobileTocEl = mobileToc;
  const handleMobileTocClick = (event: MouseEvent) => {
    const target = event.target;
    if (!isHtmlElement(target)) return;
    const row = target.closest('.games-mobile-row');
    if (!isHtmlElement(row)) return;
    const appid = Number(row.dataset.appid);
    if (!isNaN(appid)) {
      selectGame(appid, { scrollIntoView: true });
      if (mobileTocEl) {
        const details = mobileTocEl.querySelector('details');
        if (details) details.open = false;
      }
    }
  };
  if (mobileTocEl) {
    mobileTocEl.addEventListener('click', handleMobileTocClick);
  }

  // 外部点击关闭判定:利用纳管的容器引用,完全不窥探私有 DOM 选择器
  const handleDocumentClick = (event: MouseEvent) => {
    if (activeAppid === null) return;
    const target = event.target;
    if (!isHtmlElement(target)) return;

    const activeItem = cardItemByAppid.get(activeAppid);
    if (activeItem && activeItem.contains(target)) return;
    if (desktopToc && desktopToc.contains(target)) return;
    if (mobileToc && mobileToc.contains(target)) return;

    closeActive();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleDocumentClick);
  }

  const handleResize = () => {
    if (activeAppid === null) return;
    const item = cardItemByAppid.get(activeAppid);
    if (item) positionBubble(item);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }

  // 向后兼容支持外部全局自定义事件
  const handleSteamSelect = (event: Event) => {
    const customEvent = event as CustomEvent<{ appid?: number }>;
    const appid = customEvent.detail?.appid;
    if (typeof appid === 'number') selectGame(appid, { scrollIntoView: true });
  };
  const handleSteamSort = (event: Event) => {
    const customEvent = event as CustomEvent<{ key?: string }>;
    const key = customEvent.detail?.key;
    if (key) sortBy(key);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('steam:select', handleSteamSelect);
    window.addEventListener('steam:sort', handleSteamSort);
  }

  // Hash 锚点自动展开与监听 (Spec 12 / ADR 0012)
  const getHash = options?.getCurrentHash ?? (() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const handleHash = (hashStr?: string) => {
    const rawHash = typeof hashStr === 'string' ? hashStr : getHash();
    const match = rawHash.match(/^#game-(\d+)$/);
    if (!match) return;
    const appid = Number(match[1]);
    if (!isNaN(appid) && cardItemByAppid.has(appid)) {
      if (activeAppid !== appid) {
        selectGame(appid, { scrollIntoView: true });
      }
    }
  };

  const handleHashChange = () => {
    handleHash();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', handleHashChange);
  }

  // 初始加载时若带有合法的游戏 Hash,立即执行定位与展开
  handleHash();

  const coordinator: GalleryCoordinator = {
    get activeAppid() {
      return activeAppid;
    },
    get currentSortKey() {
      return currentSortKey;
    },
    selectGame,
    closeActive,
    sortBy,
    destroy() {
      gallery.removeEventListener('click', handleGalleryClick);
      if (sortSelect) sortSelect.removeEventListener('change', handleSortChange);
      if (desktopToc) desktopToc.removeEventListener('click', handleDesktopTocClick);
      if (mobileToc) mobileToc.removeEventListener('click', handleMobileTocClick);
      if (typeof document !== 'undefined') {
        document.removeEventListener('click', handleDocumentClick);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('hashchange', handleHashChange);
        window.removeEventListener('steam:select', handleSteamSelect);
        window.removeEventListener('steam:sort', handleSteamSort);
      }
      closeActive();
      delete (gallery as unknown as Record<string, unknown>)[COORDINATOR_INSTANCE_KEY];
    },
  };

  (gallery as unknown as Record<string, unknown>)[COORDINATOR_INSTANCE_KEY] = coordinator;
  return coordinator;
}
