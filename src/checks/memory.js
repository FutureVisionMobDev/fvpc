import si from 'systeminformation';
import chalk from 'chalk';
import { printSectionHeader, printResult, printBar, printSectionFooter } from '../ui/report.js';

export async function checkMemory() {
  printSectionHeader('MEMORY');

  const mem = await si.mem();
  const totalGB = (mem.total / 1e9).toFixed(1);
  const usedGB = (mem.active / 1e9).toFixed(1);
  const freeGB = ((mem.total - mem.active) / 1e9).toFixed(1);
  const usedPct = Math.round((mem.active / mem.total) * 100);

  const swapUsedPct =
    mem.swaptotal > 0 ? Math.round((mem.swapused / mem.swaptotal) * 100) : 0;

  let ramStatus = 'ok';
  if (usedPct >= 90) ramStatus = 'critical';
  else if (usedPct >= 75) ramStatus = 'warn';

  let swapStatus = 'ok';
  if (swapUsedPct >= 50) swapStatus = 'warn';
  if (swapUsedPct >= 80) swapStatus = 'critical';

  printBar(`RAM (${totalGB}GB)`, usedPct);
  printResult('  Used', chalk.white(`${usedGB} GB`), ramStatus, `${freeGB}GB free`);

  if (mem.swaptotal > 0) {
    const swapTotalGB = (mem.swaptotal / 1e9).toFixed(1);
    printBar(`Swap (${swapTotalGB}GB)`, swapUsedPct);
    printResult('  Swap status', chalk.white(`${swapUsedPct}%`), swapStatus);
  }

  printSectionFooter();

  return [
    { name: 'RAM', status: ramStatus, info: `${usedGB}GB / ${totalGB}GB (${usedPct}%)`, usedPct },
    ...(mem.swaptotal > 0
      ? [{ name: 'Swap', status: swapStatus, info: `${swapUsedPct}% used` }]
      : []),
  ];
}
