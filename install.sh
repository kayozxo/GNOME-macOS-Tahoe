#!/usr/bin/env bash
set -euo pipefail

if ! command -v xdg-user-dir >/dev/null; then
  echo -e "${YELLOW}⚠️ xdg-user-dir not found. Falling back to ~/Downloads.${NC}"
  DOWNLOADS_DIR="$HOME/Downloads"
else
  DOWNLOADS_DIR="$(xdg-user-dir DOWNLOAD)"
fi

THEME_FOLDER="Tahoe-Light or Tahoe-Dark"

APP_LAUNCHER="kayozxo/ulauncher-liquid-glass"
TMP_ZIP_AL="ulauncher-liquid-glass.zip"
GTK4_CONFIG_DIR="$HOME/.config/gtk-4.0"

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
  echo

  if [[ -d "$HOME/.themes/Tahoe-Dark" ]]; then
    rm -rf "$HOME/.themes/Tahoe-Dark"
    echo "✅ Removed Tahoe-Dark from ~/.themes"
  fi

  if [[ -d "$HOME/.themes/Tahoe-Light" ]]; then
    rm -rf "$HOME/.themes/Tahoe-Light"
    echo "✅ Removed Tahoe-Light from ~/.themes"
  fi

  if [[ -d "$HOME/.config/gtk-4.0/" ]]; then
    rm -rf "$GTK4_CONFIG_DIR/"{gtk.css,gtk-dark.css,gtk-Light.css,gtk-Dark.css,assets,windows-assets}
    echo "✅ Removed everything in gtk-4.0 from ~/.config"
  fi

  if [[ -d "$DOWNLOADS_DIR/WhiteSur-gtk-theme" ]]; then
    sudo bash $DOWNLOADS_DIR/WhiteSur-gtk-theme/tweaks.sh -g -r
    rm -rf "$DOWNLOADS_DIR/WhiteSur-gtk-theme"
    echo "✅ Uninstalled WhiteSur GDM theme"
  fi

  if [[ -d "$DOWNLOADS_DIR/MacTahoe-icon-theme" ]]; then
    sudo bash $DOWNLOADS_DIR/MacTahoe-icon-theme/install.sh -r
    rm -rf "$DOWNLOADS_DIR/MacTahoe-icon-theme"
    echo "✅ Uninstalled MacTahoe icon theme"
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
INSTALL_LIBADWAITA=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -l)
      INSTALL_LIGHT=true
      ;;
    -d)
      INSTALL_DARK=true
      ;;
    -la)
      INSTALL_LIBADWAITA=true
      ;;
    *)
      echo -e "${RED}Invalid option: $1${NC}"
      echo -e "${BLUE}Available options:${NC}"
      echo -e "${GREEN}-l ${NC}Install Light theme"
      echo -e "${GREEN}-d ${NC}Install Dark theme"
      echo -e "${GREEN}-la${NC}Install Libadwaita override"
      exit 1
      ;;
  esac
  shift
done

# === Default: Install both if no flag is passed ===
if ! $INSTALL_LIGHT && ! $INSTALL_DARK && ! $INSTALL_LIBADWAITA; then
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

if $INSTALL_LIBADWAITA; then
  echo
  echo -e "${CYAN}🎯 Installing libadwaita override...${NC}"

  if $INSTALL_LIGHT; then
    LIBADWAITA_SRC="$SCRIPT_DIR/gtk/Tahoe-Light/gtk-4.0"
  elif $INSTALL_DARK; then
    LIBADWAITA_SRC="$SCRIPT_DIR/gtk/Tahoe-Dark/gtk-4.0"
  else
    echo -e "${RED}⚠️  Please specify -l or -d with -la to choose Light or Dark variant.${NC}"
    exit 1
  fi

  mkdir -p "$GTK4_CONFIG_DIR"

  if [ -d "$LIBADWAITA_SRC" ]; then
    echo -e "${BLUE}📁 Copying Tahoe theme from $LIBADWAITA_SRC${NC}"
    rm -rf "$GTK4_CONFIG_DIR/"{gtk.css,gtk-dark.css,gtk-Light.css,gtk-Dark.css,assets,windows-assets}
    cp -r "$LIBADWAITA_SRC/"* "$GTK4_CONFIG_DIR/"
    echo -e "${GREEN}✓ Installed libadwaita override in ~/.config/gtk-4.0${NC}"
    exit 0
  else
    echo -e "${RED}❌ Libadwaita theme folder not found at $LIBADWAITA_SRC${NC}"
    exit 1
  fi
fi

echo
echo -e "${GREEN}${BOLD}🎉 Tahoe Themes installed!${NC}"

# === Download Ulauncher Theme ===
echo
echo

read -p "$(echo -e "${CYAN}❓ Do you want to install Ulauncher themes? (yes/no): ${NC}")" answer
if [[ "$answer" != "yes" && "$answer" != "y" ]]; then
    echo -e "${YELLOW}⚠️ Skipping Ulauncher theme installation.${NC}"
    echo
else
    echo -e "${CYAN}${BOLD}🌐 Downloading latest release of '$APP_LAUNCHER'...${NC}"

    DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$APP_LAUNCHER/releases/latest" \
      | grep '"browser_download_url":' \
      | sed -E 's/.*"([^"]+)".*/\1/')

    echo -e "${BLUE}⬇️  Download URL: ${UNDERLINE}$DOWNLOAD_URL${NC}"
    curl -L -o "$TMP_ZIP_AL" "$DOWNLOAD_URL"

    echo -e "${YELLOW}📦 Extracting ZIP to ${BOLD}~/Downloads/${NC}"
    unzip -o "$TMP_ZIP_AL" -d "$DOWNLOADS_DIR"
    rm "$TMP_ZIP_AL"

    bash $DOWNLOADS_DIR/ulauncher-liquid-glass-v1.0.2/install.sh
fi

read -p "$(echo -e "${CYAN}❓ Do you want to install Tahoe icons? (yes/no): ${NC}")" answer
if [[ "$answer" != "yes" && "$answer" != "y" ]]; then
    echo -e "${YELLOW}⚠️ Skipping icons theme installation.${NC}"
    echo
else
    ICON_THEME_DIR="$DOWNLOADS_DIR/MacTahoe-icon-theme"

    if [ -d "$ICON_THEME_DIR" ]; then
      echo -e "${YELLOW}⚠️  Folder '$ICON_THEME_DIR' already exists. Removing it...${NC}"
      rm -rf "$ICON_THEME_DIR"
      echo -e "${GREEN}✓ Removed existing folder.${NC}"
    fi

    echo -e "${BLUE}Cloning MacTahoe-icon-theme...${NC}"
    echo

    git clone https://github.com/vinceliuice/MacTahoe-icon-theme.git --depth=1 $DOWNLOADS_DIR/MacTahoe-icon-theme

    echo -e "${BLUE}Installing MacTahoe-icon-theme...${NC}"
    echo

    sudo bash $DOWNLOADS_DIR/MacTahoe-icon-theme/install.sh -b

    echo -e "${GREEN}${BOLD}🎉 Icon Theme installed!${NC}"
    echo
fi

read -p "$(echo -e "${CYAN}❓ Do you want to install WhiteSur cursors? (yes/no): ${NC}")" answer
if [[ "$answer" != "yes" && "$answer" != "y" ]]; then
    echo -e "${YELLOW}⚠️ Skipping cursor theme installation.${NC}"
    echo
else
    CURSOR_THEME_DIR="$DOWNLOADS_DIR/WhiteSur-cursors"

    if [ -d "$CURSOR_THEME_DIR" ]; then
      echo -e "${YELLOW}⚠️  Folder '$CURSOR_THEME_DIR' already exists. Removing it...${NC}"
      rm -rf "$CURSOR_THEME_DIR"
      echo -e "${GREEN}✓ Removed existing folder.${NC}"
    fi

    echo -e "${BLUE}Cloning WhiteSur-cursors...${NC}"
    echo

    git clone https://github.com/vinceliuice/WhiteSur-cursors.git --depth=1 $DOWNLOADS_DIR/WhiteSur-cursors

    echo -e "${BLUE}Installing WhiteSur-cursors...${NC}"
    echo

    sudo bash $DOWNLOADS_DIR/WhiteSur-cursors/install.sh

    echo -e "${GREEN}${BOLD}🎉 Cursor Theme installed!${NC}"
    echo
fi

# === GDM Theme ===
read -p "$(echo -e "${CYAN}❓ Do you want to install GDM Theme? (yes/no): ${NC}")" answer
if [[ "$answer" != "yes" && "$answer" != "y" ]]; then
    echo -e "${YELLOW}⚠️ Skipping GDM theme installation.${NC}"
    echo
else
  THEME_CLONE_DIR="$DOWNLOADS_DIR/WhiteSur-gtk-theme"

  if [ -d "$THEME_CLONE_DIR" ]; then
    echo -e "${YELLOW}⚠️  Folder '$THEME_CLONE_DIR' already exists. Removing it...${NC}"
    rm -rf "$THEME_CLONE_DIR"
    echo -e "${GREEN}✓ Removed existing folder.${NC}"
  fi

  echo -e "${BLUE}Cloning WhiteSur...${NC}"
  echo

  git clone https://github.com/vinceliuice/WhiteSur-gtk-theme.git --depth=1 $DOWNLOADS_DIR/WhiteSur-gtk-theme

  echo -e "${BLUE}Installing WhiteSur GDM...${NC}"
  echo

  sudo bash $DOWNLOADS_DIR/WhiteSur-gtk-theme/tweaks.sh -g -b default

  echo -e "${GREEN}${BOLD}🎉 GDM Theme installed!${NC}"
  echo

  echo -e "${GREEN}In order to set custom background to GDM, use this command: ${UNDERLINE}sudo bash $DOWNLOADS_DIR/WhiteSur-gtk-theme/tweaks.sh -g -b 'my picture.jpg'${NC}"

  echo
fi

echo -e "${GREEN}${BOLD}Enjoy the theme! 🍎${NC}"
exit 0