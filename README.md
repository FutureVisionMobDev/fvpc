# FVPC — Future Vision PC

> IT-grade PC health check and auto-fix CLI by **Future Vision Mobile Dev**.  
> Diagnoses disk, memory, network, CPU, cache, email, Adobe, SMB, VPN, firewall, and more — then fixes what it can.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)]()
[![License](https://img.shields.io/badge/license-ISC-lightgrey)]()

---

## ⚡ One-Click Install

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/FutureVisionMobDev/fvpc/main/install.ps1 | iex
```

### Linux / macOS (bash)
```bash
curl -fsSL https://raw.githubusercontent.com/FutureVisionMobDev/fvpc/main/install.sh | bash
```

### Via npm (any platform)
```bash
npm install -g github:FutureVisionMobDev/fvpc
```

> **Requires Node.js 18+** — [Download here](https://nodejs.org)

---

## 🚀 Usage

### Interactive shell (recommended)
Run `fvpc` — an interactive prompt opens where you type commands:

```
fvpc ›  check disk
fvpc ›  check email
fvpc ›  check all
fvpc ›  fix
fvpc ›  summary
fvpc ›  update
fvpc ›  exit
```

Press **Tab** to autocomplete commands.

### One-shot flags (scripting / CI)
```bash
fvpc --all               # run all checks and exit
fvpc --disk --memory     # run specific checks
fvpc --email             # email / Outlook diagnostics
fvpc --firewall          # firewall + Defender status
fvpc --all --fix         # run all + auto-fix
fvpc --update            # update to latest version
```

---

## 🔍 What It Checks

### Hardware & System
| Check | What it looks at |
|---|---|
| `disk` | Usage % per drive, free space, warns at 75%+ |
| `memory` | RAM usage, swap, warns at 75%+ |
| `network` | Internet connectivity, interfaces, dropped packets |
| `cache` | Windows Temp, npm, pip, Chrome/Edge cache (live progress) |
| `processes` | Zombie processes, high CPU/RAM hogs |
| `cpu` | Load %, clock speed, per-core, temperature |
| `battery` | Level %, voltage, cycle count, health % |
| `speed` | Download/upload Mbps, ping, jitter |

### IT Support (Windows / macOS / Linux)
| Check | What it looks at |
|---|---|
| `windows` | OS edition, build, activation, pending updates, uptime, pagefile |
| `email` | Outlook process, SMTP/IMAP port reachability, OST/PST folder size |
| `smb` | Mapped drives (`net use`), OneDrive sync, Teams & SharePoint cache |
| `adobe` | Creative Cloud process, licensing service, log errors, CC cache size |
| `accounts` | Domain join, Azure AD/Entra, profile size, Group Policy, credentials |
| `printer` | Installed printers, default printer, print queue stuck jobs |
| `vpn` | VPN profiles, TAP/TUN/utun adapters, VPN client processes |
| `firewall` | Firewall profiles, Windows Defender, real-time protection, Gatekeeper (Mac) |

---

## 🔧 What `fix` Does

| Issue | Fix applied |
|---|---|
| Oversized caches | Clears Temp, npm, pip, browser cache (safe allowlist only, locked files skipped) |
| Zombie processes | Kills via `taskkill /F` (Windows) or `SIGKILL` (Mac/Linux) |
| Low disk space | Runs `cleanmgr`, empties Recycle Bin (Windows) / `apt-get clean` (Linux) |

---

## 📖 Shell Commands

| Command | Description |
|---|---|
| `check <name>` | Run a single check |
| `check all` | Run all standard checks with live spinners |
| `fix` | Auto-fix issues from last scan |
| `summary` | Reprint last scan summary with timestamp |
| `update` | Check for & install latest version |
| `version` | Show installed version |
| `clear` | Clear the screen |
| `help` | Show command list |
| `exit` / `quit` | Leave FVPC |

---

## 🌐 Flag Reference

| Flag | Description |
|---|---|
| `--all` | Run all checks non-interactively |
| `--disk` | Disk check |
| `--memory` | Memory check |
| `--network` | Network check |
| `--cache` | Cache check |
| `--processes` | Process check |
| `--cpu` | CPU check |
| `--battery` | Battery check |
| `--speed` | Speed test |
| `--windows` | Windows / macOS / Linux OS health |
| `--email` | Email & Outlook diagnostics |
| `--smb` | SMB drives & cloud sync |
| `--adobe` | Adobe CC license & process |
| `--accounts` | Domain, profile, GP, credentials |
| `--printer` | Printers & print queue |
| `--vpn` | VPN connections & adapters |
| `--firewall` | Firewall & AV status |
| `--fix` | Auto-fix after checks |
| `--update` | Update to latest version |
| `--no-welcome` | Skip the welcome banner |
| `--help` | Show help |
| `--version` | Show version |

---

## 🏗 Project Structure

```
fvpc/
├── bin/
│   └── fvpc.js             # CLI entry point
├── src/
│   ├── checks/
│   │   ├── disk.js         # Disk usage
│   │   ├── memory.js       # RAM & swap
│   │   ├── network.js      # Network & DNS
│   │   ├── cache.js        # Cache sizes (live progress)
│   │   ├── processes.js    # Process health
│   │   ├── cpu.js          # CPU load & temp
│   │   ├── battery.js      # Battery health
│   │   ├── speed.js        # Internet speed
│   │   ├── windows.js      # OS health (Win/Mac/Linux)
│   │   ├── email.js        # Outlook & email ports
│   │   ├── smb.js          # SMB drives & OneDrive
│   │   ├── adobe.js        # Adobe CC & licensing
│   │   ├── accounts.js     # Domain, profile, credentials
│   │   ├── printer.js      # Printers & print queue
│   │   ├── vpn.js          # VPN connections
│   │   └── firewall.js     # Firewall & Defender
│   ├── fixes/
│   │   ├── cache.js        # Safe cache clearing (allowlisted)
│   │   ├── processes.js    # Kill zombie procs
│   │   └── disk.js         # Disk cleanup
│   ├── ui/
│   │   ├── welcome.js      # FVPC banner
│   │   ├── report.js       # Tables, bars, scan timestamp
│   │   ├── menu.js         # Interactive check selector
│   │   └── shell.js        # Interactive REPL shell
│   └── utils/
│       ├── platform.js     # Cross-platform helpers (Win/Mac/Linux)
│       ├── updater.js      # Version check & auto-update
│       └── firstRun.js     # First-run detection
├── install.ps1             # Windows one-click installer
├── install.sh              # Linux/macOS one-click installer
└── package.json
```

---

## 🔄 Updating

```bash
fvpc --update
# or inside the shell:
fvpc ›  update
```

Shows exact install source and requires confirmation before installing. Postinstall hooks are always disabled (`--ignore-scripts`).

---

## 🤝 Contributing

1. Fork the repo
2. `npm install`
3. `node bin/fvpc.js` to run locally
4. Add a check in `src/checks/`, wire it in `src/ui/shell.js`, `src/ui/menu.js`, and `bin/fvpc.js`

---

## 📄 License

ISC © [FutureVisionMobDev](https://github.com/FutureVisionMobDev)
