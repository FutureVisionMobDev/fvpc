import si from 'systeminformation';
import chalk from 'chalk';
import { printSectionHeader, printResult, printBar, printSectionFooter } from '../ui/report.js';

export async function checkBattery() {
  printSectionHeader('BATTERY');

  let bat;
  try {
    bat = await si.battery();
  } catch {
    bat = { hasBattery: false };
  }

  const results = [];

  if (!bat.hasBattery) {
    printResult('Battery', chalk.dim('No battery (desktop)'), 'skipped');
    printSectionFooter();
    return [{ name: 'Battery', status: 'skipped', info: 'no battery / desktop' }];
  }

  const pct = bat.percent ?? 0;
  const charging = bat.isCharging;
  const acConnected = bat.acConnected;

  let status = 'ok';
  if (!charging && pct <= 10) status = 'critical';
  else if (!charging && pct <= 25) status = 'warn';

  const chargingStr = charging ? chalk.cyan(' ⚡ charging') : chalk.dim(' (on battery)');
  printBar('Battery', pct);
  printResult('  Level', chalk.white(`${pct}%`) + chargingStr, status);

  if (bat.timeRemaining && bat.timeRemaining > 0 && !charging) {
    const h = Math.floor(bat.timeRemaining / 60);
    const m = bat.timeRemaining % 60;
    printResult('  Time remaining', chalk.white(`${h}h ${m}m`), pct < 20 ? 'warn' : 'ok');
  }

  if (bat.voltage) {
    printResult('  Voltage', chalk.white(`${bat.voltage.toFixed(2)} V`), 'ok');
  }

  if (bat.cycleCount) {
    const cycleStatus = bat.cycleCount > 800 ? 'warn' : 'ok';
    printResult('  Cycle count', chalk.white(String(bat.cycleCount)), cycleStatus,
      bat.cycleCount > 800 ? 'battery may degrade soon' : '');
  }

  if (bat.maxCapacity && bat.designedCapacity) {
    const health = Math.round((bat.maxCapacity / bat.designedCapacity) * 100);
    const healthStatus = health < 60 ? 'critical' : health < 80 ? 'warn' : 'ok';
    printResult('  Health', chalk.white(`${health}%`), healthStatus);
    results.push({ name: 'Battery Health', status: healthStatus, info: `${health}% capacity` });
  }

  results.push({ name: 'Battery', status, info: `${pct}%${charging ? ' charging' : ''}` });
  printSectionFooter();
  return results;
}
