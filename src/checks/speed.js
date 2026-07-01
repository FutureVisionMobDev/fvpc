import chalk from 'chalk';
import ora from 'ora';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

const CF_DOWN  = 'https://speed.cloudflare.com/__down?bytes=25000000'; // 25 MB
const CF_UP    = 'https://speed.cloudflare.com/__up';
const CF_PING  = 'https://speed.cloudflare.com/';

function speedBar(mbps, max = 100, width = 20) {
  const pct    = Math.min(100, (mbps / max) * 100);
  const filled = Math.round((pct / 100) * width);
  const color  = mbps >= 50 ? chalk.green : mbps >= 10 ? chalk.yellow : chalk.red;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled)) + chalk.dim(` ${mbps.toFixed(1)} Mbps`);
}

function latBar(ms, width = 20) {
  const pct    = Math.min(100, (ms / 200) * 100);
  const filled = Math.round((pct / 100) * width);
  const color  = ms <= 30 ? chalk.green : ms <= 80 ? chalk.yellow : chalk.red;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled)) + chalk.dim(` ${ms.toFixed(0)} ms`);
}

async function measurePing(attempts = 6) {
  const times = [];
  for (let i = 0; i < attempts; i++) {
    const t0 = performance.now();
    try { await fetch(CF_PING, { method: 'HEAD', signal: AbortSignal.timeout(4000) }); }
    catch { continue; }
    times.push(performance.now() - t0);
  }
  if (!times.length) return null;
  times.sort((a, b) => a - b);
  times.pop(); // drop worst
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const jitter = Math.max(...times) - Math.min(...times);
  return { avg, jitter };
}

async function measureDownload() {
  const t0  = performance.now();
  const res = await fetch(CF_DOWN, { signal: AbortSignal.timeout(30000) });
  const buf = await res.arrayBuffer();
  const sec = (performance.now() - t0) / 1000;
  return (buf.byteLength * 8) / (sec * 1e6); // Mbps
}

async function measureUpload() {
  const size = 10 * 1024 * 1024; // 10 MB
  const data = new Uint8Array(size);
  const t0   = performance.now();
  await fetch(CF_UP, {
    method: 'POST',
    body: data,
    headers: { 'Content-Type': 'application/octet-stream' },
    signal: AbortSignal.timeout(30000),
  });
  const sec = (performance.now() - t0) / 1000;
  return (size * 8) / (sec * 1e6); // Mbps
}

export async function checkSpeed() {
  printSectionHeader('INTERNET SPEED');

  // --- Ping ---
  const spinPing = ora({ text: chalk.dim('Measuring ping...'), color: 'cyan', spinner: 'dots' }).start();
  let pingResult = null;
  try { pingResult = await measurePing(); } catch {}
  spinPing.stop();

  const pingMs   = pingResult?.avg ?? 0;
  const jitterMs = pingResult?.jitter ?? 0;
  const pingStatus = !pingResult ? 'critical' : pingMs <= 30 ? 'ok' : pingMs <= 80 ? 'warn' : 'critical';

  if (pingResult) {
    console.log(chalk.cyan('│ ') + chalk.white('Ping'.padEnd(22)) + latBar(pingMs));
    printResult('  Jitter', chalk.white(`${jitterMs.toFixed(1)} ms`), jitterMs > 20 ? 'warn' : 'ok');
  } else {
    printResult('Ping', chalk.red('unreachable'), 'critical');
    printSectionFooter();
    return [{ name: 'Speed test', status: 'critical', info: 'no connectivity' }];
  }

  // --- Download ---
  const spinDl = ora({ text: chalk.dim('Testing download...'), color: 'cyan', spinner: 'dots' }).start();
  let dlMbps = 0;
  try { dlMbps = await measureDownload(); } catch {}
  spinDl.stop();

  const max = Math.max(dlMbps, 100);
  console.log(chalk.cyan('│ ') + chalk.white('Download'.padEnd(22)) + speedBar(dlMbps, max));
  const dlStatus = dlMbps >= 25 ? 'ok' : dlMbps >= 5 ? 'warn' : 'critical';

  // --- Upload ---
  const spinUl = ora({ text: chalk.dim('Testing upload...'), color: 'cyan', spinner: 'dots' }).start();
  let ulMbps = 0;
  try { ulMbps = await measureUpload(); } catch {}
  spinUl.stop();

  console.log(chalk.cyan('│ ') + chalk.white('Upload'.padEnd(22)) + speedBar(ulMbps, max));
  const ulStatus = ulMbps >= 10 ? 'ok' : ulMbps >= 2 ? 'warn' : 'critical';

  printSectionFooter();

  return [
    { name: 'Ping',     status: pingStatus, info: `${pingMs.toFixed(0)} ms` },
    { name: 'Download', status: dlStatus,   info: `${dlMbps.toFixed(1)} Mbps` },
    { name: 'Upload',   status: ulStatus,   info: `${ulMbps.toFixed(1)} Mbps` },
  ];
}
