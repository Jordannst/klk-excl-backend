import { setTimeout as sleep } from 'node:timers/promises';

const [healthUrl, expectedCommit, timeout = '300'] = process.argv.slice(2);
const fullSha = /^[0-9a-f]{40}$/;
const timeoutSeconds = Number(timeout);
if (!URL.canParse(healthUrl) || !fullSha.test(expectedCommit) ||
    !Number.isSafeInteger(timeoutSeconds) || timeoutSeconds < 1) {
  console.error('Usage: node verify-release.mjs <health-url> <full-commit-sha> [timeout-seconds]');
  process.exit(2);
}

const deadline = performance.now() + timeoutSeconds * 1000;
let lastResult = 'no response';

while (performance.now() < deadline) {
  const remaining = Math.max(1, Math.ceil(deadline - performance.now()));
  try {
    const response = await fetch(healthUrl, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(Math.min(remaining, 5000)),
    });
    lastResult = `HTTP ${response.status}`;
    if (response.status === 200) {
      const health = await response.json();
      const commit = fullSha.test(health?.commit) ? health.commit : 'unknown';
      const db = health?.db === 'up' ? 'up' : 'unavailable';
      lastResult += ` commit=${commit} db=${db}`;
      if (commit === expectedCommit && db === 'up' && health.status === 'ok') {
        console.log(`Release verified: ${lastResult}`);
        process.exit(0);
      }
    } else {
      await response.body?.cancel();
    }
  } catch (error) {
    lastResult = `Health request failed: ${error.name}`;
  }

  console.log(`Waiting for ${expectedCommit}: ${lastResult}`);
  await sleep(Math.min(10000, Math.max(0, deadline - performance.now())));
}

console.error(`Timed out waiting for ${expectedCommit}. Last result: ${lastResult}`);
process.exitCode = 1;
