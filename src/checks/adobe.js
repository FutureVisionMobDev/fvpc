import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { sh, ps, isWin, isMac } from '../utils/platform.js';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

function dirSizeMB(dirPath) {
  let total = 0;
  try {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        try {
          if (e.isDirectory()) walk(full);
          else total += fs.statSync(full).size;
        } catch { /* locked */ }
      }
    };
    walk(dirPath);
  } catch { /* not found */ }
  return Math.round(total / (1024 * 1024));
}

function tailLog(logPath, lines = 30) {
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    return content.split('\n').slice(-lines).join('\n');
  } catch { return ''; }
}

function scanLogs(logPaths) {
  let errors = 0;
  let sample = '';
  for (const p of logPaths) {
    const tail = tailLog(p);
    if (!tail) continue;
    const errLines = tail.split('\n').filter(l => /NotFoundException|DRM|failed|error|invalid token/i.test(l));
    errors += errLines.length;
    if (errLines.length > 0 && !sample) sample = errLines[errLines.length - 1].trim().slice(0, 50);
  }
  return { errors, sample };
}

// ── Windows ────────────────────────────────────────────────────────────────────
async function runWin(results) {
  const ccProc = await ps(
    'Get-Process -Name "Creative Cloud","Adobe CC*","ACC*" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty ProcessName'
  );
  if (ccProc) {
    printResult('Creative Cloud', chalk.white(ccProc + ' running'), 'ok');
    results.push({ name: 'Creative Cloud Process', status: 'ok', info: ccProc });
  } else {
    printResult('Creative Cloud', chalk.dim('not running'), 'warn', 'CC desktop not open');
    results.push({ name: 'Creative Cloud Process', status: 'warn', info: 'not running' });
  }

  const agsStatus = await ps('(Get-Service -Name "AGSService" -ErrorAction SilentlyContinue).Status');
  if (agsStatus) {
    const ok = /running/i.test(agsStatus);
    printResult('AGSService', chalk.white(agsStatus), ok ? 'ok' : 'critical', ok ? '' : 'licensing service down');
    results.push({ name: 'Adobe AGSService', status: ok ? 'ok' : 'critical', info: agsStatus });
  } else {
    printResult('AGSService', chalk.dim('not found'), 'warn', 'may not be installed');
    results.push({ name: 'Adobe AGSService', status: 'warn', info: 'service not found' });
  }

  const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const appData  = process.env.APPDATA       || path.join(os.homedir(), 'AppData', 'Roaming');
  const { errors, sample } = scanLogs([
    path.join(localApp, 'Adobe', 'OOBE', 'Logs', 'AdobeIPCBroker.log'),
    path.join(localApp, 'Adobe', 'GenuineService', 'Logs', 'AGSService.log'),
    path.join(appData,  'Adobe', 'Licensing', 'ServiceLog.log'),
  ]);
  if (errors > 0) {
    printResult('License log errors', chalk.red(String(errors)), 'warn', sample || 'check Adobe logs');
    results.push({ name: 'Adobe License Log', status: 'warn', info: `${errors} error(s)` });
  } else {
    printResult('License log errors', chalk.white('none'), 'ok');
    results.push({ name: 'Adobe License Log', status: 'ok', info: 'no errors in recent logs' });
  }

  let cacheMB = 0;
  for (const d of [path.join(appData, 'Adobe', 'Creative Cloud Libraries'), path.join(localApp, 'Adobe', 'OOBE')]) {
    cacheMB += dirSizeMB(d);
  }
  printResult('CC cache/data', chalk.white(cacheMB > 0 ? `${cacheMB} MB` : 'not found'), cacheMB > 5120 ? 'warn' : 'ok', cacheMB > 5120 ? 'large — clear via CC app' : '');
  if (cacheMB > 0) results.push({ name: 'Adobe CC Cache', status: cacheMB > 5120 ? 'warn' : 'ok', info: `${cacheMB} MB` });

  const adobeApps = await ps(
    'Get-Process -Name "Photoshop","Acrobat","Illustrator","InDesign","Premiere*","AfterFX*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName | Get-Unique'
  );
  if (adobeApps) {
    const list = adobeApps.split('\n').map(s => s.trim()).filter(Boolean).join(', ');
    printResult('Running apps', chalk.white(list), 'ok');
    results.push({ name: 'Adobe Apps Running', status: 'ok', info: list });
  } else {
    printResult('Running apps', chalk.dim('none'), 'ok');
  }
}

// ── macOS ──────────────────────────────────────────────────────────────────────
async function runMac(results) {
  const ccProc = await sh('pgrep -x "Creative Cloud" 2>/dev/null');
  if (ccProc) {
    printResult('Creative Cloud', chalk.white('running'), 'ok');
    results.push({ name: 'Creative Cloud Process', status: 'ok', info: 'running' });
  } else {
    printResult('Creative Cloud', chalk.dim('not running'), 'warn', 'CC desktop not open');
    results.push({ name: 'Creative Cloud Process', status: 'warn', info: 'not running' });
  }

  // Check LaunchDaemon for Adobe licensing
  const launchDaemon = await sh('launchctl list 2>/dev/null | grep -i "adobe\\|OOBE\\|GenuineService"');
  if (launchDaemon) {
    const lines = launchDaemon.split('\n').filter(Boolean);
    printResult('Adobe services', chalk.white(`${lines.length} running`), 'ok');
    results.push({ name: 'Adobe Services', status: 'ok', info: `${lines.length} service(s) active` });
  } else {
    printResult('Adobe services', chalk.dim('none found'), 'warn', 'Adobe CC may not be installed');
    results.push({ name: 'Adobe Services', status: 'warn', info: 'no Adobe daemons found' });
  }

  // Log scan
  const { errors, sample } = scanLogs([
    path.join(os.homedir(), 'Library', 'Logs', 'CreativeCloud', 'ACC', 'ACC.log'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Adobe', 'OOBE', 'Logs', 'AdobeIPCBroker.log'),
  ]);
  if (errors > 0) {
    printResult('License log errors', chalk.red(String(errors)), 'warn', sample || 'check Adobe logs');
    results.push({ name: 'Adobe License Log', status: 'warn', info: `${errors} error(s)` });
  } else {
    printResult('License log errors', chalk.white('none'), 'ok');
    results.push({ name: 'Adobe License Log', status: 'ok', info: 'no errors in recent logs' });
  }

  // CC cache
  const cacheDirs = [
    path.join(os.homedir(), 'Library', 'Application Support', 'Adobe', 'Creative Cloud Libraries'),
    path.join(os.homedir(), 'Library', 'Caches', 'Adobe'),
  ];
  let cacheMB = 0;
  for (const d of cacheDirs) cacheMB += dirSizeMB(d);
  printResult('CC cache/data', chalk.white(cacheMB > 0 ? `${cacheMB} MB` : 'not found'), cacheMB > 5120 ? 'warn' : 'ok', cacheMB > 5120 ? 'large — clear via CC app' : '');
  if (cacheMB > 0) results.push({ name: 'Adobe CC Cache', status: cacheMB > 5120 ? 'warn' : 'ok', info: `${cacheMB} MB` });

  // Running apps
  const adobeApps = await sh('pgrep -l -x "Photoshop|Acrobat|Illustrator|InDesign|Premiere Pro|After Effects" 2>/dev/null');
  if (adobeApps) {
    const list = adobeApps.split('\n').map(l => l.replace(/^\d+\s+/, '').trim()).filter(Boolean).join(', ');
    printResult('Running apps', chalk.white(list.slice(0, 40)), 'ok');
    results.push({ name: 'Adobe Apps Running', status: 'ok', info: list });
  } else {
    printResult('Running apps', chalk.dim('none'), 'ok');
  }
}

// ── Linux ──────────────────────────────────────────────────────────────────────
async function runLinux(results) {
  const acrobat = await sh('pgrep -x acroread 2>/dev/null || pgrep -x AdobeReader 2>/dev/null');
  printResult('Adobe Reader', chalk.white(acrobat ? 'running' : 'not running'), 'ok');
  results.push({ name: 'Adobe Reader', status: 'ok', info: acrobat ? 'running' : 'not detected (CC not supported on Linux)' });
}

export async function checkAdobe() {
  printSectionHeader('ADOBE / CC LICENSE');
  const results = [];
  if (isWin)      await runWin(results);
  else if (isMac) await runMac(results);
  else            await runLinux(results);
  printSectionFooter();
  return results;
}
