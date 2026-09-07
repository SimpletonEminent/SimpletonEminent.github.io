// 回归测试: Steam 数据管道核心与 CSV 编解码器 (Spec 07 / Issue #7)
// 验证:
// 1. 路径契约与文件持久化辅助契约;
// 2. 弹性 HTTP 客户端 (ResilientHttpClient) 面对 200, 429, 500, 404 时的重试与退避行为;
// 3. RFC 兼容 CSV 编解码器在多行、逗号、引号、Emoji 复杂场景下的往返无损性;
// 4. CSV 导回时的三重安全保护 (未知 appid 忽略、非法状态回退、非法年份拦截)。

import {
  PATHS,
  ResilientHttpClient,
  HttpError,
  escapeCsvCell,
  parseCsv,
  exportAnnotationsToCsv,
  importAnnotationsFromCsv,
  syncSteamGames,
  fetchAppDetails,
  fetchPlayerAchievements,
  type HttpTransport,
} from './steam-pipeline-core.ts';
import type { SteamGame, Annotation } from '../src/lib/steam-data.ts';
import { DEFAULT_STATUS } from '../src/lib/play-status.ts';

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

async function runTests() {
  console.log('--- 测试 Steam 同步管道核心 (Steam Pipeline Core) ---');

  // ==========================================
  // 1. 路径常量测试
  // ==========================================
  check('PATHS.GAMES 路径正确', PATHS.GAMES === 'public/steam_games.json');
  check('PATHS.ANNOTATIONS 路径正确', PATHS.ANNOTATIONS === 'src/data/steam_annotations.json');
  check('PATHS.ACHIEVEMENTS 路径正确', PATHS.ACHIEVEMENTS === 'public/steam_achievements.json');
  check('PATHS.CSV 路径正确', PATHS.CSV === 'steam.csv');

  // ==========================================
  // 2. 弹性 HTTP 客户端行为测试
  // ==========================================
  // 2.1 首次请求成功 (HTTP 200)
  let calls200 = 0;
  const transport200: HttpTransport = async () => {
    calls200++;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const client200 = new ResilientHttpClient({ transport: transport200, initialDelayMs: 1 });
  const res200 = await client200.fetchJson<{ ok: boolean }>('https://api.test/200');
  check('200 响应一次成功不重试', res200.ok === true && calls200 === 1);

  // 2.2 瞬时 500 错误在第 2 次重试成功
  let calls500 = 0;
  const delays500: number[] = [];
  const transport500: HttpTransport = async () => {
    calls500++;
    if (calls500 === 1) {
      return new Response('Server Error', { status: 500 });
    }
    return new Response(JSON.stringify({ recovered: true }), { status: 200 });
  };
  const client500 = new ResilientHttpClient({
    transport: transport500,
    initialDelayMs: 50,
    backoffFactor: 2,
    logger: {},
  });
  // 注入 sleep 记录
  client500.sleep = async (ms) => {
    delays500.push(ms);
  };
  const res500 = await client500.fetchJson<{ recovered: boolean }>('https://api.test/500');
  check('500 故障自动重试并在第 2 次成功', res500.recovered === true && calls500 === 2);
  check('首次重试延时符合 initialDelayMs', delays500.length === 1 && delays500[0] === 50);

  // 2.3 瞬时 429 (Too Many Requests) 连续重试后成功
  let calls429 = 0;
  const delays429: number[] = [];
  const transport429: HttpTransport = async () => {
    calls429++;
    if (calls429 < 3) {
      return new Response('Too Many Requests', { status: 429 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const client429 = new ResilientHttpClient({
    transport: transport429,
    maxRetries: 3,
    initialDelayMs: 100,
    backoffFactor: 2,
    logger: {},
  });
  client429.sleep = async (ms) => {
    delays429.push(ms);
  };
  const res429 = await client429.fetchJson<{ success: boolean }>('https://api.test/429');
  check('429 限流重试 2 次后在第 3 次成功', res429.success === true && calls429 === 3);
  check('指数退避延时序列符合 [100, 200]', delays429[0] === 100 && delays429[1] === 200);

  // 2.4 持续 503 达到 maxRetries 抛错
  let calls503 = 0;
  const transport503: HttpTransport = async () => {
    calls503++;
    return new Response('Service Unavailable', { status: 503 });
  };
  const client503 = new ResilientHttpClient({
    transport: transport503,
    maxRetries: 3,
    initialDelayMs: 1,
    logger: {},
  });
  client503.sleep = async () => {};
  let failed503 = false;
  try {
    await client503.fetchJson('https://api.test/503');
  } catch (err) {
    failed503 = true;
  }
  check('达到最大重试次数后抛出异常', failed503 && calls503 === 3);

  // 2.5 确定性 404 错误不应进行重试
  let calls404 = 0;
  const transport404: HttpTransport = async () => {
    calls404++;
    return new Response('Not Found', { status: 404 });
  };
  const client404 = new ResilientHttpClient({
    transport: transport404,
    maxRetries: 3,
    initialDelayMs: 1,
    logger: {},
  });
  let caught404: unknown;
  try {
    await client404.fetchJson('https://api.test/404');
  } catch (err) {
    caught404 = err;
  }
  check(
    '404 抛出精确的 HttpError 且不进行无效重试',
    caught404 instanceof HttpError && caught404.status === 404 && calls404 === 1
  );

  // ==========================================
  // 3. Steam 业务编排测试
  // ==========================================
  // 3.1 syncSteamGames 编排
  const mockSyncTransport: HttpTransport = async (url) => {
    if (url.includes('GetOwnedGames')) {
      return new Response(
        JSON.stringify({
          response: {
            game_count: 2,
            games: [
              { appid: 10, name: 'Game Ten', playtime_forever: 600, rtime_last_played: 1600000000 },
              { appid: 20, name: 'Game Twenty', playtime_forever: 1200, rtime_last_played: 0 },
            ],
          },
        }),
        { status: 200 }
      );
    }
    if (url.includes('GetRecentlyPlayedGames')) {
      return new Response(
        JSON.stringify({
          response: {
            games: [{ appid: 10, playtime_2weeks: 120 }],
          },
        }),
        { status: 200 }
      );
    }
    return new Response('Not Found', { status: 404 });
  };
  const syncClient = new ResilientHttpClient({ transport: mockSyncTransport, initialDelayMs: 1 });
  const syncData = await syncSteamGames({ apiKey: 'KEY', steamId: 'ID', client: syncClient });
  check('syncSteamGames 聚合时长并按总时长降序', syncData.games[0].appid === 20 && syncData.games[0].playtime_hours === 20);
  check('syncSteamGames 关联近两周时长', syncData.games[1].appid === 10 && syncData.games[1].playtime_2weeks_hours === 2);

  // 3.2 fetchAppDetails 编排
  const mockDetailsTransport: HttpTransport = async () => {
    return new Response(
      JSON.stringify({
        '814380': {
          success: true,
          data: {
            name: '只狼：影逝二度',
            genres: [{ description: '动作' }, { description: '冒险' }],
            release_date: { date: '2019 年 3 月 22 日' },
          },
        },
      }),
      { status: 200 }
    );
  };
  const detailsClient = new ResilientHttpClient({ transport: mockDetailsTransport, initialDelayMs: 1 });
  const details = await fetchAppDetails(814380, detailsClient);
  check('fetchAppDetails 解析中文名与发售日', details?.name_zh === '只狼：影逝二度' && details?.release_date === '2019 年 3 月 22 日');
  check(
    'fetchAppDetails 提取官方 genres 列表',
    Boolean(details?.genres.includes('动作') && details?.genres.includes('冒险'))
  );

  // 3.3 fetchPlayerAchievements 编排
  const mockAchTransport: HttpTransport = async () => {
    return new Response(
      JSON.stringify({
        playerstats: {
          achievements: [
            { apiname: 'ACH_1', achieved: 1, unlocktime: 1550000000 },
            { apiname: 'ACH_2', achieved: 1, unlocktime: 1540000000 }, // 最早解锁
            { apiname: 'ACH_3', achieved: 0, unlocktime: 0 },
          ],
        },
      }),
      { status: 200 }
    );
  };
  const achClient = new ResilientHttpClient({ transport: mockAchTransport, initialDelayMs: 1 });
  const achResult = await fetchPlayerAchievements('KEY', 'ID', 101, achClient);
  if ('unlocked' in achResult) {
    check('fetchPlayerAchievements 统计解锁数与总数', achResult.unlocked === 2 && achResult.total === 3);
    check('fetchPlayerAchievements 提取最早解锁时间戳 firstUnlockAt', achResult.firstUnlockAt === 1540000000);
  } else {
    check('fetchPlayerAchievements 统计解锁数与总数', false);
  }

  // ==========================================
  // 4. RFC 兼容 CSV 编解码器测试
  // ==========================================
  // 4.1 单元格转义测试
  check('普通字符串不转义', escapeCsvCell('hello') === 'hello');
  check('包含逗号时添加双引号包裹', escapeCsvCell('a,b') === '"a,b"');
  check('包含双引号时加引号并双重转义', escapeCsvCell('he said "ok"') === '"he said ""ok"""');
  check('包含换行符时加引号', escapeCsvCell("line1\nline2") === '"line1\nline2"');
  check('null 或 undefined 返回空字符串', escapeCsvCell(null) === '' && escapeCsvCell(undefined) === '');

  // 4.2 复杂 CSV 解析测试 (多行、转义引号、逗号、BOM)
  const rawCsv = '\uFEFF"appid","name","my_review"\r\n101,"Game, with comma","A ""quoted"" review\nwith newline"\r\n';
  const parsedRows = parseCsv(rawCsv);
  check('parseCsv 解析出 2 行', parsedRows.length === 2);
  check('parseCsv 准确解析逗号单元格', parsedRows[1][1] === 'Game, with comma');
  check('parseCsv 准确解析带引号与换行的多行单元格', parsedRows[1][2] === 'A "quoted" review\nwith newline');

  // 4.3 往返无损性 (Roundtrip Losslessness)
  const sampleGames: SteamGame[] = [
    {
      appid: 814380,
      name: 'Sekiro: Shadows Die Twice',
      playtime_hours: 347,
      playtime_2weeks_hours: 0,
      last_played: 1700000000,
      cover: 'https://example.com/cover.jpg',
    },
  ];
  const sampleAnnotations: Record<string, Annotation> = {
    '814380': {
      name_zh: '只狼：影逝二度',
      my_status: 'completed',
      my_rank: '忍杀修罗 💎',
      my_review: '打铁心流，"犹豫就会败北，果断就会白给！"\n非常值得二刷。',
      blog_url: '/blog/sekiro_review/',
      play_year: '2021-2024',
      platform: 'PC',
      tags: ['魂类', '硬核', '动作'],
    },
  };

  const csvOutput = exportAnnotationsToCsv(sampleGames, sampleAnnotations);
  check('exportAnnotationsToCsv 包含 UTF-8 BOM', csvOutput.startsWith('\uFEFF'));

  const imported = importAnnotationsFromCsv(csvOutput, sampleAnnotations);
  const reAnn = imported.annotations['814380'];

  check('往返后中文名无损', reAnn.name_zh === sampleAnnotations['814380'].name_zh);
  check('往返后游玩状态无损', reAnn.my_status === sampleAnnotations['814380'].my_status);
  check('往返后段位无损 (含 Emoji)', reAnn.my_rank === sampleAnnotations['814380'].my_rank);
  check('往返后带逗号/双引号/换行的复杂短评无损', reAnn.my_review === sampleAnnotations['814380'].my_review);
  check('往返后区间年份无损', reAnn.play_year === sampleAnnotations['814380'].play_year);
  check('往返后标签数组无损', JSON.stringify(reAnn.tags) === JSON.stringify(sampleAnnotations['814380'].tags));

  // 4.4 安全防护测试: 忽略未知 appid
  const csvWithUnknown = '\uFEFFappid,游玩状态\r\n814380,已通关\r\n999999,未通关\r\n';
  const importUnknown = importAnnotationsFromCsv(csvWithUnknown, sampleAnnotations, new Set(['814380']));
  check('忽略未知 appid (999999)', importUnknown.ignored === 1 && importUnknown.updated === 1);

  // 4.5 安全防护测试: 非法状态回退未通关
  const csvWithInvalidStatus = '\uFEFFappid,游玩状态\r\n814380,超级无敌通关\r\n';
  const importInvalidStatus = importAnnotationsFromCsv(csvWithInvalidStatus, sampleAnnotations);
  check('非法游玩状态回退 DEFAULT_STATUS', importInvalidStatus.annotations['814380'].my_status === DEFAULT_STATUS);
  check('非法游玩状态记录警告信息', importInvalidStatus.warnings.length > 0);

  // 4.6 安全防护测试: 非法年份拦截
  const csvWithInvalidYear = '\uFEFFappid,游玩状态,游玩年份\r\n814380,已通关,202\r\n';
  const importInvalidYear = importAnnotationsFromCsv(csvWithInvalidYear, sampleAnnotations);
  check('非法年份不写入 (保留原有或跳过)', importInvalidYear.annotations['814380'].play_year === sampleAnnotations['814380'].play_year);
  check('非法年份记录警告信息', importInvalidYear.warnings.some((w) => w.includes('非法')));

  // 4.7 字段清空意图测试: CSV 单元格置空时应移除注释对应属性
  const csvToClear = '\uFEFFappid,游玩状态,短评,最高段位,特色标签\r\n814380,"",,,\r\n';
  const importCleared = importAnnotationsFromCsv(csvToClear, sampleAnnotations);
  const clearedAnn = importCleared.annotations['814380'];
  check('空游玩状态单元格重置为 DEFAULT_STATUS', clearedAnn.my_status === DEFAULT_STATUS);
  check('空短评单元格删除 my_review 字段', !('my_review' in clearedAnn));
  check('空段位单元格删除 my_rank 字段', !('my_rank' in clearedAnn));
  check('空标签单元格删除 tags 字段', !('tags' in clearedAnn));

  console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
  process.exit(failures === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error('测试异常:', err);
  process.exit(1);
});
