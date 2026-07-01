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
    Write-Host "  Installing PC Doctor..." -ForegroundColor White
    Write-Host ""
}

function Check-Node {
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
            if ($major -ge 18) {
                Write-Host "  [OK] Node.js $nodeVersion found" -ForegroundColor Green
                return $true
            } else {
                Write-Host "  [WARN] Node.js $nodeVersion is too old (need v18+)" -ForegroundColor Yellow
                return $false
            }
        }
    } catch {}
    return $false
}

function Install-Node {
    Write-Host "  [INFO] Node.js not found. Opening download page..." -ForegroundColor Yellow
    Write-Host "  Please install Node.js v18+ from https://nodejs.org" -ForegroundColor White
    Start-Process "https://nodejs.org/en/download"
    Write-Host ""
    Write-Host "  After installing Node.js, rerun this script:" -ForegroundColor Cyan
    Write-Host "  irm https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/install.ps1 | iex" -ForegroundColor White
    exit 1
}

function Install-PcDoc {
    Write-Host "  [INFO] Installing pcdoc globally..." -ForegroundColor Cyan
    npm install -g github:FutureVisionMobDev/pcdoc
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Install failed. Check your internet connection." -ForegroundColor Red
        exit 1
    }
}

function Show-Done {
    Write-Host ""
    Write-Host "  ====================================" -ForegroundColor Green
    Write-Host "   PC Doctor installed successfully!" -ForegroundColor Green
    Write-Host "  ====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Run it now:" -ForegroundColor White
    Write-Host "    pcdoc              # interactive shell" -ForegroundColor Cyan
    Write-Host "    pcdoc --all        # run all checks" -ForegroundColor Cyan
    Write-Host "    pcdoc --all --fix  # run all + auto-fix" -ForegroundColor Cyan
    Write-Host "    pcdoc --help       # show all options" -ForegroundColor Cyan
    Write-Host ""
}

Write-Header

if (-not (Check-Node)) {
    Install-Node
}

Install-PcDoc
Show-Done
