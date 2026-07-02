#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { isFirstRun, markInitialized } from '../src/utils/firstRun.js';
import { renderWelcome } from '../src/ui/welcome.js';
import { printSummary } from '../src/ui/report.js';
import { startShell } from '../src/ui/shell.js';
import { checkForUpdate, printUpdateNotice, runUpdate } from '../src/utils/updater.js';

import { checkDisk } from '../src/checks/disk.js';
import { checkMemory } from '../src/checks/memory.js';
import { checkNetwork } from '../src/checks/network.js';
import { checkCache } from '../src/checks/cache.js';
import { checkProcesses } from '../src/checks/processes.js';
import { checkCpu } from '../src/checks/cpu.js';
import { checkBattery } from '../src/checks/battery.js';
import { checkSpeed } from '../src/checks/speed.js';
import { checkWindows } from '../src/checks/windows.js';
import { checkEmail } from '../src/checks/email.js';
import { checkSmb } from '../src/checks/smb.js';
import { checkAdobe } from '../src/checks/adobe.js';
import { checkAccounts } from '../src/checks/accounts.js';
import { checkPrinter } from '../src/checks/printer.js';
import { checkVpn } from '../src/checks/vpn.js';
import { checkFirewall } from '../src/checks/firewall.js';

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
  windows: checkWindows,
  email: checkEmail,
  smb: checkSmb,
  adobe: checkAdobe,
  accounts: checkAccounts,
  printer: checkPrinter,
  vpn: checkVpn,
  firewall: checkFirewall,
};

const ALL_NON_INTERACTIVE = ['disk', 'memory', 'network', 'cache', 'processes', 'cpu', 'battery', 'windows', 'email', 'smb', 'adobe', 'accounts', 'printer', 'vpn', 'firewall'];

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
  .option('--windows',    'check Windows OS health (version, activation, updates)')
  .option('--email',      'check email / Outlook connectivity')
  .option('--smb',        'check SMB mapped drives & cloud sync')
  .option('--adobe',      'check Adobe CC license & process')
  .option('--accounts',   'check user account, domain, GP, credentials')
  .option('--printer',    'check printers and print queue')
  .option('--vpn',        'check VPN connections and tunnel adapters')
  .option('--firewall',   'check firewall status and AV/Defender')
  .option('--update',     'update pcdoc to the latest version from GitHub')
  .option('--no-welcome', 'skip welcome banner')
  .addHelpText('after', `
How to use:
  pcdoc                  open interactive shell (type commands inside)
  pcdoc --all            run all checks, print summary, exit
  pcdoc --disk --cpu     run specific checks, exit
  pcdoc --all --fix      run all + auto-fix, exit
  pcdoc --windows        check Windows OS health
  pcdoc --email          check Outlook / email ports
  pcdoc --smb            check mapped drives & OneDrive
  pcdoc --adobe          check Adobe CC license & service
  pcdoc --accounts       check domain, profile, credentials
  pcdoc --update         update to latest version from GitHub

Inside the shell:
  check disk / memory / network / cache / processes / cpu / battery / speed
  check windows / email / smb / adobe / accounts
  check all   run all checks one by one
  fix         auto-fix issues from last scan
  summary     reprint last scan summary
  clear       clear screen
  help        show command list
  exit        quit
`)
  .action(async (opts) => {
    // Handle update immediately, before anything else
    if (opts.update) {
      await runUpdate();
      process.exit(0);
    }

    const firstRun = isFirstRun();

    if (opts.welcome !== false) {
      renderWelcome();
      if (firstRun) markInitialized();
      // Async update check — runs in background, prints notice after banner
      checkForUpdate().then(printUpdateNotice).catch(() => {});
    }

    const specificFlags = ['disk', 'memory', 'network', 'cache', 'processes', 'cpu', 'battery', 'speed', 'windows', 'email', 'smb', 'adobe', 'accounts', 'printer', 'vpn', 'firewall'];
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
