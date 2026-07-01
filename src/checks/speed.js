import chalk from 'chalk';
import ora from 'ora';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

function speedBar(mbps, maxMbps = 100, width = 20) {
  const pct = Math.min(100, Math.round((mbps / maxMbps) * 100));
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = mbps >= 50 ? chalk.green : mbps >= 10 ? chalk.yellow : chalk.red;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty)) + chalk.dim(` ${mbps.toFixed(1)} Mbps`);
}

function latencyBar(ms, width = 20) {
  const pct = Math.min(100, Math.round((ms / 200) * 100));
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = ms <= 30 ? chalk.green : ms <= 80 ? chalk.yellow : chalk.red;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty)) + chalk.dim(` ${ms.toFixed(0)} ms`);
}

export async function checkSpeed() {
  printSectionHeader('INTERNET SPEED');

  let speedtest;
  try {
    const mod = await import('speedtest-net');
    speedtest = mod.default;
  } catch {
    printResult('Speed test', chalk.red('speedtest-net not installed'), 'critical');
    printSectionFooter();
    return [{ name: 'Speed test', status: 'critical', info: 'module missing' }];
  }

  const spin = ora({ text: chalk.dim('Running speed test (may take ~20s)...'), color: 'cyan' }).start();

  process.removeAllListeners('warning');

  let result;
  try {
    result = await speedtest({ acceptLicense: true, acceptGdpr: true });
  } catch (err) {
    spin.stop();
    printResult('Speed test', chalk.red('failed'), 'critical', err.message.slice(0, 40));
    printSectionFooter();
    return [{ name: 'Speed test', status: 'critical', info: err.message.slice(0, 40) }];
  }

  spin.stop();

  const downloadMbps = (result.download?.bandwidth ?? 0) / 125000;
  const uploadMbps = (result.upload?.bandwidth ?? 0) / 125000;
  const pingMs = result.ping?.latency ?? 0;
  const jitterMs = result.ping?.jitter ?? 0;
  const serverName = result.server?.name ?? 'unknown';
  const isp = result.isp ?? 'unknown';

  const maxMbps = Math.max(downloadMbps, uploadMbps, 100);

  printResult('ISP', chalk.white(isp), 'ok');
  printResult('Server', chalk.white(serverName), 'ok');

  console.log(chalk.cyan('│ ') + chalk.white('Download'.padEnd(22)) + speedBar(downloadMbps, maxMbps));
  console.log(chalk.cyan('│ ') + chalk.white('Upload'.padEnd(22)) + speedBar(uploadMbps, maxMbps));
  console.log(chalk.cyan('│ ') + chalk.white('Ping'.padEnd(22)) + latencyBar(pingMs));

  printResult('Jitter', chalk.white(`${jitterMs.toFixed(1)} ms`), jitterMs > 20 ? 'warn' : 'ok');

  let dlStatus = downloadMbps >= 25 ? 'ok' : downloadMbps >= 5 ? 'warn' : 'critical';
  let ulStatus = uploadMbps >= 10 ? 'ok' : uploadMbps >= 2 ? 'warn' : 'critical';
  let pingStatus = pingMs <= 30 ? 'ok' : pingMs <= 80 ? 'warn' : 'critical';

  printSectionFooter();

  return [
    { name: 'Download', status: dlStatus, info: `${downloadMbps.toFixed(1)} Mbps` },
    { name: 'Upload', status: ulStatus, info: `${uploadMbps.toFixed(1)} Mbps` },
    { name: 'Ping', status: pingStatus, info: `${pingMs.toFixed(0)} ms` },
  ];
}
