// 回归与行为测试: 交互式数据更新菜单 (Spec 09 / Issue #9)
// 验证: 任务清单完整性、键值解析、前置环境自检、命令解析派发以及本地 .env 解析。
// 运行: npm test
import {
  TASKS,
  getTaskByKey,
  checkPrerequisites,
  resolveTaskCommand,
  dispatchTask,
  parseEnvContent,
  type ProcessRunner,
} from './update-data-core.ts';

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

console.log('--- 测试交互式数据更新菜单 (Update Data CLI Core) ---');

// 1. 任务清单完整性
check('TASKS 包含至少 6 个手动更新任务', TASKS.length >= 6);

const keys = TASKS.map((t) => t.key);
check('任务键包含 1 至 6', ['1', '2', '3', '4', '5', '6'].every((k) => keys.includes(k)));

// 2. 按键获取任务
const task1 = getTaskByKey('1');
check('getTaskByKey(1) 成功匹配到元数据丰富任务', task1?.script.includes('enrich-metadata') === true);

const taskInvalid = getTaskByKey('999');
check('getTaskByKey(999) 返回 undefined', taskInvalid === undefined);

// 3. 前置环境要求自检 (Prerequisites Check)
const taskEnrich = getTaskByKey('1')!;
check('元数据丰富脚本无需额外环境变量', checkPrerequisites(taskEnrich, {}).length === 0);

const taskAchievements = getTaskByKey('6')!;
const missingBoth = checkPrerequisites(taskAchievements, {});
check('成就检查脚本在无环境变量时提示缺少 STEAM_API_KEY 与 STEAM_ID', missingBoth.includes('STEAM_API_KEY') && missingBoth.includes('STEAM_ID'));

const missingOne = checkPrerequisites(taskAchievements, { STEAM_API_KEY: 'test-key' });
check('提供 KEY 缺少 ID 时仅提示缺少 STEAM_ID', missingOne.length === 1 && missingOne[0] === 'STEAM_ID');

const allPresent = checkPrerequisites(taskAchievements, { STEAM_API_KEY: 'test-key', STEAM_ID: 'test-id' });
check('两者均存在时前置检查通过', allPresent.length === 0);

// 4. 命令解析 (Resolve Task Command)
const cmd1 = resolveTaskCommand(task1!);
check('命令包含 node 执行器', cmd1.command === 'node');
check('参数包含对应脚本路径', cmd1.args.some((a) => a.includes('enrich-metadata.mjs')));

// 5. 进程调度派发接缝 (Dispatch Seam with Mock Runner)
let calledCmd = '';
let calledArgs: string[] = [];
let calledEnv: Record<string, string | undefined> | undefined;

const mockRunner: ProcessRunner = async (command, args, options) => {
  calledCmd = command;
  calledArgs = args;
  calledEnv = options?.env;
  return 0; // 模拟成功
};

await dispatchTask(task1!, mockRunner, { FOO: 'bar' });
check('dispatchTask 调用了 mockRunner 的 command', calledCmd === 'node');
check('dispatchTask 传递了正确的脚本路径参数', calledArgs.some((a) => a.includes('enrich-metadata.mjs')));
check('dispatchTask 透传了自定义环境变量', calledEnv?.FOO === 'bar');

// 6. 本地 .env 文件解析 (无需第三方库)
const envText = `
# 这是注释
STEAM_API_KEY=my-secret-key-123
STEAM_ID="76561198000000000"
EMPTY_VAL=
TRIM_ME =  hello world  
`;
const parsedEnv = parseEnvContent(envText);
check('解析出的 STEAM_API_KEY 正确', parsedEnv.STEAM_API_KEY === 'my-secret-key-123');
check('双引号包裹的 STEAM_ID 正确剥离引号', parsedEnv.STEAM_ID === '76561198000000000');
check('带空格的值正确去除首尾空白', parsedEnv.TRIM_ME === 'hello world');
check('注释行不被解析为变量', parsedEnv['#'] === undefined);

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
