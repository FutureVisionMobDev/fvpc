import si from 'systeminformation';
import chalk from 'chalk';
import dns from 'dns/promises';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

export async function checkNetwork() {
  printSectionHeader('NETWORK');

  const results = [];

  let internetStatus = 'ok';
  let internetInfo = 'reachable';
  try {
    await dns.resolve('google.com');
  } catch {
    internetStatus = 'critical';
    internetInfo = 'DNS failed';
  }
  printResult('Internet', chalk.white(internetInfo), internetStatus);

  const ifaces = await si.networkInterfaces();
  const active = (Array.isArray(ifaces) ? ifaces : [ifaces]).filter(
    (i) => i.operstate === 'up' && !i.internal
  );

  if (active.length === 0) {
    printResult('Interfaces', chalk.white('none active'), 'critical');
    results.push({ name: 'Network interfaces', status: 'critical', info: 'No active interface' });
  } else {
    for (const iface of active.slice(0, 3)) {
      printResult(
        iface.iface,
        chalk.white(iface.ip4 || iface.ip6 || 'no IP'),
        'ok',
        iface.type || ''
      );
    }
  }

  try {
    const stats = await si.networkStats();
    const statArr = Array.isArray(stats) ? stats : [stats];
    const drops = statArr.reduce((acc, s) => acc + (s.rx_dropped || 0) + (s.tx_dropped || 0), 0);
    const dropStatus = drops > 100 ? 'warn' : 'ok';
    printResult('Dropped packets', chalk.white(String(drops)), dropStatus);
    results.push({ name: 'Dropped packets', status: dropStatus, info: `${drops} total` });
  } catch {
    // not available on all platforms
  }

  results.unshift({ name: 'Internet', status: internetStatus, info: internetInfo });
  printSectionFooter();
  return results;
}
