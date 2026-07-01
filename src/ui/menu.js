import inquirer from 'inquirer';
import chalk from 'chalk';

const CHECKS = [
  { name: `${chalk.green('💾 Disk')}         — free space & usage per drive`, value: 'disk', checked: true },
  { name: `${chalk.cyan('🧠 Memory')}       — RAM & swap usage`, value: 'memory', checked: true },
  { name: `${chalk.blue('🌐 Network')}      — connectivity & dropped packets`, value: 'network', checked: true },
  { name: `${chalk.yellow('🗂  Cache')}        — temp, browser, npm, pip caches`, value: 'cache', checked: true },
  { name: `${chalk.magenta('⚙  Processes')}    — zombie & high CPU/MEM procs`, value: 'processes', checked: true },
  { name: `${chalk.red('🔥 CPU')}          — load, speed, temp, per-core`, value: 'cpu', checked: true },
  { name: `${chalk.green('🔋 Battery')}      — level, health, cycle count`, value: 'battery', checked: false },
  { name: `${chalk.white('⚡ Speed Test')}   — download / upload / ping (slow ~20s)`, value: 'speed', checked: false },
];

export async function showMenu() {
  console.log(chalk.cyan.bold('\n  What would you like to check?\n'));
  console.log(chalk.dim('  Use SPACE to toggle, A to select all, ENTER to run\n'));

  const { checks } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'checks',
      message: chalk.white('Select checks to run:'),
      choices: CHECKS,
      pageSize: 10,
      loop: false,
    },
  ]);

  if (checks.length === 0) {
    console.log(chalk.yellow('\n  Nothing selected. Exiting.\n'));
    process.exit(0);
  }

  const { applyFix } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'applyFix',
      message: chalk.white('Auto-fix issues found?'),
      default: false,
    },
  ]);

  console.log('');
  return { checks, applyFix };
}
