#!/usr/bin/env bash
set -euo pipefail

THEME_FOLDER="Tahoe-Light or Tahoe-Dark"

REPO="arcnations-united/evolve-core"
TMP_ZIP="evolve-core-latest.zip"

APP_LAUNCHER="kayozxo/ulauncher-liquid-glass"
TMP_ZIP_AL="ulauncher-liquid-glass.zip"

# === Style Variables ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
UNDERLINE='\033[4m'
NC='\033[0m'

# === Uninstall Theme ===
if [[ "${1:-}" == "-u" ]]; then
  echo "🧹 Uninstalling Tahoe themes..."

  if [[ -d "$HOME/.themes/Tahoe-Dark" ]]; then
    rm -rf "$HOME/.themes/Tahoe-Dark"
    echo "✅ Removed ~/.themes/Tahoe-Dark"
  fi

  if [[ -d "$HOME/.themes/Tahoe-Light" ]]; then
    rm -rf "$HOME/.themes/Tahoe-Light"
    echo "✅ Removed ~/.themes/Tahoe-Light"
  fi

  echo "✨ Uninstallation complete."
  exit 0
fi

# === Banner ===
echo -e "${CYAN}${BOLD}🌄 macOS Tahoe Theme Installer${NC}"
echo

# === Detect theme selection flag ===
INSTALL_LIGHT=false
INSTALL_DARK=false

while getopts ":ld" opt; do
  case $opt in
    l)
      INSTALL_LIGHT=true
      ;;
    d)
      INSTALL_DARK=true
      ;;
    \?)
      echo -e "${RED}Invalid option: -$OPTARG${NC}" >&2
      echo
      echo -e "${BLUE}Available options: ${NC}" >&2
      echo -e "${GREEN}Light Theme: -l ${NC}" >&2
      echo -e "${GREEN}Dark Theme: -d ${NC}" >&2
      exit 1
      ;;
  esac
done

# === Default: Install both if no flag is passed ===
if ! $INSTALL_LIGHT && ! $INSTALL_DARK; then
  INSTALL_LIGHT=true
  INSTALL_DARK=true
fi

# === Ensure ~/.themes exists ===
THEME_DIR="$HOME/.themes"
if [ ! -d "$THEME_DIR" ]; then
  echo -e "${BLUE}📁 Creating ~/.themes directory...${NC}"
  mkdir -p "$THEME_DIR"
else
  echo -e "${GREEN}✓ ~/.themes directory already exists.${NC}"
fi

# === Determine script path ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GTK_DIR="$SCRIPT_DIR/gtk"

# === Install Themes ===

if $INSTALL_LIGHT; then
  LIGHT_SRC="$GTK_DIR/Tahoe-Light"
  if [ -d "$LIGHT_SRC" ]; then
    echo -e "${CYAN}📦 Installing Tahoe-Light...${NC}"
    rm -rf "$THEME_DIR/Tahoe-Light"
    cp -r "$LIGHT_SRC" "$THEME_DIR/"
    echo -e "${GREEN}✓ Tahoe-Light installed.${NC}"
  else
    echo -e "${RED}⚠️  Tahoe-Light theme folder not found.${NC}"
  fi
fi

if $INSTALL_DARK; then
  DARK_SRC="$GTK_DIR/Tahoe-Dark"
  if [ -d "$DARK_SRC" ]; then
    echo -e "${CYAN}📦 Installing Tahoe-Dark...${NC}"
    rm -rf "$THEME_DIR/Tahoe-Dark"
    cp -r "$DARK_SRC" "$THEME_DIR/"
    echo -e "${GREEN}✓ Tahoe-Dark installed.${NC}"
  else
    echo -e "${RED}⚠️  Tahoe-Dark theme folder not found.${NC}"
  fi
fi

echo
echo -e "${GREEN}${BOLD}🎉 Tahoe Themes installed!${NC}"

# === Download Ulauncher Theme ===
echo
echo
echo -e "${CYAN}${BOLD}🌐 Downloading latest release of '$APP_LAUNCHER'...${NC}"

DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$APP_LAUNCHER/releases/latest" \
  | grep '"browser_download_url":' \
  | sed -E 's/.*"([^"]+)".*/\1/')

echo -e "${BLUE}⬇️  Download URL: ${UNDERLINE}$DOWNLOAD_URL${NC}"
curl -L -o "$TMP_ZIP_AL" "$DOWNLOAD_URL"

echo -e "${YELLOW}📦 Extracting ZIP to ${BOLD}~/Downloads/${NC}"
unzip -o "$TMP_ZIP_AL" -d "$HOME/Downloads/"
rm "$TMP_ZIP_AL"

bash $HOME/Downloads/ulauncher-liquid-glass-v1.0.1/install.sh

echo -e "${GREEN}${BOLD}🎉 Ulauncher Themes installed!${NC}"

# === GDM Theme ===
scripts/./gdm.sh

# === Download Evolve-Core (GUI) ===
echo
echo
echo -e "${CYAN}${BOLD}🌐 Downloading latest release of '$REPO'...${NC}"

DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"browser_download_url":' \
  | sed -E 's/.*"([^"]+)".*/\1/')

echo -e "${BLUE}⬇️  Download URL: ${UNDERLINE}$DOWNLOAD_URL${NC}"
curl -L -o "$TMP_ZIP" "$DOWNLOAD_URL"

echo -e "${YELLOW}📦 Extracting ZIP to ${BOLD}~/Downloads/Evolve${NC}"
unzip -o "$TMP_ZIP" -d "$HOME/Downloads/Evolve"
rm "$TMP_ZIP"

echo -e "${GREEN}✅ Release extracted successfully.${NC}"

echo
echo -e "${CYAN}${BOLD}🎨 Finalized installation in ~/.themes/${NC}"
echo -e "${BLUE}👉 Open Downloads folder and look for the '${BOLD}Evolve${NC}${BLUE}' folder"
echo -e "${BLUE}   • Launch the app and select:${NC}"
echo -e "${BLUE}     → GTK 3.0 Theme and GTK 4.0 → '${BOLD}$THEME_FOLDER${NC}${BLUE}'${NC}"

echo
echo -e "${GREEN}${BOLD}Enjoy the theme! 🍎${NC}"
exit 0