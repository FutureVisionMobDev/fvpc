import { execSync } from 'child_process';
import os from 'os';
import chalk from 'chalk';

export async function fixDisk(diskResults) {
  console.log(chalk.cyan('\n  [FIX] Attempting disk cleanup...'));

  const critical = diskResults.filter((r) => r.status === 'critical' || r.status === 'warn');
  if (critical.length === 0) {
    console.log(chalk.green('  Disk usage is fine, nothing to do.'));
    return [];
  }

  const fixed = [];

  if (os.platform() === 'win32') {
    try {
      execSync('cleanmgr /sagerun:1', { stdio: 'ignore', timeout: 30000 });
      console.log(chalk.green('  Windows Disk Cleanup triggered.'));
      fixed.push({ name: 'Disk Cleanup', status: 'fixed', info: 'cleanmgr ran' });
    } catch {
      console.log(chalk.yellow('  cleanmgr not pre-configured. Run cleanmgr /sageset:1 first.'));
    }

    try {
      execSync('PowerShell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
      console.log(chalk.green('  Recycle Bin emptied.'));
      fixed.push({ name: 'Recycle Bin', status: 'fixed', info: 'emptied' });
    } catch {}
  } else if (os.platform() === 'linux') {
    try {
      execSync('apt-get clean -y', { stdio: 'ignore' });
      console.log(chalk.green('  apt cache cleaned.'));
      fixed.push({ name: 'apt cache', status: 'fixed', info: 'cleaned' });
    } catch {}
    try {
      execSync('journalctl --vacuum-time=7d', { stdio: 'ignore' });
      console.log(chalk.green('  journalctl vacuumed (7d).'));
      fixed.push({ name: 'journalctl', status: 'fixed', info: 'vacuumed 7d' });
    } catch {}
  } else if (os.platform() === 'darwin') {
    try {
      execSync('sudo periodic daily', { stdio: 'ignore' });
      fixed.push({ name: 'macOS periodic', status: 'fixed', info: 'daily ran' });
    } catch {}
  }

  return fixed;
}
