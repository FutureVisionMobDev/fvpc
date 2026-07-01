import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
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

function dirSizeMB(dirPath) {
  try {
    let total = 0;
    const walk = (p) => {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(p, e.name);
        try {
          if (e.isDirectory()) walk(full);
          else total += fs.statSync(full).size;
        } catch {}
      }
    };
    walk(dirPath);
    return (total / 1e6).toFixed(1);
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

  for (const { label, dir } of dirs) {
    if (!fs.existsSync(dir)) continue;
    const mb = dirSizeMB(dir);
    if (mb === null) continue;

    const mbNum = parseFloat(mb);
    totalMB += mbNum;

    let status = 'ok';
    if (mbNum >= 2000) status = 'critical';
    else if (mbNum >= 500) status = 'warn';

    printResult(label, chalk.white(`${mb} MB`), status);
    results.push({ name: label, status, info: `${mb} MB`, dir, mbNum });
  }

  const totalGB = (totalMB / 1024).toFixed(2);
  printResult(
    'Total cache',
    chalk.white(`${totalGB} GB`),
    totalMB >= 5000 ? 'critical' : totalMB >= 1000 ? 'warn' : 'ok'
  );
  printSectionFooter();

  return results;
}
