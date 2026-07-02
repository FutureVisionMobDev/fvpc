import chalk from 'chalk';
import { sh, ps, isWin, isMac } from '../utils/platform.js';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

async function runWin(results) {
  // All 3 profiles: Domain, Private, Public
  const profilesOut = await ps(
    'Get-NetFirewallProfile | Select-Object Name,Enabled | ConvertTo-Json -Compress',
    6000
  );
  if (profilesOut) {
    try {
      let profiles = JSON.parse(profilesOut);
      if (!Array.isArray(profiles)) profiles = [profiles];
      for (const p of profiles) {
        const name    = p.Name || 'Profile';
        const enabled = p.Enabled === true || p.Enabled === 'True';
        printResult(`FW: ${name}`, chalk.white(enabled ? 'Enabled' : 'DISABLED'), enabled ? 'ok' : 'critical', enabled ? '' : 'firewall off on this profile');
        results.push({ name: `Firewall ${name}`, status: enabled ? 'ok' : 'critical', info: enabled ? 'enabled' : 'DISABLED' });
      }
    } catch {
      printResult('Firewall', chalk.dim('unable to parse'), 'skipped');
    }
  } else {
    // Fallback: netsh
    const netshOut = await sh('netsh advfirewall show allprofiles state 2>nul', 5000);
    if (netshOut) {
      const onCount  = (netshOut.match(/State\s+ON/gi) || []).length;
      const offCount = (netshOut.match(/State\s+OFF/gi) || []).length;
      const status = offCount > 0 ? 'critical' : 'ok';
      printResult('Firewall profiles', chalk.white(`${onCount} on / ${offCount} off`), status, offCount > 0 ? 'some profiles disabled' : '');
      results.push({ name: 'Firewall', status, info: `${onCount} profiles enabled, ${offCount} disabled` });
    } else {
      printResult('Firewall', chalk.dim('unable to query'), 'skipped');
    }
  }

  // Windows Defender / AV
  const defenderOut = await ps(
    '(Get-MpComputerStatus -ErrorAction SilentlyContinue).AntivirusEnabled',
    6000
  );
  if (defenderOut) {
    const avOn = /true/i.test(defenderOut);
    printResult('Windows Defender', chalk.white(avOn ? 'enabled' : 'DISABLED'), avOn ? 'ok' : 'critical', avOn ? '' : 'real-time protection off');
    results.push({ name: 'Windows Defender', status: avOn ? 'ok' : 'critical', info: avOn ? 'enabled' : 'DISABLED' });
  }

  // Real-time protection
  const rtpOut = await ps(
    '(Get-MpComputerStatus -ErrorAction SilentlyContinue).RealTimeProtectionEnabled',
    6000
  );
  if (rtpOut) {
    const rtpOn = /true/i.test(rtpOut);
    printResult('Real-time protection', chalk.white(rtpOn ? 'on' : 'OFF'), rtpOn ? 'ok' : 'critical', rtpOn ? '' : 'disable is a security risk');
    results.push({ name: 'Real-time Protection', status: rtpOn ? 'ok' : 'critical', info: rtpOn ? 'on' : 'OFF' });
  }

  // Last full scan date
  const scanOut = await ps(
    'try { (Get-MpComputerStatus).QuickScanEndTime.ToString("yyyy-MM-dd HH:mm") } catch { "" }',
    5000
  );
  if (scanOut) {
    printResult('Last AV scan', chalk.white(scanOut), 'ok');
    results.push({ name: 'Last AV Scan', status: 'ok', info: scanOut });
  }
}

async function runMac(results) {
  // Application Firewall (ALF)
  const alfOut = await sh('defaults read /Library/Preferences/com.apple.alf globalstate 2>/dev/null');
  if (alfOut !== '') {
    const state = parseInt(alfOut.trim(), 10);
    // 0 = off, 1 = on (allow specific), 2 = block all
    const label  = state === 0 ? 'DISABLED' : state === 1 ? 'On (allow signed)' : 'Block all';
    const status = state === 0 ? 'critical' : 'ok';
    printResult('App Firewall (ALF)', chalk.white(label), status, state === 0 ? 'turn on in Security prefs' : '');
    results.push({ name: 'App Firewall', status, info: label });
  } else {
    // Try socketfilterfw
    const sfOut = await sh('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null');
    if (sfOut) {
      const enabled = /enabled/i.test(sfOut);
      printResult('App Firewall', chalk.white(sfOut.trim().slice(0, 30)), enabled ? 'ok' : 'critical');
      results.push({ name: 'App Firewall', status: enabled ? 'ok' : 'critical', info: sfOut.trim().slice(0, 40) });
    } else {
      printResult('App Firewall', chalk.dim('unable to query'), 'skipped');
    }
  }

  // Stealth mode
  const stealthOut = await sh('/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode 2>/dev/null');
  if (stealthOut) {
    const on = /enabled/i.test(stealthOut);
    printResult('Stealth mode', chalk.white(on ? 'enabled' : 'disabled'), 'ok', on ? 'ignores ping requests' : '');
    results.push({ name: 'Stealth Mode', status: 'ok', info: on ? 'enabled' : 'disabled' });
  }

  // Gatekeeper
  const gkOut = await sh('spctl --status 2>/dev/null');
  if (gkOut) {
    const on = /assessments enabled/i.test(gkOut);
    printResult('Gatekeeper', chalk.white(on ? 'enabled' : 'DISABLED'), on ? 'ok' : 'warn', on ? '' : 'allows unsigned apps');
    results.push({ name: 'Gatekeeper', status: on ? 'ok' : 'warn', info: on ? 'enabled' : 'disabled' });
  }

  // XProtect / built-in malware
  const xpOut = await sh('system_profiler SPInstallHistoryDataType 2>/dev/null | grep -A2 "XProtect" | head -3');
  if (xpOut) {
    printResult('XProtect', chalk.white('present'), 'ok');
    results.push({ name: 'XProtect', status: 'ok', info: 'Apple XProtect installed' });
  }
}

async function runLinux(results) {
  // ufw
  const ufwOut = await sh('ufw status 2>/dev/null | head -3');
  if (ufwOut) {
    const active = /active/i.test(ufwOut);
    printResult('UFW', chalk.white(active ? 'active' : 'inactive'), active ? 'ok' : 'warn', active ? '' : 'firewall not running');
    results.push({ name: 'UFW Firewall', status: active ? 'ok' : 'warn', info: active ? 'active' : 'inactive' });
  }

  // firewalld
  const fwdOut = await sh('systemctl is-active firewalld 2>/dev/null');
  if (fwdOut) {
    const active = fwdOut.trim() === 'active';
    printResult('firewalld', chalk.white(fwdOut.trim()), active ? 'ok' : 'warn');
    results.push({ name: 'firewalld', status: active ? 'ok' : 'warn', info: fwdOut.trim() });
  }

  if (!ufwOut && !fwdOut) {
    // iptables rule count
    const iptOut = await sh('iptables -L 2>/dev/null | grep -c "^ACCEPT\\|^DROP\\|^REJECT"');
    const ruleCount = parseInt(iptOut, 10) || 0;
    printResult('iptables rules', chalk.white(String(ruleCount)), ruleCount > 0 ? 'ok' : 'warn', ruleCount === 0 ? 'no rules — check firewall' : '');
    results.push({ name: 'iptables', status: ruleCount > 0 ? 'ok' : 'warn', info: `${ruleCount} rules` });
  }
}

export async function checkFirewall() {
  printSectionHeader('FIREWALL / SECURITY');
  const results = [];
  if (isWin)      await runWin(results);
  else if (isMac) await runMac(results);
  else            await runLinux(results);
  printSectionFooter();
  return results;
}
