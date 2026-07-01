import si from 'systeminformation';
import chalk from 'chalk';
import { printSectionHeader, printResult, printBar, printSectionFooter } from '../ui/report.js';

export async function checkCpu() {
  printSectionHeader('CPU');

  const [cpu, speed, temp, load] = await Promise.all([
    si.cpu(),
    si.cpuCurrentSpeed(),
    si.cpuTemperature().catch(() => ({ main: null, cores: [] })),
    si.currentLoad(),
  ]);

  // Basic info
  printResult('Model', chalk.white(`${cpu.manufacturer} ${cpu.brand}`), 'ok');
  printResult('Cores', chalk.white(`${cpu.physicalCores} physical / ${cpu.cores} logical`), 'ok');

  // Clock speed
  const ghz = speed.avg ? speed.avg.toFixed(2) : (cpu.speed || '?');
  const maxGhz = cpu.speedMax || cpu.speed;
  printResult('Clock speed', chalk.white(`${ghz} GHz`), 'ok', `max ${maxGhz} GHz`);

  // Load
  const loadPct = Math.round(load.currentLoad || 0);
  let loadStatus = 'ok';
  if (loadPct >= 90) loadStatus = 'critical';
  else if (loadPct >= 70) loadStatus = 'warn';
  printBar(`CPU Load`, loadPct);
  printResult('  Avg load', chalk.white(`${loadPct}%`), loadStatus);

  // Temperature
  const results = [
    { name: 'CPU Load', status: loadStatus, info: `${loadPct}%` },
  ];

  if (temp.main !== null && temp.main !== undefined && temp.main > 0) {
    const t = temp.main;
    let tempStatus = 'ok';
    if (t >= 90) tempStatus = 'critical';
    else if (t >= 75) tempStatus = 'warn';
    const bar = t >= 90 ? chalk.red : t >= 75 ? chalk.yellow : chalk.green;
    printResult('Temperature', bar(`${t}°C`), tempStatus);
    results.push({ name: 'CPU Temp', status: tempStatus, info: `${t}°C` });
  } else {
    printResult('Temperature', chalk.dim('N/A'), 'skipped', 'sensor not accessible');
  }

  // Per-core load (first 8)
  if (load.cpus && load.cpus.length > 0) {
    const cores = load.cpus.slice(0, 8);
    const coreStr = cores
      .map((c, i) => `C${i}:${Math.round(c.load)}%`)
      .join('  ');
    printResult('Per-core', chalk.dim(coreStr), 'ok');
  }

  printSectionFooter();
  return results;
}
