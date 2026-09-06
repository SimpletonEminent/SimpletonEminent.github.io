// 异常路径测试: 模拟读取失败
import { loadMergedGames } from '../src/lib/steam-data.ts';
import fs from 'node:fs';

// 为了测试缓存独立性，我们需要清除之前可能的缓存
// 但在同一个模块实例中这很难，我们可以临时重命名文件来测试失败行为，
// 不过，这需要一个新的Node进程，所以这作为单独文件运行。

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

const originalPath = 'public/steam_games.json';
const tempPath = 'public/steam_games.json.bak';

try {
  // Rename the file to simulate failure
  if (fs.existsSync(originalPath)) {
    fs.renameSync(originalPath, tempPath);
  }

  const result = loadMergedGames();
  check('数据文件读取失败时返回 games: []', Array.isArray(result.games) && result.games.length === 0);

} finally {
  // Restore
  if (fs.existsSync(tempPath)) {
    fs.renameSync(tempPath, originalPath);
  }
}

console.log(failures === 0 ? `ALL PASS (${total} checks)` : `${failures} FAILED (of ${total})`);
process.exit(failures === 0 ? 0 : 1);
