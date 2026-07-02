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

// ── Windows SMB checks ─────────────────────────────────────────────────────────
async function runWin(results) {
  const netUseOut = await sh('net use', 5000);
  if (netUseOut) {
    const lines = netUseOut.split('\n').filter(l => l.match(/^(OK|Disconnected|Unavailable|\s*[A-Z]:)/i));
    let driveCount = 0;
    for (const line of lines.slice(0, 6)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const statusPart = parts[0];
        const letter = parts[1]?.match(/^[A-Z]:/) ? parts[1] : null;
        const unc = parts.find(p => p.startsWith('\\\\')) || '';
        if (!unc) continue;
        const driveStatus = /ok/i.test(statusPart) ? 'ok' : 'warn';
        const label = letter ? `Drive ${letter}` : 'Net share';
        printResult(label, chalk.white(unc.slice(0, 28)), driveStatus, /ok/i.test(statusPart) ? '' : statusPart);
        results.push({ name: `SMB ${label}`, status: driveStatus, info: unc });
        driveCount++;
      }
    }
    if (driveCount === 0) printResult('Mapped drives', chalk.dim('none'), 'ok');
  } else {
    printResult('Mapped drives', chalk.dim('none detected'), 'ok');
  }

  // OneDrive process
  const odProc = await ps('Get-Process -Name "OneDrive" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count');
  const odCount = parseInt(odProc, 10) || 0;
  printResult('OneDrive process', chalk.white(odCount > 0 ? 'running' : 'not running'), odCount > 0 ? 'ok' : 'warn');
  results.push({ name: 'OneDrive Process', status: odCount > 0 ? 'ok' : 'warn', info: odCount > 0 ? 'running' : 'not running' });

  // OneDrive signed in (registry)
  const odStatus = await ps(
    '(Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\OneDrive\\Accounts\\Business1" -Name "LastSignInTime" -ErrorAction SilentlyContinue).LastSignInTime'
  );
  if (odStatus) {
    printResult('OneDrive Business', chalk.white('signed in'), 'ok', `last: ${odStatus.slice(0, 19)}`);
    results.push({ name: 'OneDrive Business', status: 'ok', info: `signed in, last: ${odStatus.slice(0, 19)}` });
  } else {
    printResult('OneDrive Business', chalk.dim('not signed in / not configured'), 'warn');
    results.push({ name: 'OneDrive Business', status: 'warn', info: 'not signed in or not configured' });
  }

  // Teams cache
  const teamsCache = path.join(process.env.APPDATA || '', 'Microsoft', 'Teams', 'Cache');
  const teamsMB = dirSizeMB(teamsCache);
  printResult('Teams cache', chalk.white(teamsMB > 0 ? `${teamsMB} MB` : 'not found'), teamsMB > 2048 ? 'warn' : 'ok', teamsMB > 2048 ? 'consider clearing' : '');
  if (teamsMB > 0) results.push({ name: 'Teams Cache', status: teamsMB > 2048 ? 'warn' : 'ok', info: `${teamsMB} MB`, dir: teamsCache });

  // SharePoint cache
  const spCache = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'SharePoint');
  const spMB = dirSizeMB(spCache);
  if (spMB > 0) {
    printResult('SharePoint cache', chalk.white(`${spMB} MB`), spMB > 5120 ? 'warn' : 'ok', spMB > 5120 ? 'large cache' : '');
    results.push({ name: 'SharePoint Cache', status: spMB > 5120 ? 'warn' : 'ok', info: `${spMB} MB`, dir: spCache });
  } else {
    printResult('SharePoint cache', chalk.dim('not found'), 'skipped');
  }
}

// ── macOS SMB checks ───────────────────────────────────────────────────────────
async function runMac(results) {
  // SMB mounts
  const mountOut = await sh("mount 2>/dev/null | grep -i smb");
  if (mountOut) {
    const lines = mountOut.split('\n').filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      const match = line.match(/^(\/\/.+?)\s+on\s+(.+?)\s+\(/);
      if (match) {
        printResult('SMB mount', chalk.white(match[1].slice(0, 30)), 'ok', match[2].slice(0, 20));
        results.push({ name: 'SMB Mount', status: 'ok', info: match[1] });
      }
    }
    if (lines.length === 0) printResult('SMB mounts', chalk.dim('none'), 'ok');
  } else {
    printResult('SMB mounts', chalk.dim('none'), 'ok');
  }

  // OneDrive — Mac stores in ~/Library/CloudStorage
  const odPath = path.join(os.homedir(), 'Library', 'CloudStorage');
  let odFound = false;
  try {
    const entries = fs.readdirSync(odPath, { withFileTypes: true });
    const odDirs = entries.filter(e => e.isDirectory() && /onedrive/i.test(e.name));
    if (odDirs.length > 0) {
      printResult('OneDrive', chalk.white(odDirs[0].name.slice(0, 28)), 'ok', 'CloudStorage folder found');
      results.push({ name: 'OneDrive', status: 'ok', info: odDirs[0].name });
      odFound = true;
    }
  } catch { /* no CloudStorage */ }
  if (!odFound) {
    const odProc = await sh('pgrep -x OneDrive 2>/dev/null');
    printResult('OneDrive', chalk.white(odProc ? 'running (no sync folder)' : 'not running'), odProc ? 'warn' : 'warn');
    results.push({ name: 'OneDrive', status: 'warn', info: 'not configured or not signed in' });
  }

  // Teams cache
  const teamsCache = path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Cache');
  const teamsMB = dirSizeMB(teamsCache);
  printResult('Teams cache', chalk.white(teamsMB > 0 ? `${teamsMB} MB` : 'not found'), teamsMB > 2048 ? 'warn' : 'ok', teamsMB > 2048 ? 'consider clearing' : '');
  if (teamsMB > 0) results.push({ name: 'Teams Cache', status: teamsMB > 2048 ? 'warn' : 'ok', info: `${teamsMB} MB`, dir: teamsCache });
}

// ── Linux SMB checks ───────────────────────────────────────────────────────────
async function runLinux(results) {
  const mountOut = await sh("mount 2>/dev/null | grep -i 'type cifs\\|smb'");
  if (mountOut) {
    const lines = mountOut.split('\n').filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      const match = line.match(/^(\S+)\s+on\s+(\S+)/);
      if (match) {
        printResult('CIFS mount', chalk.white(match[1].slice(0, 30)), 'ok', match[2].slice(0, 20));
        results.push({ name: 'CIFS Mount', status: 'ok', info: match[1] });
      }
    }
    if (lines.length === 0) printResult('SMB mounts', chalk.dim('none'), 'ok');
  } else {
    printResult('SMB mounts', chalk.dim('none'), 'ok');
  }
}

export async function checkSmb() {
  printSectionHeader('SMB / CLOUD DRIVES');
  const results = [];
  if (isWin)      await runWin(results);
  else if (isMac) await runMac(results);
  else            await runLinux(results);
  printSectionFooter();
  return results;
}
