import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { sh, ps, isWin, isMac } from '../utils/platform.js';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

function dirSizeMB(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile()) {
        try { total += fs.statSync(path.join(dirPath, e.name)).size; } catch { /* skip */ }
      }
    }
  } catch { /* not found */ }
  return Math.round(total / (1024 * 1024));
}

// ── Windows ────────────────────────────────────────────────────────────────────
async function runWin(results) {
  const username    = process.env.USERNAME || os.userInfo().username || '';
  const profilePath = process.env.USERPROFILE || os.homedir();
  printResult('Current user',  chalk.white(username || 'unknown'), 'ok');
  printResult('Profile path',  chalk.white(profilePath), 'ok');
  results.push({ name: 'Current User', status: 'ok', info: username });

  // Domain join
  const domainOut = await ps('$cs = Get-CimInstance Win32_ComputerSystem; "$($cs.PartOfDomain)|$($cs.Domain)"');
  if (domainOut) {
    const [joined, domain] = domainOut.split('|');
    const isDomain = joined.trim() === 'True';
    printResult('Domain joined', chalk.white(isDomain ? domain.trim() : 'Workgroup'), isDomain ? 'ok' : 'warn', isDomain ? '' : 'not on a domain');
    results.push({ name: 'Domain Join', status: isDomain ? 'ok' : 'warn', info: isDomain ? domain.trim() : 'Workgroup / not joined' });
  }

  // AppData size
  const localMB = dirSizeMB(path.join(profilePath, 'AppData', 'Local'));
  const roamMB  = dirSizeMB(path.join(profilePath, 'AppData', 'Roaming'));
  const totalMB = localMB + roamMB;
  const profStatus = totalMB > 10240 ? 'warn' : 'ok';
  printResult('AppData size', chalk.white(`${totalMB} MB`), profStatus, profStatus === 'warn' ? 'large profile — slow logins' : '');
  results.push({ name: 'AppData Size', status: profStatus, info: `${totalMB} MB (Local: ${localMB} MB, Roaming: ${roamMB} MB)` });

  // Group Policy
  const gpOut = await ps(
    '(gpresult /r 2>&1) | Select-String "Last time Group Policy was applied" | Select-Object -First 1 -ExpandProperty Line',
    10000
  );
  if (gpOut) {
    const match = gpOut.match(/:\s*(.+)$/);
    const gpTime = match ? match[1].trim() : gpOut.trim();
    printResult('GP last applied', chalk.white(gpTime.slice(0, 30)), 'ok');
    results.push({ name: 'Group Policy', status: 'ok', info: gpTime.slice(0, 50) });
  } else {
    printResult('GP last applied', chalk.dim('need elevation'), 'skipped');
  }

  // Credential Manager
  const credOut = await ps('(cmdkey /list | Select-String "Target:").Count');
  if (credOut !== '') {
    const credCount = parseInt(credOut, 10) || 0;
    const credStatus = credCount > 50 ? 'warn' : 'ok';
    printResult('Saved credentials', chalk.white(String(credCount)), credStatus, credCount > 50 ? 'many saved — check for stale entries' : '');
    results.push({ name: 'Saved Credentials', status: credStatus, info: `${credCount} in Credential Manager` });
  }

  // Azure AD
  const aadOut = await ps('dsregcmd /status 2>&1 | Select-String "AzureAdJoined\\s*:" | Select-Object -First 1 -ExpandProperty Line');
  if (aadOut) {
    const aadJoined = /:\s*YES/i.test(aadOut);
    printResult('Azure AD joined', chalk.white(aadJoined ? 'YES' : 'NO'), aadJoined ? 'ok' : 'warn', aadJoined ? '' : 'not Entra/AAD joined');
    results.push({ name: 'Azure AD Join', status: aadJoined ? 'ok' : 'warn', info: aadJoined ? 'AAD joined' : 'not AAD joined' });
  }
}

// ── macOS ──────────────────────────────────────────────────────────────────────
async function runMac(results) {
  const userInfo = os.userInfo();
  const username = userInfo.username || '';
  const home     = userInfo.homedir  || os.homedir();
  printResult('Current user', chalk.white(username), 'ok');
  printResult('Home dir',     chalk.white(home), 'ok');
  results.push({ name: 'Current User', status: 'ok', info: username });

  // AD domain join
  const adOut = await sh('dsconfigad -show 2>/dev/null | grep "Active Directory Domain"');
  if (adOut) {
    const match = adOut.match(/=\s*(.+)$/);
    const domain = match ? match[1].trim() : 'joined';
    printResult('AD Domain', chalk.white(domain), 'ok');
    results.push({ name: 'AD Domain', status: 'ok', info: domain });
  } else {
    printResult('AD Domain', chalk.dim('not joined'), 'warn', 'no Active Directory binding');
    results.push({ name: 'AD Domain', status: 'warn', info: 'not AD joined' });
  }

  // MDM enrollment
  const mdmOut = await sh('profiles status -type enrollment 2>/dev/null');
  if (mdmOut) {
    const enrolled = /enrolled/i.test(mdmOut);
    printResult('MDM enrollment', chalk.white(enrolled ? 'enrolled' : 'not enrolled'), enrolled ? 'ok' : 'warn');
    results.push({ name: 'MDM Enrollment', status: enrolled ? 'ok' : 'warn', info: enrolled ? 'MDM enrolled' : 'not enrolled' });
  } else {
    printResult('MDM enrollment', chalk.dim('unable to query'), 'skipped');
  }

  // Library size (top-level dirs only, fast)
  const libPath = path.join(home, 'Library');
  const libMB   = dirSizeMB(libPath);
  const libStatus = libMB > 20480 ? 'warn' : 'ok';
  printResult('~/Library size', chalk.white(libMB > 0 ? `${libMB} MB` : 'unknown'), libStatus, libStatus === 'warn' ? 'large — check for bloat' : '');
  results.push({ name: 'Library Size', status: libStatus, info: `${libMB} MB` });

  // Keychain entries (stale creds)
  const keychainOut = await sh('security list-keychains 2>/dev/null | wc -l | xargs');
  if (keychainOut) {
    const count = parseInt(keychainOut, 10) || 0;
    printResult('Keychains', chalk.white(String(count)), 'ok', `${count} keychain(s) in use`);
    results.push({ name: 'Keychains', status: 'ok', info: `${count} keychains` });
  }

  // Last login
  const lastOut = await sh('last -1 2>/dev/null | head -1');
  if (lastOut) {
    printResult('Last login', chalk.white(lastOut.slice(0, 40)), 'ok');
  }
}

// ── Linux ──────────────────────────────────────────────────────────────────────
async function runLinux(results) {
  const userInfo = os.userInfo();
  const username = userInfo.username || process.env.USER || '';
  const home     = userInfo.homedir  || os.homedir();
  printResult('Current user', chalk.white(username), 'ok');
  results.push({ name: 'Current User', status: 'ok', info: username });

  // Groups
  const groupsOut = await sh('id 2>/dev/null');
  if (groupsOut) {
    const match = groupsOut.match(/groups=(.+)/);
    const groups = match ? match[1].slice(0, 50) : groupsOut.slice(0, 50);
    printResult('Groups', chalk.dim(groups), 'ok');
    results.push({ name: 'User Groups', status: 'ok', info: groups });
  }

  // sudo access
  const sudoOut = await sh('sudo -n true 2>&1');
  const hasSudo = sudoOut === '';
  printResult('Sudo access', chalk.white(hasSudo ? 'yes (no password needed)' : 'requires password'), hasSudo ? 'warn' : 'ok',
    hasSudo ? 'passwordless sudo active' : '');
  results.push({ name: 'Sudo', status: hasSudo ? 'warn' : 'ok', info: hasSudo ? 'passwordless sudo' : 'password required' });

  // ~/.config size
  const configMB = dirSizeMB(path.join(home, '.config'));
  printResult('~/.config size', chalk.white(`${configMB} MB`), configMB > 2048 ? 'warn' : 'ok');
  results.push({ name: 'Config Size', status: configMB > 2048 ? 'warn' : 'ok', info: `${configMB} MB` });
}

export async function checkAccounts() {
  printSectionHeader('ACCOUNTS / DOMAIN');
  const results = [];
  if (isWin)      await runWin(results);
  else if (isMac) await runMac(results);
  else            await runLinux(results);
  printSectionFooter();
  return results;
}
