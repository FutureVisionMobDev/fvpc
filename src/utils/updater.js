import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import chalk from 'chalk';

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export function getLocalVersion() {
  try {
    const pkg = require(join(__dirname, '../../package.json'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function fetchRemoteVersion(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const url = 'https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/package.json';
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const pkg = JSON.parse(data);
          resolve(pkg.version || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

export async function checkForUpdate() {
  const local = getLocalVersion();
  const remote = await fetchRemoteVersion();
  if (!remote) return null;
  if (semverGt(remote, local)) return { local, remote };
  return null;
}

export function printUpdateNotice(update) {
  if (!update) return;
  console.log(
    chalk.yellow('\n  ┌─ UPDATE AVAILABLE ─────────────────────────────────┐')
  );
  console.log(
    chalk.yellow('  │ ') +
    chalk.white(`v${update.local}`) +
    chalk.dim(' → ') +
    chalk.green.bold(`v${update.remote}`) +
    chalk.dim('   run: ') +
    chalk.cyan('pcdoc update') +
    chalk.yellow('                  │')
  );
  console.log(chalk.yellow('  └────────────────────────────────────────────────────┘\n'));
}

export async function runUpdate() {
  console.log(chalk.cyan('\n  Updating pcdoc from GitHub...\n'));

  const local = getLocalVersion();
  console.log(chalk.dim(`  Current version: v${local}`));

  const remote = await fetchRemoteVersion();
  if (remote && !semverGt(remote, local)) {
    console.log(chalk.green.bold(`\n  Already on latest (v${local}). Nothing to do.\n`));
    return;
  }
  if (remote) {
    console.log(chalk.dim(`  Latest version:  v${remote}`));
  }

  console.log(chalk.cyan('\n  Running: npm install -g github:FutureVisionMobDev/pcdoc --ignore-scripts\n'));

  try {
    const { stdout, stderr } = await execAsync(
      'npm install -g github:FutureVisionMobDev/pcdoc --ignore-scripts',
      { timeout: 120000 }
    );
    if (stdout) console.log(chalk.dim(stdout.trim()));
    if (stderr && !stderr.includes('WARN')) console.log(chalk.dim(stderr.trim()));
    console.log(chalk.green.bold(`\n  pcdoc updated successfully to v${remote || 'latest'}!\n`));
    console.log(chalk.dim('  Restart your terminal then run pcdoc again.\n'));
  } catch (err) {
    console.log(chalk.red('\n  Update failed: ') + err.message);
    console.log(chalk.dim('  Try manually: npm install -g github:FutureVisionMobDev/pcdoc --ignore-scripts\n'));
  }
}
