import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import chalk from 'chalk';
import inquirer from 'inquirer';

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

const UPDATE_SOURCE = 'github:FutureVisionMobDev/pcdoc';
const UPDATE_SOURCE_URL = 'https://github.com/FutureVisionMobDev/pcdoc';

export async function runUpdate() {
  console.log(chalk.cyan('\n  pcdoc Update\n'));

  const local = getLocalVersion();
  console.log(chalk.dim(`  Installed : v${local}`));

  const remote = await fetchRemoteVersion();

  if (remote && !semverGt(remote, local)) {
    console.log(chalk.green.bold(`  Latest    : v${remote}  ✔ already up to date\n`));
    return;
  }

  if (remote) {
    console.log(chalk.white(`  Latest    : v${remote}`));
  } else {
    console.log(chalk.dim('  Latest    : (could not reach GitHub)'));
  }

  // Show exactly what will be installed and ask for confirmation
  console.log('');
  console.log(chalk.yellow('  ┌─ INSTALL SOURCE ───────────────────────────────────┐'));
  console.log(chalk.yellow('  │ ') + chalk.white(UPDATE_SOURCE_URL));
  console.log(chalk.yellow('  │ ') + chalk.dim('npm install -g ' + UPDATE_SOURCE + ' --ignore-scripts'));
  console.log(chalk.yellow('  │ ') + chalk.dim('--ignore-scripts: postinstall hooks are DISABLED'));
  console.log(chalk.yellow('  └────────────────────────────────────────────────────┘'));
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: chalk.white(`Install v${remote || 'latest'} from ${UPDATE_SOURCE_URL}?`),
    default: false,
  }]);

  if (!confirm) {
    console.log(chalk.dim('\n  Update cancelled.\n'));
    return;
  }

  console.log(chalk.cyan(`\n  Installing from ${UPDATE_SOURCE}...\n`));

  try {
    const { stdout, stderr } = await execAsync(
      `npm install -g ${UPDATE_SOURCE} --ignore-scripts`,
      { timeout: 120000 }
    );
    if (stdout) console.log(chalk.dim(stdout.trim()));
    if (stderr && !stderr.includes('WARN')) console.log(chalk.dim(stderr.trim()));
    console.log(chalk.green.bold(`\n  Updated to v${remote || 'latest'} successfully!\n`));
    console.log(chalk.dim('  Open a new terminal then run pcdoc again.\n'));
  } catch (err) {
    console.log(chalk.red('\n  Update failed: ') + err.message);
    console.log(chalk.dim(`  Try manually: npm install -g ${UPDATE_SOURCE} --ignore-scripts\n`));
  }
}
