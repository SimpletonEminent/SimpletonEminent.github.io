// 命令行交互式数据更新菜单 (Spec 09 / Issue #9)
// 运行命令: npm run updatedata
//
// 架构要点:
// 1. 纯解耦子进程派发: 底层脚本 100% 独立运行, 脚本退出或异常不影响菜单生命周期。
// 2. 交互循环机制: 任务完成后提示按回车返回主菜单, 输入 0 退出。
// 3. 环境变量自检与引导: 自动加载本地 .env (已 gitignore), 缺失时提供友好提示。

import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawn } from 'node:child_process';
import {
  TASKS,
  getTaskByKey,
  checkPrerequisites,
  resolveTaskCommand,
  parseEnvContent,
  type ProcessRunner,
} from './update-data-core.ts';

// 自动加载根目录未入库的 .env 文件 (若存在)
const ENV_FILE = '.env';
if (existsSync(ENV_FILE)) {
  try {
    const raw = readFileSync(ENV_FILE, 'utf-8');
    const parsed = parseEnvContent(raw);
    for (const [k, v] of Object.entries(parsed)) {
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  } catch {
    // 忽略读取错误
  }
}

const defaultRunner: ProcessRunner = (command, args, options) => {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...options?.env },
    });
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      console.error(`\n❌ 子进程启动失败: ${err.message}`);
      resolve(1);
    });
  });
};

function renderMenu() {
  console.log('\n============================================================');
  console.log('       🎮 我的极简博客 — 手动数据更新中心 (Mission Control)');
  console.log('============================================================');

  const categories = ['元数据与注释', '表格批量编辑', '外部同步与成就'] as const;

  for (const cat of categories) {
    console.log(`\n【${cat}】`);
    const catTasks = TASKS.filter((t) => t.category === cat);
    for (const task of catTasks) {
      console.log(`  [${task.key}] ${task.title}`);
      console.log(`      └─ ${task.desc}`);
    }
  }

  console.log('\n【系统选项】');
  console.log('  [0] 退出');
  console.log('============================================================');
}

async function promptMissingEnv(
  missing: string[],
  ask: (query: string) => Promise<string>
): Promise<boolean> {
  console.log(`\n⚠️ 该任务需要 Steam API 凭据，当前检测到缺少以下环境变量: ${missing.join(', ')}`);
  console.log('提示: 你可以在项目根目录创建 .env 文件保存凭据（已在 .gitignore 中忽略，不会入库）。');
  console.log('格式:');
  console.log('STEAM_API_KEY=你的Key');
  console.log('STEAM_ID=你的SteamID64\n');

  for (const varName of missing) {
    const answer = (await ask(`请输入临时 ${varName} (直接回车取消执行): `)).trim();
    if (!answer) {
      console.log('已取消任务执行。');
      return false;
    }
    process.env[varName] = answer;
  }
  return true;
}

async function main() {
  const rl = createInterface({ input, output });
  const ask = (q: string) => rl.question(q);

  try {
    while (true) {
      renderMenu();
      const rawChoice = await ask('\n请选择操作编号 [0-7]: ');
      const choice = rawChoice.trim().toLowerCase();

      if (choice === '0' || choice === 'q' || choice === 'exit') {
        console.log('\n已退出数据更新中心。祝游戏与写作愉快！');
        break;
      }

      const task = getTaskByKey(choice);
      if (!task) {
        console.log(`\n❌ 无效的选项 "${rawChoice}"，请输入列表中的数字编号。`);
        await ask('按 Enter 键继续...');
        continue;
      }

      // 前置环境变量自检
      const missing = checkPrerequisites(task, process.env);
      if (missing.length > 0) {
        const ok = await promptMissingEnv(missing, ask);
        if (!ok) {
          await ask('按 Enter 键返回主菜单...');
          continue;
        }
      }

      // 派发执行任务
      console.log(`\n▶ 正在调起: ${task.title} ...\n`);
      const { command, args } = resolveTaskCommand(task);
      const code = await defaultRunner(command, args);

      console.log('\n------------------------------------------------------------');
      if (code === 0) {
        console.log(`✅ 任务已执行完毕 (退出码: 0)`);
      } else {
        console.log(`⚠️ 任务已结束，但返回了非零退出码 (${code})`);
      }
      console.log('------------------------------------------------------------');

      await ask('按 Enter 键返回主菜单...');
    }
  } finally {
    rl.close();
  }
}

if (process.argv[1]?.endsWith('update-data.ts') || process.argv[1]?.endsWith('update-data.js')) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
