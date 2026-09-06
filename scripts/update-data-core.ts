// 交互式数据更新菜单核心逻辑与任务注册清单 (Spec 09 / Issue #9)
// 纯逻辑模块: 负责任务清单声明、命令行指令拼装、环境变量解析与派发接缝。
// 保持 100% 声明式,未来新增/删除任务只需修改 TASKS 数组。

export interface TaskItem {
  /** 菜单选项数字键 (如 '1', '2') */
  key: string;
  /** 任务简要标题 */
  title: string;
  /** 分组类别标签 */
  category: '元数据与注释' | '表格批量编辑' | '外部同步与成就';
  /** 业务时机与用途描述 */
  desc: string;
  /** 目标脚本路径 (相对于项目根目录) */
  script: string;
  /** 附加参数 */
  args?: string[];
  /** 必需的环境变量凭证 (缺省时触发引导) */
  requiresEnv?: Array<'STEAM_API_KEY' | 'STEAM_ID'>;
}

export interface ResolvedCommand {
  command: string;
  args: string[];
}

export type ProcessRunner = (
  command: string,
  args: string[],
  options?: { env?: Record<string, string | undefined> }
) => Promise<number>;

/**
 * 声明式手动任务清单
 * 新增/修改/删除手动任务只需在此数组维护
 */
export const TASKS: TaskItem[] = [
  {
    key: '1',
    title: '丰富游戏元数据 (enrich-metadata)',
    category: '元数据与注释',
    desc: '买了新游戏后执行: 增量抓取中文名、官方 genres 与发售日期写入注释文件',
    script: 'scripts/enrich-metadata.mjs',
  },
  {
    key: '2',
    title: '交互式录入单款评测 (add-review)',
    category: '元数据与注释',
    desc: '随时执行: 命令行交互打标六阶梯游玩状态、最高段位、短评、长评与年份',
    script: 'scripts/add-review.mjs',
  },
  {
    key: '3',
    title: '根据运行时间预填游玩年份 (fill-play-year)',
    category: '元数据与注释',
    desc: '按需执行: 提取 Steam 最后运行年份批量填入 play_year (保护区间年份)',
    script: 'scripts/fill-play-year.mjs',
  },
  {
    key: '4',
    title: '导出 CSV 表格供批量编辑 (json-to-csv)',
    category: '表格批量编辑',
    desc: '集中整理时执行: 导出 steam.csv (UTF-8 BOM), 供 Excel/WPS 打开修改',
    script: 'scripts/json-to-csv.mjs',
  },
  {
    key: '5',
    title: '导入编辑后的 CSV 表格 (csv-to-json)',
    category: '表格批量编辑',
    desc: '表格编辑完成后执行: 读取 steam.csv, 校验状态与年份后安全写回注释文件',
    script: 'scripts/csv-to-json.mjs',
  },
  {
    key: '6',
    title: '全量检查成就进度与首次游玩估算 (check-achievements)',
    category: '外部同步与成就',
    desc: '刷新成就时执行: 逐款抓取成就解锁率, 产出全成就清单与首次游玩(估)时间戳',
    script: 'scripts/check-achievements.mjs',
    requiresEnv: ['STEAM_API_KEY', 'STEAM_ID'],
  },
  {
    key: '7',
    title: '手动拉取最新 Steam 拥有游戏与时长 (fetch-steam-games)',
    category: '外部同步与成就',
    desc: '本地测试或刚打完想立即更新时执行 (平时由 GitHub Actions 每日自动完成)',
    script: 'scripts/fetch-steam-games.mjs',
    requiresEnv: ['STEAM_API_KEY', 'STEAM_ID'],
  },
];

/** 根据数字键查找任务 */
export function getTaskByKey(key: string): TaskItem | undefined {
  return TASKS.find((t) => t.key.trim() === key.trim());
}

/** 检查任务所需的前置环境变量,返回缺失的变量列表 */
export function checkPrerequisites(
  task: TaskItem,
  env: Record<string, string | undefined>
): string[] {
  if (!task.requiresEnv || task.requiresEnv.length === 0) return [];
  const missing: string[] = [];
  for (const name of task.requiresEnv) {
    const val = env[name];
    if (!val || val.trim() === '') {
      missing.push(name);
    }
  }
  return missing;
}

/** 解析任务对应的命令行执行器与参数 */
export function resolveTaskCommand(task: TaskItem): ResolvedCommand {
  const isTs = task.script.endsWith('.ts');
  const args = isTs ? ['--experimental-strip-types', task.script] : [task.script];
  if (task.args && task.args.length > 0) {
    args.push(...task.args);
  }
  return {
    command: 'node',
    args,
  };
}

/** 派发任务给执行器 */
export async function dispatchTask(
  task: TaskItem,
  runner: ProcessRunner,
  env?: Record<string, string | undefined>
): Promise<number> {
  const { command, args } = resolveTaskCommand(task);
  return runner(command, args, { env });
}

/**
 * 简易解析 .env 文件内容 (零外部依赖)
 * 支持: 空行忽略、# 注释行忽略、首尾空格剥离、单双引号去除
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalIdx = line.indexOf('=');
    if (equalIdx === -1) continue;
    const key = line.slice(0, equalIdx).trim();
    let val = line.slice(equalIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) {
      result[key] = val;
    }
  }
  return result;
}
