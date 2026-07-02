import net from 'net';
import dns from 'dns/promises';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { sh, ps, isWin, isMac } from '../utils/platform.js';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

function tcpProbe(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, timeoutMs);
    sock.once('connect', () => { clearTimeout(timer); sock.destroy(); resolve(true); });
    sock.once('error',   () => { clearTimeout(timer); resolve(false); });
  });
}

function dirSizeMB(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile()) {
        try { total += fs.statSync(path.join(dirPath, e.name)).size; } catch { /* skip */ }
      }
    }
  } catch { /* dir not found */ }
  return Math.round(total / (1024 * 1024));
}

async function getOutlookProcess() {
  if (isWin) {
    const out = await ps(
      'Get-Process OUTLOOK -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Description'
    );
    return out || null;
  }
  if (isMac) {
    const out = await sh('pgrep -x "Microsoft Outlook" 2>/dev/null');
    return out ? 'Microsoft Outlook (running)' : null;
  }
  return null;
}

function outlookDataDir() {
  if (isWin) return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Outlook');
  if (isMac) return path.join(os.homedir(), 'Library', 'Group Containers', 'UBF8T346G9.Office', 'Outlook', 'Outlook 15 Profiles');
  return '';
}

export async function checkEmail() {
  printSectionHeader('EMAIL / OUTLOOK');
  const results = [];

  // Outlook process
  const outlookProc = await getOutlookProcess();
  if (outlookProc) {
    printResult('Outlook process', chalk.white(outlookProc), 'ok');
    results.push({ name: 'Outlook Process', status: 'ok', info: outlookProc });
  } else {
    printResult('Outlook process', chalk.dim('not running'), 'warn', 'check if Outlook is installed');
    results.push({ name: 'Outlook Process', status: 'warn', info: 'not running' });
  }

  // Port checks — cross-platform
  const ports = [
    { label: 'SMTP 587 (M365)',  host: 'smtp.office365.com',    port: 587 },
    { label: 'SMTP 465 (SSL)',   host: 'smtp.office365.com',    port: 465 },
    { label: 'IMAP 993 (M365)', host: 'outlook.office365.com', port: 993 },
  ];
  for (const p of ports) {
    const reachable = await tcpProbe(p.host, p.port);
    const status = reachable ? 'ok' : 'critical';
    printResult(p.label, chalk.white(reachable ? 'reachable' : 'blocked'), status);
    results.push({ name: p.label, status, info: reachable ? 'port open' : 'port unreachable' });
  }

  // MX record
  try {
    const mx = await dns.resolveMx('office365.com');
    const hasMx = mx && mx.length > 0;
    printResult('MX record', chalk.white(hasMx ? mx[0].exchange : 'none'), hasMx ? 'ok' : 'warn');
    results.push({ name: 'MX Record (office365.com)', status: hasMx ? 'ok' : 'warn', info: hasMx ? mx[0].exchange : 'no MX found' });
  } catch {
    printResult('MX record', chalk.dim('DNS lookup failed'), 'critical');
    results.push({ name: 'MX Record', status: 'critical', info: 'DNS lookup failed' });
  }

  // Outlook data dir size
  const dataDir = outlookDataDir();
  if (dataDir) {
    const sizeMB = dirSizeMB(dataDir);
    const sizeStatus = sizeMB > 10240 ? 'warn' : 'ok';
    printResult(
      'Outlook data dir',
      chalk.white(sizeMB > 0 ? `${sizeMB} MB` : 'not found'),
      sizeStatus,
      sizeMB > 10240 ? 'large OST/PST — may cause slowness' : ''
    );
    if (sizeMB > 0) results.push({ name: 'Outlook Data Size', status: sizeStatus, info: `${sizeMB} MB`, dir: dataDir });
  }

  printSectionFooter();
  return results;
}
