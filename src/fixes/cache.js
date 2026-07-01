import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

function deleteDirContents(dirPath) {
  let freed = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      try {
        const stat = fs.statSync(full);
        freed += stat.size;
        if (entry.isDirectory()) fs.rmSync(full, { recursive: true, force: true });
        else fs.unlinkSync(full);
      } catch {}
    }
  } catch {}
  return freed;
}

export async function fixCache(cacheResults) {
  console.log(chalk.cyan('\n  [FIX] Clearing caches...'));
  let totalFreed = 0;

  const toFix = cacheResults.filter((r) => r.status !== 'ok' && r.dir);
  if (toFix.length === 0) {
    console.log(chalk.green('  Nothing to clear.'));
    return [];
  }

  const fixed = [];
  for (const item of toFix) {
    process.stdout.write(chalk.dim(`  Clearing ${item.name}... `));
    const freed = deleteDirContents(item.dir);
    totalFreed += freed;
    console.log(chalk.green(`freed ${(freed / 1e6).toFixed(1)} MB`));
    fixed.push({ name: item.name, status: 'fixed', info: `freed ${(freed / 1e6).toFixed(1)} MB` });
  }

  console.log(chalk.green.bold(`\n  Total freed: ${(totalFreed / 1e9).toFixed(2)} GB`));
  return fixed;
}
