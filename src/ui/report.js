import chalk from 'chalk';
import Table from 'cli-table3';

const STATUS = {
  ok: chalk.green('✔ OK'),
  warn: chalk.yellow('⚠ WARN'),
  critical: chalk.red('✖ CRITICAL'),
  fixed: chalk.cyan('✔ FIXED'),
  skipped: chalk.dim('— SKIP'),
};

export function icon(status) {
  return STATUS[status] || chalk.dim('?');
}

export function bar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct >= 90 ? chalk.red : pct >= 70 ? chalk.yellow : chalk.green;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty)) + chalk.dim(` ${pct}%`);
}

export function printSectionHeader(title) {
  console.log('\n' + chalk.cyan.bold(`┌─ ${title} `) + chalk.cyan('─'.repeat(Math.max(0, 50 - title.length))));
}

export function printResult(label, value, status, detail = '') {
  const statusStr = icon(status);
  const detailStr = detail ? chalk.dim(`  (${detail})`) : '';
  console.log(chalk.cyan('│ ') + chalk.white(label.padEnd(22)) + value + '  ' + statusStr + detailStr);
}

export function printBar(label, pct) {
  console.log(chalk.cyan('│ ') + chalk.white(label.padEnd(22)) + bar(pct));
}

export function printSectionFooter() {
  console.log(chalk.cyan('└' + '─'.repeat(55)));
}

export function printSummary(results) {
  const table = new Table({
    head: [
      chalk.cyan.bold('Check'),
      chalk.cyan.bold('Status'),
      chalk.cyan.bold('Info'),
    ],
    style: { border: ['cyan'], head: [] },
    colWidths: [22, 14, 38],
  });

  for (const r of results) {
    table.push([
      chalk.white(r.name),
      icon(r.status),
      chalk.dim(r.info || ''),
    ]);
  }

  console.log('\n' + chalk.cyan.bold('  ═══ SUMMARY ═══'));
  console.log(table.toString());
}
