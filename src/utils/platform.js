import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

export const isWin   = process.platform === 'win32';
export const isMac   = process.platform === 'darwin';
export const isLinux = process.platform === 'linux';

export async function sh(cmd, timeout = 6000) {
  try {
    const { stdout } = await execAsync(cmd, { timeout });
    return stdout.trim();
  } catch { return ''; }
}

export async function ps(cmd, timeout = 6000) {
  if (!isWin) return '';
  return sh(`powershell -NoProfile -NonInteractive -Command "${cmd}"`, timeout);
}

// Cross-platform path helpers
export function appDataPath(...parts) {
  if (isWin)   return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), ...parts);
  if (isMac)   return path.join(os.homedir(), 'Library', 'Application Support', ...parts);
  return path.join(os.homedir(), '.config', ...parts);
}

export function localAppDataPath(...parts) {
  if (isWin)   return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), ...parts);
  if (isMac)   return path.join(os.homedir(), 'Library', 'Caches', ...parts);
  return path.join(os.homedir(), '.cache', ...parts);
}

export function logsPath(...parts) {
  if (isWin)   return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), ...parts);
  if (isMac)   return path.join(os.homedir(), 'Library', 'Logs', ...parts);
  return path.join(os.homedir(), '.local', 'share', ...parts);
}

export function homePath(...parts) {
  return path.join(os.homedir(), ...parts);
}

export function platformLabel() {
  if (isWin)   return 'Windows';
  if (isMac)   return 'macOS';
  return 'Linux';
}
