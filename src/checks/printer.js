import chalk from 'chalk';
import { sh, ps, isWin, isMac } from '../utils/platform.js';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

async function runWin(results) {
  const out = await ps(
    'Get-Printer | Select-Object Name,PrinterStatus,DriverName | ConvertTo-Json -Compress',
    8000
  );
  if (!out) {
    printResult('Printers', chalk.dim('unable to query'), 'skipped');
    return;
  }
  try {
    let printers = JSON.parse(out);
    if (!Array.isArray(printers)) printers = [printers];

    if (printers.length === 0) {
      printResult('Printers', chalk.dim('none installed'), 'warn');
      results.push({ name: 'Printers', status: 'warn', info: 'no printers installed' });
      return;
    }

    // Default printer
    const defaultOut = await ps('(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name');
    if (defaultOut) {
      printResult('Default printer', chalk.white(defaultOut.slice(0, 30)), 'ok');
      results.push({ name: 'Default Printer', status: 'ok', info: defaultOut });
    }

    // List printers with status
    const STATUS_MAP = { 3: 'ok', 4: 'warn', 5: 'warn' }; // 3=Idle, 4=Printing, 5=Warming up
    for (const p of printers.slice(0, 6)) {
      const name = (p.Name || 'Unknown').slice(0, 28);
      const st = p.PrinterStatus;
      const stLabel = st === 3 ? 'Idle' : st === 4 ? 'Printing' : st === 5 ? 'Warming' : `Status:${st}`;
      const status = st === 3 ? 'ok' : st === 4 ? 'ok' : 'warn';
      printResult(name, chalk.white(stLabel), status);
      results.push({ name: `Printer: ${name}`, status, info: stLabel });
    }

    // Print queue — any stuck jobs?
    const queueOut = await ps(
      '$q = Get-PrintJob -PrinterName * -ErrorAction SilentlyContinue; if ($q) { $q.Count } else { 0 }',
      6000
    );
    const queueCount = parseInt(queueOut, 10) || 0;
    if (queueCount > 0) {
      printResult('Print queue', chalk.yellow(String(queueCount) + ' job(s)'), 'warn', 'check for stuck jobs');
      results.push({ name: 'Print Queue', status: 'warn', info: `${queueCount} job(s) pending` });
    } else {
      printResult('Print queue', chalk.white('empty'), 'ok');
    }
  } catch {
    // ConvertTo-Json gave single object or unexpected format
    const lines = out.split('\n').filter(l => l.trim());
    printResult('Printers found', chalk.white(String(lines.length)), 'ok');
    results.push({ name: 'Printers', status: 'ok', info: `${lines.length} printer(s)` });
  }
}

async function runMacLinux(results) {
  const out = await sh('lpstat -p 2>/dev/null');
  if (!out) {
    printResult('Printers (lpstat)', chalk.dim('none or CUPS not running'), 'warn');
    results.push({ name: 'Printers', status: 'warn', info: 'no printers via CUPS' });
    return;
  }

  const lines = out.split('\n').filter(l => /^printer /i.test(l));
  if (lines.length === 0) {
    printResult('Printers', chalk.dim('none installed'), 'warn');
    results.push({ name: 'Printers', status: 'warn', info: 'no printers installed' });
    return;
  }

  // Default printer
  const defaultOut = await sh('lpstat -d 2>/dev/null');
  if (defaultOut && !/no system default/i.test(defaultOut)) {
    const match = defaultOut.match(/:\s*(.+)$/);
    if (match) {
      printResult('Default printer', chalk.white(match[1].trim().slice(0, 30)), 'ok');
      results.push({ name: 'Default Printer', status: 'ok', info: match[1].trim() });
    }
  }

  for (const line of lines.slice(0, 6)) {
    // "printer NAME is idle."  or  "printer NAME disabled ..."
    const match = line.match(/^printer\s+(\S+)\s+(.+?)\.?\s*$/i);
    if (!match) continue;
    const name = match[1].slice(0, 28);
    const stateRaw = match[2].toLowerCase();
    const status = stateRaw.includes('idle') || stateRaw.includes('enabled') ? 'ok' : 'warn';
    const stLabel = stateRaw.slice(0, 20);
    printResult(name, chalk.white(stLabel), status);
    results.push({ name: `Printer: ${name}`, status, info: stLabel });
  }

  // Pending jobs
  const jobsOut = await sh('lpstat -o 2>/dev/null | wc -l | xargs');
  const jobCount = parseInt(jobsOut, 10) || 0;
  if (jobCount > 0) {
    printResult('Print queue', chalk.yellow(String(jobCount) + ' job(s)'), 'warn', 'check for stuck jobs');
    results.push({ name: 'Print Queue', status: 'warn', info: `${jobCount} job(s) pending` });
  } else {
    printResult('Print queue', chalk.white('empty'), 'ok');
  }
}

export async function checkPrinter() {
  printSectionHeader('PRINTERS');
  const results = [];
  if (isWin) await runWin(results);
  else       await runMacLinux(results);
  printSectionFooter();
  return results;
}
