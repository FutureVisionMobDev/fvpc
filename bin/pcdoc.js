#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { isFirstRun, markInitialized } from '../src/utils/firstRun.js';
import { renderWelcome } from '../src/ui/welcome.js';
import { printSummary } from '../src/ui/report.js';
import { startShell } from '../src/ui/shell.js';

import { checkDisk } from '../src/checks/disk.js';
import { checkMemory } from '../src/checks/memory.js';
import { checkNetwork } from '../src/checks/network.js';
import { checkCache } from '../src/checks/cache.js';
import { checkProcesses } from '../src/checks/processes.js';
import { checkCpu } from '../src/checks/cpu.js';
import { checkBattery } from '../src/checks/battery.js';
import { checkSpeed } from '../src/checks/speed.js';

import { fixCache } from '../src/fixes/cache.js';
import { fixProcesses } from '../src/fixes/processes.js';
import { fixDisk } from '../src/fixes/disk.js';

const RUNNERS = {
  disk: checkDisk,
  memory: checkMemory,
  network: checkNetwork,
  cache: checkCache,
  processes: checkProcesses,
  cpu: checkCpu,
  battery: checkBattery,
  speed: checkSpeed,
};

const ALL_NON_INTERACTIVE = ['disk', 'memory', 'network', 'cache', 'processes', 'cpu', 'battery'];

const program = new Command();

program
  .name('pcdoc')
  .description('PC Doctor — health check and auto-fix CLI for your machine')
  .version('1.0.0')
  .option('--fix',        'auto-fix issues (use with other flags)')
  .option('--all',        'run all checks non-interactively')
  .option('--disk',       'check disk')
  .option('--memory',     'check memory')
  .option('--network',    'check network')
  .option('--cache',      'check cache')
  .option('--processes',  'check processes')
  .option('--cpu',        'check CPU')
  .option('--battery',    'check battery')
  .option('--speed',      'run speed test')
  .option('--no-welcome', 'skip welcome banner')
  .addHelpText('after', `
How to use:
  pcdoc                  open interactive shell (type commands inside)
  pcdoc --all            run all checks, print summary, exit
  pcdoc --disk --cpu     run specific checks, exit
  pcdoc --all --fix      run all + auto-fix, exit

Inside the shell:
  check disk / memory / network / cache / processes / cpu / battery / speed
  check all   run all checks one by one
  fix         auto-fix issues from last scan
  summary     reprint last scan summary
  clear       clear screen
  help        show command list
  exit        quit
`)
  .action(async (opts) => {
    const firstRun = isFirstRun();

    if (opts.welcome !== false) {
      renderWelcome();
      if (firstRun) markInitialized();
    }

    const specificFlags = ['disk', 'memory', 'network', 'cache', 'processes', 'cpu', 'battery', 'speed'];
    const hasSpecific = opts.all || specificFlags.some((f) => opts[f]);

    // No flags → open interactive shell
    if (!hasSpecific) {
      await startShell();
      return;
    }

    // Flags provided → run non-interactively
    const toRun = opts.all
      ? ALL_NON_INTERACTIVE
      : specificFlags.filter((f) => opts[f]);

    let allResults = [];

    for (const name of toRun) {
      const spin = ora({
        text: chalk.dim(`Checking ${name}...`),
        color: 'cyan',
        spinner: 'dots',
      }).start();
      await new Promise((r) => setTimeout(r, 150));
      spin.stop();

      try {
        allResults = allResults.concat(await RUNNERS[name]());
      } catch (err) {
        console.error(chalk.red(`  ${name} error: `) + err.message);
      }
    }

    printSummary(allResults);

    const issues = allResults.filter((r) => r.status === 'warn' || r.status === 'critical');

    if (issues.length === 0) {
      console.log(chalk.green.bold('\n  All systems healthy!\n'));
      return;
    }

    console.log(chalk.yellow(`\n  Found ${issues.length} issue(s).`));

    if (opts.fix) {
      console.log(chalk.cyan('  Running fixes...\n'));
      const cacheIssues = allResults.filter((r) => r.dir);
      const procIssues  = allResults.filter((r) => r.pid);
      const diskIssues  = allResults.filter((r) => r.fs);
      let fixed = [];
      if (cacheIssues.length) fixed = fixed.concat(await fixCache(cacheIssues));
      if (procIssues.length)  fixed = fixed.concat(await fixProcesses(procIssues));
      if (diskIssues.length)  fixed = fixed.concat(await fixDisk(diskIssues));
      if (fixed.length === 0) {
        console.log(chalk.yellow('  No automatic fixes applied.\n'));
      } else {
        console.log(chalk.green.bold(`  Fixed ${fixed.length} item(s).\n`));
      }
    } else {
      console.log(chalk.dim('  Tip: rerun with --fix to auto-fix, or open the shell and type fix.\n'));
    }
  });

program.parse(process.argv);
