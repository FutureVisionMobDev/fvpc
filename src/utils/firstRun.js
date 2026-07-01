import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.pcdoc');
const FLAG_FILE = path.join(CONFIG_DIR, '.initialized');

export function isFirstRun() {
  return !fs.existsSync(FLAG_FILE);
}

export function markInitialized() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(FLAG_FILE, new Date().toISOString());
}
