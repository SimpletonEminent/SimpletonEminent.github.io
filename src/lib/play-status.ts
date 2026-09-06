// 游玩状态六阶梯 —— 唯一词汇模块(领域词汇单一来源,ADR-0007 / Spec 02)
//
// 本模块集中声明六阶梯游玩状态的类型、枚举、中文文案、排序权重,以及
// 中文 ↔ 内部键 的双向映射。所有消费方(UI 组件、CLI 菜单、CSV 适配、测试)
// 只从本模块取值,不再各自重复列出,避免"菜单一个词、存储一个值"的漂移。
//
// 文案与 CONTEXT.md「游玩状态 (Play Status)」词条保持一致:
//   未通关(uncompleted) / 已通关(completed) / 全成就(perfect) /
//   持续游玩(ongoing) / 暂退长草(hiatus) / 已退役(retired)
// 权重(通关进度维度,降序):全成就 6 > 已通关 5 > 持续游玩 4 >
//   未通关 3 > 暂退长草 2 > 已退役 1。
//
// 纯函数接口,不依赖任何组件或文件系统(架构最高缝,便于测试与跨通道复用)。

/** 游玩状态六阶梯联合类型 */
export type Status = 'uncompleted' | 'completed' | 'perfect' | 'ongoing' | 'hiatus' | 'retired';

/** 单条阶梯定义:键 + 中文文案 + 排序权重 */
export interface StatusEntry {
  key: Status;
  /** 中文展示文案(与 CONTEXT.md 一致,不含装饰性 emoji) */
  label: string;
  /** 通关进度排序权重,越大优先级越高 */
  weight: number;
}

/**
 * 六阶梯数组(键 + 中文文案 + 权重)。
 * 数组顺序即 CLI 菜单 / CSV 下拉的展示顺序(未通关 → 已通关 → 全成就 →
 * 持续游玩 → 暂退长草 → 已退役),与历史菜单顺序保持一致。
 */
export const STATUS_LADDER: readonly StatusEntry[] = [
  { key: 'uncompleted', label: '未通关', weight: 3 },
  { key: 'completed', label: '已通关', weight: 5 },
  { key: 'perfect', label: '全成就', weight: 6 },
  { key: 'ongoing', label: '持续游玩', weight: 4 },
  { key: 'hiatus', label: '暂退长草', weight: 2 },
  { key: 'retired', label: '已退役', weight: 1 },
] as const;

/** 非法/未知输入的兜底状态(未知键 → 未通关) */
export const DEFAULT_STATUS: Status = 'uncompleted';

const KEY_TO_ENTRY = new Map<Status, StatusEntry>(STATUS_LADDER.map((s) => [s.key, s]));
const LABEL_TO_KEY = new Map<string, Status>(STATUS_LADDER.map((s) => [s.label, s.key]));

const DEFAULT_ENTRY = KEY_TO_ENTRY.get(DEFAULT_STATUS)!;
const DEFAULT_WEIGHT = 0;

/** 判断某字符串是否是一个合法的内部状态键 */
export function isStatus(value: string): value is Status {
  return KEY_TO_ENTRY.has(value as Status);
}

/** 判断某字符串是否是一个合法的中文状态文案 */
export function isStatusLabel(value: string): boolean {
  return LABEL_TO_KEY.has(value);
}

/** 返回全部状态键(按 STATUS_LADDER 顺序),测试断言从词汇模块取枚举值 */
export function statusKeys(): Status[] {
  return STATUS_LADDER.map((s) => s.key);
}

/** 返回全部中文文案(按 STATUS_LADDER 顺序) */
export function statusLabels(): string[] {
  return STATUS_LADDER.map((s) => s.label);
}

/** 中文展示文案(与 CONTEXT.md 词条一致)。未知键安全回退为"未通关"。 */
export function statusText(status: Status | string): string {
  const entry = KEY_TO_ENTRY.get(status as Status);
  return entry ? entry.label : DEFAULT_ENTRY.label;
}

/** 中文展示文案(statusLabel 为领域文档用名,与 statusText 同义) */
export function statusLabel(status: Status | string): string {
  return statusText(status);
}

/** 排序权重。未知键安全回退为 0(排最后)。 */
export function statusWeight(status: Status | string): number {
  const entry = KEY_TO_ENTRY.get(status as Status);
  return entry ? entry.weight : DEFAULT_WEIGHT;
}

/**
 * 中文文案 → 内部键(CSV 导回 / CLI 使用)。
 * 未知文案安全回退为 DEFAULT_STATUS(未通关)。
 */
export function statusToKey(label: string): Status {
  return LABEL_TO_KEY.get(label) ?? DEFAULT_STATUS;
}

/**
 * 内部键 → 规范化 Status(数据校验使用)。
 * 未知键安全回退为 DEFAULT_STATUS(未通关)。
 */
export function keyToStatus(key: string): Status {
  return isStatus(key) ? key : DEFAULT_STATUS;
}
