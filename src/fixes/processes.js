import { execSync } from 'child_process';
import os from 'os';
import chalk from 'chalk';

function killPid(pid) {
  try {
    if (os.platform() === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

export async function fixProcesses(processResults) {
  console.log(chalk.cyan('\n  [FIX] Killing zombie processes...'));

  const targets = processResults.filter(
    (r) => (r.status === 'critical' || r.status === 'warn') && r.pid && r.kind === 'zombie'
  );

  if (targets.length === 0) {
    console.log(chalk.green('  No zombie processes to kill.'));
    return [];
  }

  const fixed = [];
  for (const proc of targets) {
    process.stdout.write(chalk.dim(`  Killing ${proc.name} (PID ${proc.pid})... `));
    const ok = killPid(proc.pid);
    if (ok) {
      console.log(chalk.green('killed'));
      fixed.push({ name: proc.name, status: 'fixed', info: `PID ${proc.pid} killed` });
    } else {
      console.log(chalk.red('failed (may need admin)'));
    }
  }

  return fixed;
}
