// 回归测试: 数据装载记忆化 (Spec 04)
import { loadMergedGames, getSortPresets } from '../../src/lib/steam-data.ts';

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

// 1. 同一进程内连续两次调用返回相同引用
const call1 = loadMergedGames();
const call2 = loadMergedGames();

check('loadMergedGames() 多次调用返回相同对象引用', call1 === call2);
check('games 数组引用相同', call1.games === call2.games);

// 2. getSortPresets 返回相同引用
const presets1 = getSortPresets();
const presets2 = getSortPresets();

check('getSortPresets() 多次调用返回相同对象引用', presets1 === presets2);
check('sortPresets.playtime 数组引用相同', presets1.playtime === presets2.playtime);

// 3. Spec 19 (Issue #19): steam-data.ts 严禁透传重导出游玩状态领域词汇符号
import * as steamData from '../../src/lib/steam-data.ts';

const FORBIDDEN_SYMBOLS = [
  'statusText',
  'statusLabel',
  'statusWeight',
  'statusToKey',
  'keyToStatus',
  'statusKeys',
  'isStatus',
  'STATUS_LADDER',
  'DEFAULT_STATUS',
];

for (const sym of FORBIDDEN_SYMBOLS) {
  check(`steam-data.ts 不透传重导出 ${sym}`, !(sym in steamData));
}

// 4. Spec 21 (Issue #21): loadAnnotations 记忆化与统一查询方法
const ann1 = steamData.loadAnnotations();
const ann2 = steamData.loadAnnotations();

check('loadAnnotations() 多次调用返回相同对象引用', ann1 === ann2);
check('loadAnnotations() 返回非空注释对象', typeof ann1 === 'object' && Object.keys(ann1).length > 0);

// 查询方法验证
const sekiroAnn = steamData.getAnnotation(814380);
check('getAnnotation(814380) 成功命中只狼注释', sekiroAnn !== undefined && sekiroAnn.name_zh === '只狼：影逝二度');

const foundSekiro = steamData.findAnnotationByBlogUrl('/blog/sekiro_review');
check('findAnnotationByBlogUrl("/blog/sekiro_review") 成功匹配 appid 814380', foundSekiro !== undefined && foundSekiro.appid === 814380);

const notFound = steamData.findAnnotationByBlogUrl('/blog/non_existent_url');
check('findAnnotationByBlogUrl 未知 URL 返回 undefined', notFound === undefined);

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
