# 🩺 PC Doctor

> A real interactive CLI that checks your PC's health — disk, memory, network, CPU, cache, processes, battery, and internet speed — and can automatically fix common issues.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)]()
[![License](https://img.shields.io/badge/license-ISC-lightgrey)]()

---

## ⚡ One-Click Install

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/install.ps1 | iex
```

### Linux / macOS (bash)
```bash
curl -fsSL https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/install.sh | bash
```

### Via npm (any platform)
```bash
npm install -g github:FutureVisionMobDev/pcdoc
```

### Try without installing (npx)
```bash
npx github:FutureVisionMobDev/pcdoc
```

> **Requires Node.js 18+** — [Download here](https://nodejs.org)

---

## 🚀 Usage

### Interactive shell (recommended)
Just run `pcdoc` — an interactive prompt opens where you type commands:

```
pcdoc ›  check disk
pcdoc ›  check memory
pcdoc ›  check all
pcdoc ›  fix
pcdoc ›  summary
pcdoc ›  exit
```

Press **Tab** to autocomplete commands.

### One-shot flags (for scripting / CI)
```bash
pcdoc --all              # run all checks and exit
pcdoc --disk --memory    # run specific checks
pcdoc --speed            # internet speed test
pcdoc --all --fix        # run all + auto-fix issues
```

---

## 🔍 What It Checks

| Check | What it looks at |
|---|---|
| `disk` | Usage % per drive, free space, warns at 75%+ |
| `memory` | RAM active usage, swap, warns at 75%+ |
| `network` | Internet connectivity, active interfaces, dropped packets |
| `cache` | Windows Temp, npm, pip, Chrome/Edge cache sizes |
| `processes` | Zombie processes, high CPU/MEM hogs |
| `cpu` | Load %, clock speed, per-core breakdown, temperature |
| `battery` | Level %, voltage, cycle count, health % |
| `speed` | Download/upload Mbps, ping ms, jitter |

---

## 🔧 What `fix` Does

| Issue | Fix applied |
|---|---|
| Oversized caches | Clears Temp, npm cache, pip cache, browser cache |
| Zombie processes | Kills via `taskkill /F` (Windows) or `SIGKILL` (Linux/Mac) |
| Low disk space | Runs `cleanmgr`, empties Recycle Bin (Windows) / `apt-get clean` (Linux) |

---

## 📖 Shell Commands

| Command | Description |
|---|---|
| `check <name>` | Run a single check (`disk`, `memory`, `network`, `cache`, `processes`, `cpu`, `battery`, `speed`) |
| `check all` | Run all standard checks one by one with spinners |
| `fix` | Auto-fix issues from the last scan |
| `summary` | Reprint the last scan summary table |
| `clear` | Clear the screen |
| `help` | Show command list |
| `exit` / `quit` | Leave PC Doctor |

---

## 🌐 Flag Reference

| Flag | Description |
|---|---|
| `--all` | Run all checks non-interactively |
| `--disk` | Disk check only |
| `--memory` | Memory check only |
| `--network` | Network check only |
| `--cache` | Cache check only |
| `--processes` | Process check only |
| `--cpu` | CPU check only |
| `--battery` | Battery check only |
| `--speed` | Speed test only |
| `--fix` | Auto-fix after checks |
| `--no-welcome` | Skip the welcome banner |
| `--help` | Show help |
| `--version` | Show version |

---

## 🖼 Screenshots

### Welcome banner (first run)
```
╔══════════════════════════════════════════════════════╗
║  ██████╗  ██████╗     ██████╗  ██████╗  ██████╗     ║
║  ██╔══██╗██╔════╝    ██╔══██╗██╔═══██╗██╔════╝     ║
║  ██████╔╝██║         ██║  ██║██║   ██║██║          ║
║  ██╔═══╝ ██║         ██║  ██║██║   ██║██║          ║
║  ██║     ╚██████╗    ██████╔╝╚██████╔╝╚██████╗     ║
║  ╚═╝      ╚═════╝    ╚═════╝  ╚═════╝  ╚═════╝     ║
║                                                      ║
║  ▶  Your personal PC health companion               ║
║  ▶  Checks disk · memory · network · cache          ║
║  ▶  Fixes issues automatically with --fix           ║
╚══════════════════════════════════════════════════════╝
```

### Check output
```
┌─ DISK ──────────────────────────────────────────────
│ C: (1023GB)           ██████░░░░░░░░░░░░░░ 32%
│   Free space          695 GB  ✔ OK  (32% used)
└─────────────────────────────────────────────────────

┌─ MEMORY ────────────────────────────────────────────
│ RAM (16.8GB)          ███████████████░░░░░ 77%
│   Used                12.9 GB  ⚠ WARN  (3.9GB free)
└─────────────────────────────────────────────────────
```

---

## 🏗 Project Structure

```
pcdoc/
├── bin/
│   └── pcdoc.js          # CLI entry point
├── src/
│   ├── checks/
│   │   ├── disk.js       # Disk usage check
│   │   ├── memory.js     # RAM & swap check
│   │   ├── network.js    # Network & DNS check
│   │   ├── cache.js      # Cache size check
│   │   ├── processes.js  # Process health check
│   │   ├── cpu.js        # CPU load & temp check
│   │   ├── battery.js    # Battery health check
│   │   └── speed.js      # Internet speed test
│   ├── fixes/
│   │   ├── cache.js      # Clear cache dirs
│   │   ├── processes.js  # Kill zombie procs
│   │   └── disk.js       # Disk cleanup tools
│   └── ui/
│       ├── welcome.js    # ASCII banner
│       ├── report.js     # Tables, bars, icons
│       └── shell.js      # Interactive REPL shell
├── install.ps1           # Windows one-click installer
├── install.sh            # Linux/macOS one-click installer
└── package.json
```

---

## 🤝 Contributing

1. Fork the repo
2. `npm install`
3. `node bin/pcdoc.js` to run locally
4. Add a new check in `src/checks/`, wire it in `src/ui/shell.js` and `bin/pcdoc.js`

---

## 📄 License

ISC © [FutureVisionMobDev](https://github.com/FutureVisionMobDev)
