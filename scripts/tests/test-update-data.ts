// 回归与行为测试: 交互式数据更新菜单 (Spec 09 / Issue #9)
// 验证: 任务清单完整性、键值解析、前置环境自检、命令解析派发以及本地 .env 解析。
// 运行: npm test
import {
  TASKS,
  getTaskByKey,
  checkPrerequisites,
  resolveTaskCommand,
  executeTask,
  dispatchTask,
  parseEnvContent,
  type TaskItem,
} from '../lib/update-data-core.ts';

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

const taskQuote = getTaskByKey('8');
check('getTaskByKey(8) 成功匹配到语录录入任务', taskQuote?.script.includes('add-quote.ts') === true);

const taskInvalid = getTaskByKey('999');
check('getTaskByKey(999) 返回 undefined', taskInvalid === undefined);

// 3. 前置环境要求自检 (Prerequisites Check)
const taskEnrich = getTaskByKey('1')!;
check('元数据丰富脚本无需额外环境变量', checkPrerequisites(taskEnrich, {}).length === 0);
check('语录录入脚本无需额外环境变量', checkPrerequisites(taskQuote!, {}).length === 0);

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

// 5. 进程内操作与任务调度接缝 (In-Process Execution & Error Handling)
check('全量 8 个任务均已挂载进程内 action 函数', TASKS.every((t) => typeof t.action === 'function'));

let inProcessCalled: boolean = false;
let capturedCtx: any = null;
const mockSuccessTask: TaskItem = {
  key: '99',
  title: 'Mock 成功任务',
  category: '元数据与注释',
  desc: '测试进程内调用',
  script: 'scripts/mock.ts',
  action: async (ctx) => {
    inProcessCalled = true;
    capturedCtx = ctx;
    return 0;
  },
};

const codeSuccess = await executeTask(mockSuccessTask, { env: { FOO: 'bar' } });
check('executeTask 进程内操作正常执行并返回 0', codeSuccess === 0 && Boolean(inProcessCalled));
check('executeTask 正确透传 context 环境变量', capturedCtx?.env?.FOO === 'bar');

let errorLogCaptured = '';
const mockFailingTask: TaskItem = {
  key: '100',
  title: 'Mock 失败任务',
  category: '元数据与注释',
  desc: '测试进程内异常拦截',
  script: 'scripts/mock-fail.ts',
  action: async () => {
    throw new Error('测试抛错拦截');
  },
};

const codeFail = await executeTask(mockFailingTask, {
  logger: {
    error: (msg) => {
      errorLogCaptured = msg;
    },
  },
});
check('executeTask 捕获 action 内部异常并安全返回退出码 1', codeFail === 1);
check('executeTask 异常信息被正确格式化输出', errorLogCaptured.includes('测试抛错拦截'));

const dispatchRes = await dispatchTask(mockSuccessTask);
check('dispatchTask 进程内调度返回退出码 0', dispatchRes === 0);

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
