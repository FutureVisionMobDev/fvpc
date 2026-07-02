import chalk from 'chalk';
import { sh, ps, isWin, isMac } from '../utils/platform.js';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

async function runWin(results) {
  // Built-in Windows VPN connections (rasphone / VPN profiles)
  const vpnConns = await ps(
    'Get-VpnConnection -ErrorAction SilentlyContinue | Select-Object Name,ConnectionStatus,ServerAddress | ConvertTo-Json -Compress',
    8000
  );

  if (vpnConns) {
    try {
      let conns = JSON.parse(vpnConns);
      if (!Array.isArray(conns)) conns = [conns];
      if (conns.length > 0) {
        for (const c of conns.slice(0, 5)) {
          const name   = (c.Name || 'VPN').slice(0, 26);
          const status = (c.ConnectionStatus || 'Unknown');
          const server = (c.ServerAddress || '').slice(0, 20);
          const connected = /connected/i.test(status);
          printResult(name, chalk.white(status), connected ? 'ok' : 'warn', server);
          results.push({ name: `VPN: ${name}`, status: connected ? 'ok' : 'warn', info: `${status} → ${server}` });
        }
      } else {
        printResult('VPN profiles', chalk.dim('none configured'), 'ok');
      }
    } catch { /* not JSON */ }
  }

  // TAP/TUN adapters (OpenVPN, WireGuard, Cisco, GlobalProtect, etc.)
  const adapters = await ps(
    'Get-NetAdapter | Where-Object { $_.InterfaceDescription -match "TAP|TUN|WireGuard|Cisco|GlobalProtect|Pulse|Juniper|FortiClient|OpenVPN|SSL" } | Select-Object Name,Status | ConvertTo-Json -Compress',
    6000
  );
  if (adapters) {
    try {
      let adps = JSON.parse(adapters);
      if (!Array.isArray(adps)) adps = [adps];
      for (const a of adps.slice(0, 4)) {
        const name = (a.Name || 'VPN adapter').slice(0, 26);
        const up   = /up/i.test(a.Status || '');
        printResult(name, chalk.white(a.Status || 'Unknown'), up ? 'ok' : 'warn', 'VPN adapter');
        results.push({ name: `Adapter: ${name}`, status: up ? 'ok' : 'warn', info: a.Status || '' });
      }
    } catch { /* skip */ }
  }

  if (!vpnConns && !adapters) {
    printResult('VPN', chalk.dim('no VPN detected'), 'ok');
    results.push({ name: 'VPN', status: 'ok', info: 'no VPN configured' });
  }
}

async function runMac(results) {
  // utun interfaces = VPN tunnels (WireGuard, OpenVPN, native VPN, etc.)
  const ifOut = await sh('ifconfig 2>/dev/null | grep -E "^utun|^ppp|^ipsec|^tun"');
  if (ifOut) {
    const ifaces = ifOut.split('\n').map(l => l.replace(/:.*/, '').trim()).filter(Boolean);
    for (const iface of ifaces.slice(0, 5)) {
      // Get the IP of the tunnel
      const ipOut = await sh(`ifconfig ${iface} 2>/dev/null | grep "inet " | awk '{print $2}'`);
      const up = !!ipOut;
      printResult(iface, chalk.white(up ? ipOut : 'no IP'), up ? 'ok' : 'warn', 'VPN tunnel');
      results.push({ name: `VPN: ${iface}`, status: up ? 'ok' : 'warn', info: up ? ipOut : 'no IP assigned' });
    }
  } else {
    printResult('VPN interfaces', chalk.dim('none active (utun/ppp/tun)'), 'ok');
    results.push({ name: 'VPN', status: 'ok', info: 'no active VPN tunnel interfaces' });
  }

  // GlobalProtect / Cisco / Pulse via process
  const vpnProcs = await sh('pgrep -l -x "GlobalProtect|CiscoVPN|openconnect|openvpn|wireguard" 2>/dev/null');
  if (vpnProcs) {
    const list = vpnProcs.split('\n').map(l => l.replace(/^\d+\s+/, '').trim()).filter(Boolean).join(', ');
    printResult('VPN client', chalk.white(list.slice(0, 38)), 'ok', 'process running');
    results.push({ name: 'VPN Client', status: 'ok', info: list });
  }
}

async function runLinux(results) {
  // tun/tap/wg interfaces
  const ifOut = await sh('ip link show type tun 2>/dev/null; ip link show type tap 2>/dev/null');
  const wgOut = await sh('ip link show type wireguard 2>/dev/null');
  const pppOut = await sh('ip link show type ppp 2>/dev/null');

  let found = 0;
  for (const [label, out] of [['TUN/TAP', ifOut], ['WireGuard', wgOut], ['PPP', pppOut]]) {
    if (!out) continue;
    const lines = out.split('\n').filter(l => /^\d+:/.test(l));
    for (const line of lines.slice(0, 3)) {
      const match = line.match(/^\d+:\s+(\S+)/);
      if (!match) continue;
      const name = match[1].replace(/:$/, '');
      const up = /UP/.test(line);
      printResult(`${label}: ${name}`, chalk.white(up ? 'UP' : 'DOWN'), up ? 'ok' : 'warn');
      results.push({ name: `VPN: ${name}`, status: up ? 'ok' : 'warn', info: `${label} interface ${up ? 'UP' : 'DOWN'}` });
      found++;
    }
  }

  if (found === 0) {
    printResult('VPN interfaces', chalk.dim('none active'), 'ok');
    results.push({ name: 'VPN', status: 'ok', info: 'no VPN tunnel interfaces found' });
  }

  // OpenVPN / WG process
  const vpnProc = await sh('pgrep -l "openvpn|wireguard|openconnect" 2>/dev/null');
  if (vpnProc) {
    const list = vpnProc.split('\n').map(l => l.replace(/^\d+\s+/, '')).filter(Boolean).join(', ');
    printResult('VPN process', chalk.white(list.slice(0, 36)), 'ok');
    results.push({ name: 'VPN Process', status: 'ok', info: list });
  }
}

export async function checkVpn() {
  printSectionHeader('VPN');
  const results = [];
  if (isWin)      await runWin(results);
  else if (isMac) await runMac(results);
  else            await runLinux(results);
  printSectionFooter();
  return results;
}
