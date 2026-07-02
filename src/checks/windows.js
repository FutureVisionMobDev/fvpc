import si from 'systeminformation';
import chalk from 'chalk';
import { sh, ps, isWin, isMac } from '../utils/platform.js';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

async function runMac(results) {
  const version = await sh('sw_vers -productVersion');
  const build   = await sh('sw_vers -buildVersion');
  const name    = await sh('sw_vers -productName');
  printResult('Edition', chalk.white(`${name} ${version}`), 'ok');
  printResult('Build',   chalk.white(build || '?'), 'ok');
  results.push({ name: 'macOS Version', status: 'ok', info: `${name} ${version} (${build})` });

  try {
    const t = await si.time();
    const days = Math.floor((t.uptime || 0) / 86400);
    const hrs  = Math.floor(((t.uptime || 0) % 86400) / 3600);
    const uptimeStatus = days > 30 ? 'warn' : 'ok';
    printResult('Uptime', chalk.white(`${days}d ${hrs}h`), uptimeStatus, days > 30 ? 'reboot recommended' : '');
    results.push({ name: 'Uptime', status: uptimeStatus, info: `${days}d ${hrs}h` });
  } catch { /* skip */ }

  const updOut = await sh('softwareupdate -l 2>&1', 15000);
  if (updOut) {
    const pending = (updOut.match(/^\s*\*/gm) || []).length;
    const updStatus = pending > 5 ? 'warn' : 'ok';
    printResult('Pending updates', chalk.white(String(pending)), updStatus, pending > 0 ? 'run Software Update' : '');
    results.push({ name: 'Pending Updates', status: updStatus, info: `${pending} update(s)` });
  } else {
    printResult('Pending updates', chalk.dim('unable to query'), 'skipped');
  }

  const sipOut = await sh('csrutil status 2>/dev/null');
  if (sipOut) {
    const sipOn = /enabled/i.test(sipOut);
    printResult('SIP', chalk.white(sipOn ? 'enabled' : 'DISABLED'), sipOn ? 'ok' : 'warn', sipOn ? '' : 'System Integrity Protection off');
    results.push({ name: 'SIP', status: sipOn ? 'ok' : 'warn', info: sipOn ? 'enabled' : 'disabled' });
  }
}

async function runLinux(results) {
  const distro = await sh('lsb_release -d 2>/dev/null | cut -d: -f2 | xargs');
  const kernel = await sh('uname -r');
  printResult('Distro', chalk.white(distro || 'Linux'), 'ok');
  printResult('Kernel', chalk.white(kernel || '?'), 'ok');
  results.push({ name: 'Linux Distro', status: 'ok', info: distro || 'Linux' });

  try {
    const t = await si.time();
    const days = Math.floor((t.uptime || 0) / 86400);
    const hrs  = Math.floor(((t.uptime || 0) % 86400) / 3600);
    const uptimeStatus = days > 30 ? 'warn' : 'ok';
    printResult('Uptime', chalk.white(`${days}d ${hrs}h`), uptimeStatus, days > 30 ? 'reboot recommended' : '');
    results.push({ name: 'Uptime', status: uptimeStatus, info: `${days}d ${hrs}h` });
  } catch { /* skip */ }

  const aptOut = await sh('apt list --upgradable 2>/dev/null | grep -c upgradable', 10000);
  const count = parseInt(aptOut, 10) || 0;
  const updStatus = count > 20 ? 'warn' : 'ok';
  printResult('Pending updates', chalk.white(String(count)), updStatus, count > 0 ? 'run apt upgrade' : '');
  results.push({ name: 'Pending Updates', status: updStatus, info: `${count} package(s)` });
}

async function runWin(results) {
  try {
    const osInfo  = await si.osInfo();
    const build   = osInfo.build || osInfo.release || '?';
    const edition = osInfo.distro || 'Windows';
    printResult('Edition', chalk.white(edition), 'ok');
    printResult('Build',   chalk.white(build), 'ok');
    results.push({ name: 'Windows Build', status: 'ok', info: `${edition} build ${build}` });
  } catch { printResult('OS Info', chalk.dim('unavailable'), 'warn'); }

  try {
    const t = await si.time();
    const days = Math.floor((t.uptime || 0) / 86400);
    const hrs  = Math.floor(((t.uptime || 0) % 86400) / 3600);
    const uptimeStatus = days > 30 ? 'warn' : 'ok';
    printResult('Uptime', chalk.white(`${days}d ${hrs}h`), uptimeStatus, days > 30 ? 'reboot recommended' : '');
    results.push({ name: 'Uptime', status: uptimeStatus, info: `${days}d ${hrs}h` });
  } catch { printResult('Uptime', chalk.dim('unavailable'), 'warn'); }

  const slmgrDli = await ps(
    'try { $r = & cscript //B "$env:SystemRoot\\System32\\slmgr.vbs" /dli 2>&1 | Select-String "License Status" | Select-Object -First 1 -ExpandProperty Line; $r } catch { "" }',
    7000
  );
  if (slmgrDli) {
    const licensed = /licensed/i.test(slmgrDli);
    const actLabel = licensed ? 'Licensed' : slmgrDli.replace(/License Status:\s*/i, '').trim();
    printResult('Activation', chalk.white(actLabel), licensed ? 'ok' : 'warn');
    results.push({ name: 'Windows Activation', status: licensed ? 'ok' : 'warn', info: actLabel });
  } else {
    printResult('Activation', chalk.dim('run as admin for full status'), 'skipped');
    results.push({ name: 'Windows Activation', status: 'skipped', info: 'elevation required' });
  }

  const updatesOut = await ps(
    'try { $s = New-Object -ComObject Microsoft.Update.Session; $s.CreateUpdateSearcher().Search("IsInstalled=0 and IsHidden=0").Updates.Count } catch { "err" }',
    12000
  );
  if (updatesOut && updatesOut !== 'err') {
    const count = parseInt(updatesOut, 10);
    if (!isNaN(count)) {
      const updStatus = count > 20 ? 'critical' : count > 0 ? 'warn' : 'ok';
      printResult('Pending updates', chalk.white(String(count)), updStatus, count > 0 ? 'run Windows Update' : '');
      results.push({ name: 'Pending Updates', status: updStatus, info: `${count} update(s)` });
    }
  } else {
    const lastUpdate = await ps(
      'try { (Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1).InstalledOn.ToString("yyyy-MM-dd") } catch { "" }'
    );
    if (lastUpdate) {
      printResult('Last update installed', chalk.white(lastUpdate), 'ok', 'pending count unavailable');
      results.push({ name: 'Last Windows Update', status: 'ok', info: `installed ${lastUpdate}` });
    } else {
      printResult('Pending updates', chalk.dim('unable to query'), 'skipped');
    }
  }

  const pagefileOut = await ps('[Math]::Round((Get-CimInstance Win32_PageFileUsage).CurrentUsage)');
  if (pagefileOut) {
    const mbUsed = parseInt(pagefileOut, 10);
    if (!isNaN(mbUsed)) {
      printResult('Pagefile used', chalk.white(`${mbUsed} MB`), mbUsed > 2048 ? 'warn' : 'ok');
      results.push({ name: 'Pagefile', status: mbUsed > 2048 ? 'warn' : 'ok', info: `${mbUsed} MB used` });
    }
  }
}

export async function checkWindows() {
  const label = isWin ? 'WINDOWS OS' : isMac ? 'MACOS' : 'LINUX OS';
  printSectionHeader(label);
  const results = [];
  if (isWin)      await runWin(results);
  else if (isMac) await runMac(results);
  else            await runLinux(results);
  printSectionFooter();
  return results;
}
