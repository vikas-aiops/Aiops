'use strict';

// Minimal lint: syntax-check every source and test file with `node --check`.
const { execFileSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
}

let failed = 0;
for (const f of [...files('src'), ...files('test'), ...files('scripts')]) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`${f}\n${err.stderr}`);
  }
}
console.log(failed ? `${failed} file(s) failed` : 'syntax OK');
process.exit(failed ? 1 : 0);
