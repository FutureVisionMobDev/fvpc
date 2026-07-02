import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024)        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024)               return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

// Absolute allowlist — only dirs inside these prefixes are ever cleared.
// Anything outside this list is NEVER touched, no matter what is passed in.
const SAFE_PREFIXES = [
  // Windows
  process.env.TEMP,
  process.env.TMP,
  path.join(os.homedir(), 'AppData', 'Local', 'Temp'),
  path.join(os.homedir(), 'AppData', 'Local', 'pip'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'npm-cache'),
  path.join(os.homedir(), 'AppData', 'Local', 'Yarn', 'Cache'),
  path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
  // macOS
  path.join(os.homedir(), 'Library', 'Caches'),
  path.join(os.homedir(), '.npm'),
  // Linux
  '/tmp',
  path.join(os.homedir(), '.cache', 'pip'),
  path.join(os.homedir(), '.npm'),
  '/var/lib/apt/lists',
].filter(Boolean).map(p => path.normalize(p));

function isSafeToDelete(dirPath) {
  const normalized = path.normalize(dirPath);
  return SAFE_PREFIXES.some(prefix => normalized === prefix || normalized.startsWith(prefix + path.sep));
}

function calcDirSize(p) {
  let total = 0;
  try {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(p, e.name);
      try {
        if (e.isDirectory()) total += calcDirSize(full);
        else total += fs.statSync(full).size;
      } catch {}
    }
  } catch {}
  return total;
}

async function deleteDirContents(dirPath, spinner, label) {
  let freed = 0;
  let count = 0;
  let skipped = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      try {
        // calculate real size (recursive for dirs) before deleting
        const size = entry.isDirectory() ? calcDirSize(full) : fs.statSync(full).size;

        if (entry.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
        freed += size;
        count++;
      } catch {
        skipped++;
      }

      // yield every 50 deletions so spinner animates
      if ((count + skipped) % 50 === 0) {
        if (spinner) spinner.text = chalk.dim(`Clearing ${label}... `) + chalk.cyan(`${count.toLocaleString()} deleted / ${formatSize(freed)} freed`);
        await new Promise((r) => setImmediate(r));
      }
    }
  } catch { /* dir gone or locked */ }

  return { freed, count, skipped };
}

export async function fixCache(cacheResults) {
  console.log(chalk.cyan('\n  [FIX] Clearing caches...\n'));

  // deduplicate by dir path — accumulated lastResults can have repeats
  const seen = new Set();
  const toFix = cacheResults.filter((r) => {
    if (r.status === 'ok' || !r.dir) return false;
    const key = path.normalize(r.dir);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (toFix.length === 0) {
    console.log(chalk.green('  Nothing to clear.\n'));
    return [];
  }

  let totalFreed = 0;
  const fixed = [];

  for (const item of toFix) {
    const dirNorm = path.normalize(item.dir);

    // Safety check — never touch dirs outside the allowlist
    if (!isSafeToDelete(dirNorm)) {
      console.log(chalk.yellow(`  ⚠ Skipping ${item.name} — not in safe allowlist (${item.dir})`));
      continue;
    }

    if (!fs.existsSync(dirNorm)) {
      console.log(chalk.dim(`  — ${item.name}: directory not found, skipping.`));
      continue;
    }

    const spinner = ora({
      text: chalk.dim(`Clearing ${item.name}...`),
      color: 'cyan',
      spinner: 'dots',
    }).start();

    const { freed, count, skipped } = await deleteDirContents(dirNorm, spinner, item.name);
    totalFreed += freed;

    spinner.stop();

    const detail = skipped > 0 ? chalk.dim(` (${skipped} locked/skipped)`) : '';
    console.log(
      chalk.cyan('  ✔ ') + chalk.white(item.name.padEnd(20)) +
      chalk.green(`freed ${formatSize(freed)}`) +
      chalk.dim(`  ${count.toLocaleString()} files`) +
      detail
    );

    fixed.push({ name: item.name, status: 'fixed', info: `freed ${formatSize(freed)}` });
  }

  if (fixed.length > 0) {
    console.log(chalk.green.bold(`\n  Total freed: ${formatSize(totalFreed)}\n`));
  } else {
    console.log(chalk.yellow('\n  No caches were cleared.\n'));
  }

  return fixed;
}
