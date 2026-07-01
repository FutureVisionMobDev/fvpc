import si from 'systeminformation';
import chalk from 'chalk';
import { printSectionHeader, printResult, printBar, printSectionFooter } from '../ui/report.js';

export async function checkDisk() {
  printSectionHeader('DISK');

  const disks = await si.fsSize();
  const results = [];

  for (const disk of disks) {
    if (!disk.size) continue;
    const usedPct = Math.round((disk.used / disk.size) * 100);
    const freeGB = ((disk.size - disk.used) / 1e9).toFixed(1);
    const totalGB = (disk.size / 1e9).toFixed(1);

    let status = 'ok';
    if (usedPct >= 90) status = 'critical';
    else if (usedPct >= 75) status = 'warn';

    printBar(`${disk.fs} (${totalGB}GB)`, usedPct);
    printResult('  Free space', chalk.white(`${freeGB} GB`), status, `${usedPct}% used`);

    results.push({ name: `Disk ${disk.fs}`, status, info: `${freeGB}GB free of ${totalGB}GB`, usedPct, fs: disk.fs });
  }

  printSectionFooter();
  return results;
}
