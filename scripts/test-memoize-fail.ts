// 回归测试: 游戏数据仓库与存储接缝 (Spec 06)
// 验证使用 MemoryStorageAdapter 注入正常、空、损坏数据与读取异常时的行为；
// 彻底消灭原先在磁盘上真实重命名数据文件的破坏性测试手段。

import {
  GameDataRepository,
  MemoryStorageAdapter,
  resetGameDataCache,
  loadMergedGames,
  type SteamGame,
  type Annotation,
} from '../src/lib/steam-data.ts';

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

// ==========================================
// 1. 模拟数据文件读取失败（替代原磁盘重命名黑魔法）
// ==========================================
const failAdapter = new MemoryStorageAdapter({ gamesData: null });
const failRepo = new GameDataRepository(failAdapter);
const failResult = failRepo.loadMergedGames();

check('游戏数据读取失败(抛出异常)时安全回退返回 games: []', Array.isArray(failResult.games) && failResult.games.length === 0);

// ==========================================
// 2. 模拟 JSON 格式损坏容错
// ==========================================
const corruptGamesAdapter = new MemoryStorageAdapter({ gamesData: '<<< NOT VALID JSON >>>' });
const corruptGamesRepo = new GameDataRepository(corruptGamesAdapter);
const corruptGamesResult = corruptGamesRepo.loadMergedGames();

check('游戏数据 JSON 损坏时安全回退返回 games: []', Array.isArray(corruptGamesResult.games) && corruptGamesResult.games.length === 0);

// 游戏数据正常，但注释文件损坏
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
  annotations: null, // 注释读取失败
  achievementsData: '<<< INVALID ACHIEVEMENTS JSON >>>', // 成就损坏
});
const corruptAnnoRepo = new GameDataRepository(corruptAnnoAdapter);
const corruptAnnoResult = corruptAnnoRepo.loadMergedGames();

check('注释与成就损坏时游戏数据依然正常返回', corruptAnnoResult.games.length === 1);
check('注释损坏时状态默认回退为 uncompleted', corruptAnnoResult.games[0].my_status === 'uncompleted');
check('注释损坏时 tags 默认为空数组', Array.isArray(corruptAnnoResult.games[0].tags) && corruptAnnoResult.games[0].tags.length === 0);
check('成就损坏时 achievements 安全回退为 undefined', corruptAnnoResult.games[0].achievements === undefined);

// ==========================================
// 3. 领域合并规则验证 (0h过滤、字段融合、默认降序)
// ==========================================
const domainGames: SteamGame[] = [
  {
    appid: 1,
    name: 'Never Played',
    playtime_hours: 0, // 0h 应该被过滤
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
check('默认按总时长降序排序 (appid 3 在前)', domainResult.games[0].appid === 3 && domainResult.games[1].appid === 2);
check('正确融合注释中文名', domainResult.games[0].name_zh === '高时长游戏');
check('正确融合段位与状态', domainResult.games[0].my_status === 'perfect' && domainResult.games[0].my_rank === '王者 👑');
check('正确融合成就与最早解锁时间戳', domainResult.games[0].achievements?.unlocked === 50 && domainResult.games[0].first_achievement_at === 1600000000);

// 验证排序预设
const presets = domainRepo.getSortPresets();
check('排序预设 playtime 顺序符合预期', presets.playtime[0] === 3 && presets.playtime[1] === 2);
check('排序预设 nameAsc 字母排序符合预期', presets.nameAsc.length === 2);

// ==========================================
// 4. 实例隔离与缓存重置测试
// ==========================================
// 验证独立实例不共享缓存
const isolatedAdapter = MemoryStorageAdapter.fromObjects({
  gamesData: { games: [{ appid: 999, name: 'Isolated Game', playtime_hours: 5, playtime_2weeks_hours: 0, last_played: 0, cover: '' }] },
});
const isolatedRepo = new GameDataRepository(isolatedAdapter);
const isolatedResult = isolatedRepo.loadMergedGames();

check('独立仓库实例数据相互隔离', isolatedResult.games.length === 1 && isolatedResult.games[0].appid === 999);
check('先前的 domainRepo 缓存未受影响', domainRepo.loadMergedGames().games.length === 2);

// 验证 resetCache 生效
isolatedAdapter.setGamesData(JSON.stringify({ games: [] }));
check('未 resetCache 时读取依然命中旧缓存', isolatedRepo.loadMergedGames().games.length === 1);
isolatedRepo.resetCache();
check('调用 resetCache 后重新加载数据生效', isolatedRepo.loadMergedGames().games.length === 0);

// 验证模块级单例缓存重置
resetGameDataCache();
const defaultCall = loadMergedGames();
check('全局单例 loadMergedGames 在 resetGameDataCache 后正常加载', Array.isArray(defaultCall.games));

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
