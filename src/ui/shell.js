import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { printSummary } from './report.js';
import { fixCache } from '../fixes/cache.js';
import { fixProcesses } from '../fixes/processes.js';
import { fixDisk } from '../fixes/disk.js';
import { checkForUpdate, printUpdateNotice, runUpdate, getLocalVersion } from '../utils/updater.js';

const CHECK_MAP = {
  disk:      { label: 'Disk',           fn: () => import('../checks/disk.js').then(m => m.checkDisk()) },
  memory:    { label: 'Memory',         fn: () => import('../checks/memory.js').then(m => m.checkMemory()) },
  network:   { label: 'Network',        fn: () => import('../checks/network.js').then(m => m.checkNetwork()) },
  cache:     { label: 'Cache',          fn: () => import('../checks/cache.js').then(m => m.checkCache()) },
  processes: { label: 'Processes',      fn: () => import('../checks/processes.js').then(m => m.checkProcesses()) },
  cpu:       { label: 'CPU',            fn: () => import('../checks/cpu.js').then(m => m.checkCpu()) },
  battery:   { label: 'Battery',        fn: () => import('../checks/battery.js').then(m => m.checkBattery()) },
  speed:     { label: 'Speed Test',     fn: () => import('../checks/speed.js').then(m => m.checkSpeed()) },
  windows:   { label: 'Windows/macOS/Linux OS', fn: () => import('../checks/windows.js').then(m => m.checkWindows()) },
  email:     { label: 'Email/Outlook',          fn: () => import('../checks/email.js').then(m => m.checkEmail()) },
  smb:       { label: 'SMB/Cloud',              fn: () => import('../checks/smb.js').then(m => m.checkSmb()) },
  adobe:     { label: 'Adobe/CC',               fn: () => import('../checks/adobe.js').then(m => m.checkAdobe()) },
  accounts:  { label: 'Accounts',               fn: () => import('../checks/accounts.js').then(m => m.checkAccounts()) },
  printer:   { label: 'Printers',               fn: () => import('../checks/printer.js').then(m => m.checkPrinter()) },
  vpn:       { label: 'VPN',                    fn: () => import('../checks/vpn.js').then(m => m.checkVpn()) },
  firewall:  { label: 'Firewall/Security',      fn: () => import('../checks/firewall.js').then(m => m.checkFirewall()) },
};

const ALL_CHECKS = ['disk', 'memory', 'network', 'cache', 'processes', 'cpu', 'battery'];

function printHelp() {
  const row = (cmd, desc) =>
    '  ' + chalk.cyan(cmd.padEnd(28)) + chalk.dim(desc);

  console.log('\n' + chalk.cyan.bold('  ┌─ COMMANDS ──────────────────────────────────────┐'));
  console.log(row('check <name>',          'run one check'));
  console.log(row('check all',             'run all standard checks one by one'));
  console.log(row('fix',                   'auto-fix last scan issues'));
  console.log(row('summary',               'reprint last scan summary'));
  console.log(row('update',                'check for & install latest version'));
  console.log(row('version',               'show current version'));
  console.log(row('clear',                 'clear the screen'));
  console.log(row('help',                  'show this list'));
  console.log(row('exit  /  quit',         'leave PC Doctor'));
  console.log(chalk.cyan('  └─────────────────────────────────────────────────┘'));

  console.log('\n' + chalk.cyan.bold('  ┌─ AVAILABLE CHECKS ──────────────────────────────┐'));
  for (const [key, { label }] of Object.entries(CHECK_MAP)) {
    console.log('  ' + chalk.yellow(key.padEnd(12)) + chalk.dim(label));
  }
  console.log(chalk.cyan('  └─────────────────────────────────────────────────┘\n'));
}

async function runCheck(name, lastResults) {
  const entry = CHECK_MAP[name];
  if (!entry) {
    console.log(chalk.red(`  Unknown check: "${name}". Type help to see available checks.\n`));
    return lastResults;
  }

  const spin = ora({
    text: chalk.dim(`Checking ${entry.label}...`),
    color: 'cyan',
    spinner: 'dots',
  }).start();

  await new Promise((r) => setTimeout(r, 200));
  spin.stop();

  try {
    const results = await entry.fn();
    return [...lastResults, ...results];
  } catch (err) {
    console.log(chalk.red(`  Error: ${err.message}\n`));
    return lastResults;
  }
}

async function runAllChecks() {
  let results = [];
  for (const name of ALL_CHECKS) {
    const entry = CHECK_MAP[name];
    const spin = ora({
      text: chalk.dim(`Checking ${entry.label}...`),
      color: 'cyan',
      spinner: 'dots',
    }).start();
    await new Promise((r) => setTimeout(r, 150));
    spin.stop();

    try {
      const r = await entry.fn();
      results = [...results, ...r];
    } catch (err) {
      console.log(chalk.red(`  ${entry.label} error: ${err.message}`));
    }
  }
  return results;
}

async function runFix(lastResults) {
  if (lastResults.length === 0) {
    console.log(chalk.yellow('  No scan results yet. Run a check first.\n'));
    return;
  }

  const issues = lastResults.filter((r) => r.status === 'warn' || r.status === 'critical');
  if (issues.length === 0) {
    console.log(chalk.green('  No issues to fix.\n'));
    return;
  }

  console.log(chalk.cyan(`\n  Fixing ${issues.length} issue(s)...\n`));

  const cacheIssues = lastResults.filter((r) => r.dir);
  const procIssues  = lastResults.filter((r) => r.pid);
  const diskIssues  = lastResults.filter((r) => r.fs);

  let fixed = [];
  if (cacheIssues.length) fixed = fixed.concat(await fixCache(cacheIssues));
  if (procIssues.length)  fixed = fixed.concat(await fixProcesses(procIssues));
  if (diskIssues.length)  fixed = fixed.concat(await fixDisk(diskIssues));

  if (fixed.length === 0) {
    console.log(chalk.yellow('  No automatic fixes were applied.\n'));
  } else {
    console.log(chalk.green.bold(`\n  Fixed ${fixed.length} item(s). Run check all to verify.\n`));
  }
  return fixed;
}

export async function startShell() {
  printHelp();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('pcdoc') + chalk.dim(' › ') ,
    completer: (line) => {
      const completions = [
        'check disk', 'check memory', 'check network', 'check cache',
        'check processes', 'check cpu', 'check battery', 'check speed',
        'check windows', 'check email', 'check smb', 'check adobe', 'check accounts',
        'check printer', 'check vpn', 'check firewall',
        'check all', 'fix', 'summary', 'update', 'version', 'clear', 'help', 'exit', 'quit',
      ];
      const hits = completions.filter((c) => c.startsWith(line));
      return [hits.length ? hits : completions, line];
    },
  });

  rl.prompt();

  let lastResults = [];

  rl.on('line', async (raw) => {
    const input = raw.trim().toLowerCase();
    if (!input) { rl.prompt(); return; }

    if (input === 'exit' || input === 'quit') {
      console.log(chalk.cyan('\n  Goodbye! Stay healthy.\n'));
      rl.close();
      process.exit(0);
    }

    if (input === 'help') {
      printHelp();
      rl.prompt();
      return;
    }

    if (input === 'clear') {
      console.clear();
      rl.prompt();
      return;
    }

    if (input === 'summary') {
      if (lastResults.length === 0) {
        console.log(chalk.yellow('  No scan results yet. Run a check first.\n'));
      } else {
        printSummary(lastResults);
      }
      rl.prompt();
      return;
    }

    if (input === 'version') {
      console.log(chalk.cyan(`\n  pcdoc v${getLocalVersion()}\n`));
      rl.prompt();
      return;
    }

    if (input === 'update') {
      rl.pause();
      await runUpdate();
      rl.resume();
      rl.prompt();
      return;
    }

    if (input === 'fix') {
      rl.pause();
      await runFix(lastResults);
      lastResults = []; // reset so fix doesn't re-run on stale results
      rl.resume();
      rl.prompt();
      return;
    }

    if (input === 'check all') {
      rl.pause();
      lastResults = await runAllChecks();
      printSummary(lastResults);
      const issues = lastResults.filter((r) => r.status === 'warn' || r.status === 'critical');
      if (issues.length > 0) {
        console.log(chalk.yellow(`\n  ${issues.length} issue(s) found. Type fix to auto-fix.\n`));
      } else {
        console.log(chalk.green.bold('\n  All systems healthy!\n'));
      }
      rl.resume();
      rl.prompt();
      return;
    }

    if (input.startsWith('check ')) {
      const name = input.slice(6).trim();
      rl.pause();
      lastResults = await runCheck(name, lastResults);
      const issues = lastResults.filter((r) => r.status === 'warn' || r.status === 'critical');
      if (issues.length > 0) {
        console.log(chalk.dim(`\n  ${issues.length} issue(s) so far. Type summary or fix.\n`));
      }
      rl.resume();
      rl.prompt();
      return;
    }

    console.log(chalk.red(`  Unknown command: "${input}". Type help.\n`));
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.cyan('\n  Goodbye!\n'));
    process.exit(0);
  });
}
