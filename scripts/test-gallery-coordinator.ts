// 回归测试: 画廊客户端协调器 (Spec 05 / Issue #5)
// 验证外部行为: 单开手风琴展开、TOC 双向联动、外部点击关闭、三处 DOM 排序同步与幂等性。
// 运行: npm test
import { initGalleryCoordinator } from '../src/lib/gallery-coordinator.ts';

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

// 轻量级 DOM Mock 节点,支持层次树、事件委托与属性操作
class MockElement {
  tagName: string;
  dataset: Record<string, string> = {};
  _classes: Set<string> = new Set();
  attributes: Map<string, string> = new Map();
  children: MockElement[] = [];
  parentNode: MockElement | null = null;
  listeners: Map<string, ((evt: unknown) => void)[]> = new Map();
  hidden = false;
  style: Record<string, string> = {};
  offsetTop = 100;
  offsetHeight = 200;
  open: boolean = false; // 用于 details 元素
  value: string = '';   // 用于 select 元素

  classList = {
    add: (...tokens: string[]) => tokens.forEach((t) => this._classes.add(t)),
    remove: (...tokens: string[]) => tokens.forEach((t) => this._classes.delete(t)),
    toggle: (token: string, force?: boolean) => {
      if (force === true) {
        this._classes.add(token);
        return true;
      } else if (force === false) {
        this._classes.delete(token);
        return false;
      }
      if (this._classes.has(token)) {
        this._classes.delete(token);
        return false;
      } else {
        this._classes.add(token);
        return true;
      }
    },
    contains: (token: string) => this._classes.has(token),
  };

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: MockElement): MockElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: (evt: unknown) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (evt: unknown) => void) {
    const list = this.listeners.get(type);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  }

  dispatchEvent(evt: { type: string; target?: MockElement }) {
    evt.target = this;
    let curr: MockElement | null = this;
    while (curr) {
      const list = curr.listeners.get(evt.type);
      if (list) {
        for (const listener of list) {
          listener(evt);
        }
      }
      curr = curr.parentNode;
    }
  }

  contains(other: MockElement | null): boolean {
    if (!other) return false;
    let curr: MockElement | null = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  closest(selector: string): MockElement | null {
    let curr: MockElement | null = this;
    while (curr) {
      if (curr.matchesSelector(selector)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  matchesSelector(selector: string): boolean {
    if (selector.startsWith('.')) {
      return this._classes.has(selector.slice(1));
    }
    if (selector === 'details') {
      return this.tagName === 'DETAILS';
    }
    return false;
  }

  querySelector(selector: string): MockElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const walk = (el: MockElement) => {
      for (const child of el.children) {
        if (child.matchesSelector(selector)) {
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  scrollIntoView() {
    // mock no-op
  }
}

// 构建模拟 DOM 树
function createMockFixture() {
  const root = new MockElement('div');

  // 画廊
  const gallery = new MockElement('div');
  gallery.classList.add('steam-gallery');
  root.appendChild(gallery);

  const sortSelect = new MockElement('select');
  sortSelect.classList.add('sort-select');
  sortSelect.value = 'playtime';
  gallery.appendChild(sortSelect);

  const grid = new MockElement('div');
  grid.classList.add('gallery');
  gallery.appendChild(grid);

  // 3 个游戏卡片: 101, 102, 103
  const cardItems: MockElement[] = [];
  for (const appid of [101, 102, 103]) {
    const item = new MockElement('div');
    item.classList.add('card-item');
    item.dataset.appid = String(appid);

    const card = new MockElement('button');
    card.classList.add('card');
    item.appendChild(card);

    const bubble = new MockElement('div');
    bubble.classList.add('bubble');
    bubble.hidden = true;
    item.appendChild(bubble);

    grid.appendChild(item);
    cardItems.push(item);
  }

  // 桌面 TOC
  const desktopToc = new MockElement('nav');
  desktopToc.classList.add('games-toc');
  root.appendChild(desktopToc);

  const desktopList = new MockElement('div');
  desktopList.classList.add('games-toc-list');
  desktopToc.appendChild(desktopList);

  const desktopRows: MockElement[] = [];
  for (const appid of [101, 102, 103]) {
    const row = new MockElement('button');
    row.classList.add('games-toc-row');
    row.dataset.appid = String(appid);
    desktopList.appendChild(row);
    desktopRows.push(row);
  }

  // 移动端 TOC
  const mobileToc = new MockElement('nav');
  mobileToc.classList.add('games-mobile-toc');
  root.appendChild(mobileToc);

  const details = new MockElement('details');
  details.open = true;
  mobileToc.appendChild(details);

  const dropdown = new MockElement('div');
  dropdown.classList.add('dropdown');
  details.appendChild(dropdown);

  const mobileRows: MockElement[] = [];
  for (const appid of [101, 102, 103]) {
    const row = new MockElement('button');
    row.classList.add('games-mobile-row');
    row.dataset.appid = String(appid);
    dropdown.appendChild(row);
    mobileRows.push(row);
  }

  const sortPresets = {
    playtime: [101, 102, 103],
    recent: [103, 101, 102],
    status: [102, 103, 101],
  };

  return {
    root,
    gallery: gallery as unknown as HTMLElement,
    desktopToc: desktopToc as unknown as HTMLElement,
    mobileToc: mobileToc as unknown as HTMLElement,
    sortSelect,
    grid,
    desktopList,
    dropdown,
    cardItems,
    desktopRows,
    mobileRows,
    sortPresets,
  };
}

// 测试用例开始
console.log('--- 测试画廊客户端协调器 (Gallery Coordinator) ---');

const fixture = createMockFixture();

// 1. 初始化并检查初始状态
const coordinator = initGalleryCoordinator({
  gallery: fixture.gallery,
  desktopToc: fixture.desktopToc,
  mobileToc: fixture.mobileToc,
  sortPresets: fixture.sortPresets,
  isReducedMotion: () => true,
});

check('coordinator 初始化成功', coordinator !== null);
check('初始 activeAppid 为 null', coordinator?.activeAppid === null);
check('初始 currentSortKey 为 playtime', coordinator?.currentSortKey === 'playtime');

// 2. 幂等性检验: 再次初始化返回同一实例
const coordinator2 = initGalleryCoordinator({
  gallery: fixture.gallery,
  desktopToc: fixture.desktopToc,
});
check('多次调用返回相同实例引用 (幂等性)', coordinator === coordinator2);

// 3. 点击卡片选中 101
coordinator?.selectGame(101);
check('选中 101 后 activeAppid 为 101', coordinator?.activeAppid === 101);
check('卡片 101 拥有 expanded 类', fixture.cardItems[0].classList.contains('expanded'));
check('卡片 101 气泡 hidden 为 false', fixture.cardItems[0].querySelector('.bubble')?.hidden === false);
check('桌面 TOC 101 行拥有 active 类', fixture.desktopRows[0].classList.contains('active'));
check('移动 TOC 101 行拥有 active 类', fixture.mobileRows[0].classList.contains('active'));
check('桌面 TOC 102 行没有 active 类', !fixture.desktopRows[1].classList.contains('active'));

// 4. 点击同一卡片收起
coordinator?.selectGame(101);
check('再次点击 101 后 activeAppid 变回 null', coordinator?.activeAppid === null);
check('卡片 101 移除 expanded 类', !fixture.cardItems[0].classList.contains('expanded'));
check('桌面 TOC 101 行失去 active 类', !fixture.desktopRows[0].classList.contains('active'));
check('移动 TOC 101 行失去 active 类', !fixture.mobileRows[0].classList.contains('active'));

// 5. 点击桌面 TOC 切换到 102
coordinator?.selectGame(102);
check('选择 102 后 activeAppid 为 102', coordinator?.activeAppid === 102);
check('卡片 102 拥有 expanded 类', fixture.cardItems[1].classList.contains('expanded'));
check('桌面 TOC 102 拥有 active 类', fixture.desktopRows[1].classList.contains('active'));
check('移动 TOC 102 拥有 active 类', fixture.mobileRows[1].classList.contains('active'));

// 6. 点击移动端列表切换到 103 (模拟详情面板自动收起)
const mobileRow103 = fixture.mobileRows[2];
const detailsEl = fixture.mobileToc.querySelector('details') as unknown as MockElement;
detailsEl.open = true;
mobileRow103.dispatchEvent({ type: 'click' });
check('点击移动端 103 选中成功', coordinator?.activeAppid === 103);
check('移动端 TOC details 展开面板自动收起', (detailsEl.open as boolean) === false);
check('桌面 TOC 103 拥有 active 类', fixture.desktopRows[2].classList.contains('active'));

// 7. 多维排序同步检验 (关键: 验证移动端同步修复)
coordinator?.sortBy('recent'); // recent 顺序: [103, 101, 102]
check('当前排序维度更新为 recent', coordinator?.currentSortKey === 'recent');

const gridChildren = fixture.grid.children.map((c) => Number(c.dataset.appid));
const desktopChildren = fixture.desktopList.children.map((c) => Number(c.dataset.appid));
const mobileChildren = fixture.dropdown.children.map((c) => Number(c.dataset.appid));

check('画廊网格按 recent 重排 [103, 101, 102]', JSON.stringify(gridChildren) === JSON.stringify([103, 101, 102]));
check('桌面 TOC 按 recent 重排 [103, 101, 102]', JSON.stringify(desktopChildren) === JSON.stringify([103, 101, 102]));
check('移动 TOC 同步按 recent 重排 [103, 101, 102] (修复移动端不同步缺陷)', JSON.stringify(mobileChildren) === JSON.stringify([103, 101, 102]));

// 8. 排序后自动清除高亮
check('切换排序后清除活动选中状态', coordinator?.activeAppid === null);
check('桌面 TOC 行不再拥有 active 类', !fixture.desktopRows[2].classList.contains('active'));

// 9. 销毁协调器
coordinator?.destroy();
check('destroy 后内部实例键被清除', ((fixture.gallery as unknown as Record<string, unknown>).__galleryCoordinatorInstance) === undefined);

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
