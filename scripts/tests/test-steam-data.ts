import * as steamData from '../../src/lib/steam-data.ts';
import {
  badgesFor,
  loadMergedGames,
  getSortPresets,
  GameDataRepository,
  MemoryStorageAdapter,
  resetGameDataCache,
  type SteamGame,
  type Annotation,
} from '../../src/lib/steam-data.ts';
import { statusKeys, type Status } from '../../src/lib/play-status.ts';

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

function checkEq(label: string, actual: unknown, expected: unknown) {
  total++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('PASS', label);
  } else {
    failures++;
    console.error('FAIL', label, '| actual:', a, '| expected:', e);
  }
}

console.log('--- 测试游戏数据仓库、记忆化与徽章模型 (Steam Data Repository) ---');

const STATUSES: Status[] = statusKeys();
for (const status of STATUSES) {
  checkEq('无段位 / ' + status, badgesFor({ my_status: status, my_rank: '' }), [
    { kind: 'status', value: status },
  ]);
  checkEq('有段位 / ' + status, badgesFor({ my_status: status, my_rank: '铂金' }), [
    { kind: 'status', value: status },
    { kind: 'rank', value: '铂金' },
  ]);
}
checkEq('空白段位', badgesFor({ my_status: 'ongoing', my_rank: '   ' }), [
  { kind: 'status', value: 'ongoing' },
]);

const call1 = loadMergedGames();
const call2 = loadMergedGames();
check('loadMergedGames() 多次调用返回相同对象引用', call1 === call2);
check('games 数组引用相同', call1.games === call2.games);

const presets1 = getSortPresets();
const presets2 = getSortPresets();
check('getSortPresets() 多次调用返回相同对象引用', presets1 === presets2);
check('sortPresets.playtime 数组引用相同', presets1.playtime === presets2.playtime);

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

const ann1 = steamData.loadAnnotations();
const ann2 = steamData.loadAnnotations();
check('loadAnnotations() 多次调用返回相同对象引用', ann1 === ann2);
check('loadAnnotations() 返回非空注释对象', typeof ann1 === 'object' && Object.keys(ann1).length > 0);

const sekiroAnn = steamData.getAnnotation(814380);
check('getAnnotation(814380) 成功命中只狼注释', sekiroAnn !== undefined && sekiroAnn.name_zh === '只狼：影逝二度');

const foundSekiro = steamData.findAnnotationByBlogUrl('/blog/sekiro_review');
check('findAnnotationByBlogUrl("/blog/sekiro_review") 成功匹配 appid 814380', foundSekiro !== undefined && foundSekiro.appid === 814380);

const notFound = steamData.findAnnotationByBlogUrl('/blog/non_existent_url');
check('findAnnotationByBlogUrl 未知 URL 返回 undefined', notFound === undefined);

const failAdapter = new MemoryStorageAdapter({ gamesData: null });
const failRepo = new GameDataRepository(failAdapter);
const failResult = failRepo.loadMergedGames();
check('游戏数据读取失败(抛出异常)时安全回退返回 games: []', Array.isArray(failResult.games) && failResult.games.length === 0);

const corruptGamesAdapter = new MemoryStorageAdapter({ gamesData: '<<< NOT VALID JSON >>>' });
const corruptGamesRepo = new GameDataRepository(corruptGamesAdapter);
const corruptGamesResult = corruptGamesRepo.loadMergedGames();
check('游戏数据 JSON 损坏时安全回退返回 games: []', Array.isArray(corruptGamesResult.games) && corruptGamesResult.games.length === 0);

const mockGames: SteamGame[] = [
  {
    appid: 101,
    name: 'Game 101',
    playtime_hours: 50,
    playtime_2weeks_hours: 5,
    last_played: 1700000000,
    cover: 'https://example.com/101.jpg',
  },
];

const corruptAnnoAdapter = MemoryStorageAdapter.fromObjects({
  gamesData: { updatedAt: '2026-09-01T00:00:00Z', games: mockGames },
  annotations: null,
  achievementsData: '<<< INVALID ACHIEVEMENTS JSON >>>',
});
const corruptAnnoRepo = new GameDataRepository(corruptAnnoAdapter);
const corruptAnnoResult = corruptAnnoRepo.loadMergedGames();

check('注释与成就损坏时游戏数据依然正常返回', corruptAnnoResult.games.length === 1);
check('注释损坏时状态默认回退为 uncompleted', corruptAnnoResult.games[0].my_status === 'uncompleted');
check('注释损坏时 tags 默认为空数组', Array.isArray(corruptAnnoResult.games[0].tags) && corruptAnnoResult.games[0].tags.length === 0);
check('成就损坏时 achievements 安全回退为 undefined', corruptAnnoResult.games[0].achievements === undefined);

const domainGames: SteamGame[] = [
  {
    appid: 1,
    name: 'Never Played',
    playtime_hours: 0,
    playtime_2weeks_hours: 0,
    last_played: 0,
    cover: '',
  },
  {
    appid: 2,
    name: 'Game Low Playtime',
    playtime_hours: 10,
    playtime_2weeks_hours: 1,
    last_played: 1690000000,
    cover: '',
  },
  {
    appid: 3,
    name: 'Game High Playtime',
    playtime_hours: 100,
    playtime_2weeks_hours: 10,
    last_played: 1710000000,
    cover: '',
  },
];

const domainAnnotations: Record<string, Annotation> = {
  '3': {
    name_zh: '高时长游戏',
    my_status: 'perfect',
    my_rank: '王者 👑',
    tags: ['RPG', '动作'],
    release_date: '2024 年 8 月 20 日',
  },
};

const domainAchievements = {
  updatedAt: '2026-09-01',
  games: [
    {
      appid: 3,
      hasStats: true,
      unlocked: 50,
      total: 50,
      firstUnlockAt: 1600000000,
    },
  ],
};

const domainAdapter = MemoryStorageAdapter.fromObjects({
  gamesData: { updatedAt: '2026-09-01T12:00:00Z', games: domainGames },
  annotations: domainAnnotations,
  achievementsData: domainAchievements,
});

const domainRepo = new GameDataRepository(domainAdapter);
const domainResult = domainRepo.loadMergedGames();

check('自动过滤 0h 游戏 (只保留 2 款)', domainResult.games.length === 2);
check('默认按近期运行过降序排序 (appid 3 在前)', domainResult.games[0].appid === 3 && domainResult.games[1].appid === 2);
check('正确融合注释中文名', domainResult.games[0].name_zh === '高时长游戏');
check('正确融合段位与状态', domainResult.games[0].my_status === 'perfect' && domainResult.games[0].my_rank === '王者 👑');
check('正确融合成就与最早解锁时间戳', domainResult.games[0].achievements?.unlocked === 50 && domainResult.games[0].first_achievement_at === 1600000000);

const presets = domainRepo.getSortPresets();
check('排序预设 playtime 顺序符合预期', presets.playtime[0] === 3 && presets.playtime[1] === 2);
check('排序预设 nameAsc 字母排序符合预期', presets.nameAsc.length === 2);

const isolatedAdapter = MemoryStorageAdapter.fromObjects({
  gamesData: { games: [{ appid: 999, name: 'Isolated Game', playtime_hours: 5, playtime_2weeks_hours: 0, last_played: 0, cover: '' }] },
});
const isolatedRepo = new GameDataRepository(isolatedAdapter);
const isolatedResult = isolatedRepo.loadMergedGames();

check('独立仓库实例数据相互隔离', isolatedResult.games.length === 1 && isolatedResult.games[0].appid === 999);
check('先前的 domainRepo 缓存未受影响', domainRepo.loadMergedGames().games.length === 2);

isolatedAdapter.setGamesData(JSON.stringify({ games: [] }));
check('未 resetCache 时读取依然命中旧缓存', isolatedRepo.loadMergedGames().games.length === 1);
isolatedRepo.resetCache();
check('调用 resetCache 后重新加载数据生效', isolatedRepo.loadMergedGames().games.length === 0);

check('failAdapter (annotations: null) 时 loadAnnotations 安全回退为 {}', Object.keys(failRepo.loadAnnotations()).length === 0);

const corruptOnlyAnnoAdapter = new MemoryStorageAdapter({ annotations: '<<< NOT VALID JSON >>>' });
const corruptOnlyAnnoRepo = new GameDataRepository(corruptOnlyAnnoAdapter);
check('注释文件损坏时 loadAnnotations 安全回退为 {}', Object.keys(corruptOnlyAnnoRepo.loadAnnotations()).length === 0);

check('domainRepo 成功解析内存注入的注释', domainRepo.loadAnnotations()['3']?.name_zh === '高时长游戏');
check('domainRepo.getAnnotation(3) 成功读取单款游戏注释', domainRepo.getAnnotation(3)?.my_rank === '王者 👑');
check('domainRepo.getAnnotation(999) 未存在游戏返回 undefined', domainRepo.getAnnotation(999) === undefined);

isolatedAdapter.setAnnotations(JSON.stringify({ '888': { name_zh: 'Cached Game' } }));
isolatedRepo.resetCache();
check('isolatedRepo 读取新设置的内存注释', isolatedRepo.loadAnnotations()['888']?.name_zh === 'Cached Game');
isolatedAdapter.setAnnotations(JSON.stringify({ '888': { name_zh: 'Updated Game' } }));
check('未 resetCache 时 loadAnnotations 命中旧缓存', isolatedRepo.loadAnnotations()['888']?.name_zh === 'Cached Game');
isolatedRepo.resetCache();
check('resetCache 后 loadAnnotations 重新解析并更新', isolatedRepo.loadAnnotations()['888']?.name_zh === 'Updated Game');

resetGameDataCache();
const defaultCall = loadMergedGames();
check('全局单例 loadMergedGames 在 resetGameDataCache 后正常加载', Array.isArray(defaultCall.games));

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
