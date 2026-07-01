import si from 'systeminformation';
import chalk from 'chalk';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

const ZOMBIE_STATES = ['zombie', 'stopped', 'dead'];
const HIGH_CPU_THRESHOLD = 25;
const HIGH_MEM_THRESHOLD = 20;

export async function checkProcesses() {
  printSectionHeader('PROCESSES');

  const { list } = await si.processes();
  const results = [];

  const cpuHogs = list
    .filter((p) => p.cpu > HIGH_CPU_THRESHOLD)
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 5);

  if (cpuHogs.length > 0) {
    printResult('High CPU procs', chalk.yellow(`${cpuHogs.length} found`), 'warn');
    for (const p of cpuHogs) {
      printResult(`  ${p.name.slice(0, 18)}`, chalk.white(`${p.cpu.toFixed(1)}% CPU`), 'warn', `PID ${p.pid}`);
      results.push({ name: `Proc: ${p.name}`, status: 'warn', info: `${p.cpu.toFixed(1)}% CPU`, pid: p.pid, kind: 'cpu' });
    }
  } else {
    printResult('High CPU procs', chalk.white('none'), 'ok');
  }

  const memHogs = list
    .filter((p) => p.memRss > 0 && p.mem > HIGH_MEM_THRESHOLD)
    .sort((a, b) => b.mem - a.mem)
    .slice(0, 5);

  if (memHogs.length > 0) {
    printResult('High MEM procs', chalk.yellow(`${memHogs.length} found`), 'warn');
    for (const p of memHogs) {
      const memMB = (p.memRss / 1e6).toFixed(0);
      printResult(`  ${p.name.slice(0, 18)}`, chalk.white(`${p.mem.toFixed(1)}% MEM`), 'warn', `PID ${p.pid}, ${memMB}MB`);
      results.push({ name: `Proc: ${p.name}`, status: 'warn', info: `${p.mem.toFixed(1)}% MEM`, pid: p.pid, kind: 'mem' });
    }
  } else {
    printResult('High MEM procs', chalk.white('none'), 'ok');
  }

  const zombies = list.filter((p) => ZOMBIE_STATES.includes((p.state || '').toLowerCase()));
  if (zombies.length > 0) {
    printResult('Zombie procs', chalk.red(`${zombies.length} found`), 'critical');
    for (const p of zombies) {
      printResult(`  ${p.name.slice(0, 18)}`, chalk.red(p.state), 'critical', `PID ${p.pid}`);
      results.push({ name: `Zombie: ${p.name}`, status: 'critical', info: `state=${p.state}`, pid: p.pid, kind: 'zombie' });
    }
  } else {
    printResult('Zombie procs', chalk.white('none'), 'ok');
  }

  const total = list.length;
  printResult('Total processes', chalk.white(String(total)), total > 300 ? 'warn' : 'ok');

  printSectionFooter();
  return results;
}
