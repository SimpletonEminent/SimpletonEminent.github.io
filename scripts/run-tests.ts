import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const testsDir = resolve(process.cwd(), 'scripts/tests');
const testFiles = readdirSync(testsDir)
  .filter((name) => /^test-.*\.(ts|mjs)$/.test(name))
  .sort((a, b) => a.localeCompare(b));

if (testFiles.length === 0) {
  console.error('No test files found in scripts/tests/');
  process.exit(1);
}

let passedSuites = 0;
const failedSuites: string[] = [];

for (const file of testFiles) {
  const fullPath = resolve(testsDir, file);
  const args = file.endsWith('.ts') ? ['--experimental-strip-types', fullPath] : [fullPath];
  const res = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (res.status === 0) {
    passedSuites++;
  } else {
    failedSuites.push(file);
  }
}

console.log('\n============================================================');
if (failedSuites.length === 0) {
  console.log(`✅ All ${passedSuites} test suites passed!`);
  process.exit(0);
} else {
  console.error(`❌ ${failedSuites.length} of ${testFiles.length} test suites failed: ${failedSuites.join(', ')}`);
  process.exit(1);
}
