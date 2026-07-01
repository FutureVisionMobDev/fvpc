# PC Doctor - Windows Installer
# Run with: irm https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

function Write-Header {
    Write-Host ""
    Write-Host "  ____   ____    ____             _             " -ForegroundColor Cyan
    Write-Host " |  _ \ / ___|  |  _ \  ___   ___| |_ ___  _ __" -ForegroundColor Cyan
    Write-Host " | |_) | |      | | | |/ _ \ / __| __/ _ \| '__|" -ForegroundColor Cyan
    Write-Host " |  __/| |___   | |_| | (_) | (__| || (_) | |   " -ForegroundColor Cyan
    Write-Host " |_|    \____|  |____/ \___/ \___|\__\___/|_|   " -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  PC Doctor Installer" -ForegroundColor White
    Write-Host ""
}

function Get-NodeMajor {
    try {
        $v = (node --version 2>$null)
        if ($v -match 'v(\d+)') { return [int]$Matches[1] }
    } catch {}
    return 0
}

function Install-NodeWinget {
    Write-Host "  [INFO] Trying winget..." -ForegroundColor Cyan
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements 2>$null
    return $LASTEXITCODE -eq 0
}

function Install-NodeMsi {
    Write-Host "  [INFO] Fetching latest Node.js LTS version..." -ForegroundColor Cyan
    try {
        $index   = Invoke-RestMethod "https://nodejs.org/dist/index.json"
        $lts     = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
        $version = $lts.version
        $msi     = "https://nodejs.org/dist/$version/node-$version-x64.msi"
        $dest    = "$env:TEMP\node-installer.msi"

        Write-Host "  [INFO] Downloading Node.js $version..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $msi -OutFile $dest -UseBasicParsing

        Write-Host "  [INFO] Installing silently (this may take a moment)..." -ForegroundColor Cyan
        Start-Process msiexec.exe -ArgumentList "/i `"$dest`" /qn /norestart ADDLOCAL=ALL" -Wait -NoNewWindow

        Remove-Item $dest -Force -ErrorAction SilentlyContinue
        return $true
    } catch {
        Write-Host "  [ERROR] MSI install failed: $_" -ForegroundColor Red
        return $false
    }
}

function Ensure-Node {
    $major = Get-NodeMajor
    if ($major -ge 18) {
        Write-Host "  [OK] Node.js v$major found" -ForegroundColor Green
        return
    }

    if ($major -gt 0) {
        Write-Host "  [WARN] Node.js v$major is too old (need v18+). Upgrading..." -ForegroundColor Yellow
    } else {
        Write-Host "  [INFO] Node.js not found. Installing now..." -ForegroundColor Yellow
    }

    # Try winget first (built into Windows 10/11)
    $ok = $false
    try { $ok = Install-NodeWinget } catch {}

    # Fallback: download MSI directly
    if (-not $ok) { $ok = Install-NodeMsi }

    if (-not $ok) {
        Write-Host ""
        Write-Host "  [ERROR] Could not install Node.js automatically." -ForegroundColor Red
        Write-Host "  Please install manually from https://nodejs.org then rerun:" -ForegroundColor White
        Write-Host "  irm https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/install.ps1 | iex" -ForegroundColor Cyan
        exit 1
    }

    # Reload PATH so node is available in current session
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")

    $major = Get-NodeMajor
    if ($major -ge 18) {
        Write-Host "  [OK] Node.js v$major installed successfully" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Node installed but not on PATH yet. Open a new terminal and rerun the installer." -ForegroundColor Yellow
        exit 1
    }
}

function Install-PcDoc {
    Write-Host "  [INFO] Installing pcdoc..." -ForegroundColor Cyan
    npm install -g github:FutureVisionMobDev/pcdoc --ignore-scripts
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] pcdoc install failed." -ForegroundColor Red
        exit 1
    }
}

function Show-Done {
    Write-Host ""
    Write-Host "  ====================================" -ForegroundColor Green
    Write-Host "   PC Doctor installed successfully! " -ForegroundColor Green
    Write-Host "  ====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Run it:" -ForegroundColor White
    Write-Host "    pcdoc              " -NoNewline; Write-Host "# interactive shell" -ForegroundColor DarkGray
    Write-Host "    pcdoc --all        " -NoNewline; Write-Host "# run all checks"    -ForegroundColor DarkGray
    Write-Host "    pcdoc --all --fix  " -NoNewline; Write-Host "# run all + fix"     -ForegroundColor DarkGray
    Write-Host "    pcdoc --help       " -NoNewline; Write-Host "# show all options"  -ForegroundColor DarkGray
    Write-Host ""
}

Write-Header
Ensure-Node
Install-PcDoc
Show-Done
