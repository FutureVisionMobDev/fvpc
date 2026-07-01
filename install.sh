#!/usr/bin/env bash
# PC Doctor - Linux/macOS Installer
# Run with: curl -fsSL https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/install.sh | bash

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
DIM='\033[2m'
RESET='\033[0m'

print_header() {
  echo ""
  echo -e "${CYAN}  ____   ____    ____             _             ${RESET}"
  echo -e "${CYAN} |  _ \ / ___|  |  _ \  ___   ___| |_ ___  _ __${RESET}"
  echo -e "${CYAN} | |_) | |      | | | |/ _ \ / __| __/ _ \| '__|${RESET}"
  echo -e "${CYAN} |  __/| |___   | |_| | (_) | (__| || (_) | |   ${RESET}"
  echo -e "${CYAN} |_|    \____|  |____/ \___/ \___|\__\___/|_|   ${RESET}"
  echo ""
  echo -e "${WHITE}  Installing PC Doctor...${RESET}"
  echo ""
}

check_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version | sed 's/v//')
    MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
    if [ "$MAJOR" -ge 18 ]; then
      echo -e "  ${GREEN}[OK]${RESET} Node.js v${NODE_VER} found"
      return 0
    else
      echo -e "  ${YELLOW}[WARN]${RESET} Node.js v${NODE_VER} too old (need v18+)"
      return 1
    fi
  fi
  return 1
}

install_node() {
  echo -e "  ${YELLOW}[INFO]${RESET} Node.js not found. Attempting install..."

  if command -v apt-get &>/dev/null; then
    echo -e "  ${DIM}Using apt (Debian/Ubuntu)...${RESET}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif command -v brew &>/dev/null; then
    echo -e "  ${DIM}Using Homebrew (macOS)...${RESET}"
    brew install node
  elif command -v dnf &>/dev/null; then
    echo -e "  ${DIM}Using dnf (Fedora/RHEL)...${RESET}"
    sudo dnf install -y nodejs npm
  elif command -v pacman &>/dev/null; then
    echo -e "  ${DIM}Using pacman (Arch)...${RESET}"
    sudo pacman -S --noconfirm nodejs npm
  else
    echo -e "  ${RED}[ERROR]${RESET} Cannot auto-install Node.js."
    echo -e "  Please install Node.js v18+ from ${WHITE}https://nodejs.org${RESET} and rerun:"
    echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/FutureVisionMobDev/pcdoc/main/install.sh | bash${RESET}"
    exit 1
  fi
}

install_pcdoc() {
  echo -e "  ${CYAN}[INFO]${RESET} Installing pcdoc globally..."
  npm install -g github:FutureVisionMobDev/pcdoc
}

show_done() {
  echo ""
  echo -e "  ${GREEN}====================================${RESET}"
  echo -e "  ${GREEN} PC Doctor installed successfully!${RESET}"
  echo -e "  ${GREEN}====================================${RESET}"
  echo ""
  echo -e "  ${WHITE}Run it now:${RESET}"
  echo -e "    ${CYAN}pcdoc${RESET}              ${DIM}# interactive shell${RESET}"
  echo -e "    ${CYAN}pcdoc --all${RESET}        ${DIM}# run all checks${RESET}"
  echo -e "    ${CYAN}pcdoc --all --fix${RESET}  ${DIM}# run all + auto-fix${RESET}"
  echo -e "    ${CYAN}pcdoc --help${RESET}       ${DIM}# show all options${RESET}"
  echo ""
}

print_header

if ! check_node; then
  install_node
fi

install_pcdoc
show_done
