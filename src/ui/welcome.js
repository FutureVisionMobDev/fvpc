import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import os from 'os';

export function renderWelcome() {
  const banner = figlet.textSync('FVPC', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
  });

  const lines = [
    chalk.cyan.bold(banner),
    '',
    '  ' + chalk.green('▶') + '  ' + chalk.white('Future Vision PC — health check & auto-fix CLI'),
    '  ' + chalk.green('▶') + '  ' + chalk.white('Disk · Memory · Network · Cache · CPU · Processes'),
    '  ' + chalk.green('▶') + '  ' + chalk.white('Email · SMB · Adobe · OS · Accounts · Printer · VPN · Firewall'),
    '  ' + chalk.green('▶') + '  ' + chalk.white('Fixes issues automatically with ') + chalk.yellow('--fix'),
    '',
    chalk.dim('  Run ') + chalk.cyan('fvpc --help') + chalk.dim(' to see all commands'),
    '',
    chalk.dim('  ─────────────────────────────────────────────────────'),
    '  ' + chalk.dim('Made by ') + chalk.cyan.bold('CyrsTrstn') + chalk.dim('  ·  Future Vision Mobile Dev'),
  ].join('\n');

  console.log(
    boxen(lines, {
      padding: { top: 1, bottom: 1, left: 2, right: 2 },
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
    })
  );

  const meta =
    chalk.dim('  Host: ') + chalk.white(os.hostname()) +
    chalk.dim('   OS: ') + chalk.white(`${os.type()} ${os.release()}`) +
    chalk.dim('   Uptime: ') + chalk.white(formatUptime(os.uptime()));

  console.log(meta + '\n');
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
