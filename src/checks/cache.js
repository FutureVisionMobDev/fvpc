import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { printSectionHeader, printResult, printSectionFooter } from '../ui/report.js';

const CACHE_DIRS = {
  win32: [
    { label: 'Windows Temp', dir: process.env.TEMP || path.join(os.homedir(), 'AppData\\Local\\Temp') },
    { label: 'npm cache', dir: path.join(os.homedir(), 'AppData\\Roaming\\npm-cache') },
    { label: 'Yarn cache', dir: path.join(os.homedir(), 'AppData\\Local\\Yarn\\Cache') },
    { label: 'pip cache', dir: path.join(os.homedir(), 'AppData\\Local\\pip\\Cache') },
    { label: 'Chrome cache', dir: path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache') },
    { label: 'Edge cache', dir: path.join(os.homedir(), 'AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache') },
  ],
  linux: [
    { label: '/tmp', dir: '/tmp' },
    { label: 'npm cache', dir: path.join(os.homedir(), '.npm') },
    { label: 'pip cache', dir: path.join(os.homedir(), '.cache/pip') },
    { label: 'apt lists', dir: '/var/lib/apt/lists' },
  ],
  darwin: [
    { label: 'Mac Caches', dir: path.join(os.homedir(), 'Library/Caches') },
    { label: 'npm cache', dir: path.join(os.homedir(), '.npm') },
    { label: '/tmp', dir: '/tmp' },
  ],
};

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024)        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024)               return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

async function dirSizeBytes(dirPath, onProgress) {
  try {
    let total = 0;
    let fileCount = 0;
    const walk = async (p) => {
      let entries;
      try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(p, e.name);
        try {
          if (e.isDirectory()) {
            await walk(full);
          } else {
            total += fs.statSync(full).size;
            fileCount++;
            // yield every 200 files so spinner can animate
            if (fileCount % 200 === 0) {
              if (onProgress) onProgress(total, fileCount);
              await new Promise((r) => setImmediate(r));
            }
          }
        } catch {}
      }
    };
    await walk(dirPath);
    return total;
  } catch {
    return null;
  }
}

export async function checkCache() {
  printSectionHeader('CACHE');

  const platform = os.platform();
  const dirs = CACHE_DIRS[platform] || CACHE_DIRS.linux;
  const results = [];
  let totalMB = 0;

  const spinner = ora({
    color: 'cyan',
    spinner: 'dots',
  }).start();

  for (const { label, dir } of dirs) {
    if (!fs.existsSync(dir)) continue;

    spinner.text = chalk.dim(`Scanning ${label}...`);
    await new Promise((r) => setImmediate(r));

    const bytes = await dirSizeBytes(dir, (soFar, files) => {
      spinner.text = chalk.dim(`Scanning ${label}... `) + chalk.cyan(`${files.toLocaleString()} files / ${formatSize(soFar)}`);
    });
    if (bytes === null) continue;

    const mbNum = bytes / (1024 * 1024);
    totalMB += mbNum;

    let status = 'ok';
    if (mbNum >= 2000) status = 'critical';
    else if (mbNum >= 500) status = 'warn';

    const sizeLabel = formatSize(bytes);

    spinner.stop();
    printResult(label, chalk.white(sizeLabel), status);
    spinner.start();

    results.push({ name: label, status, info: sizeLabel, dir, mbNum });
  }

  spinner.stop();

  const totalLabel = formatSize(totalMB * 1024 * 1024);
  printResult(
    'Total cache',
    chalk.white(totalLabel),
    totalMB >= 5000 ? 'critical' : totalMB >= 1000 ? 'warn' : 'ok'
  );
  printSectionFooter();

  return results;
}
