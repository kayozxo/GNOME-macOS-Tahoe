#!/usr/bin/env bash
set -euo pipefail

# === Style Variables ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
UNDERLINE='\033[4m'
NC='\033[0m'

echo
echo -e "${CYAN}${BOLD}🔒 GDM Theme Installer${NC}"
echo

THEME_CLONE_DIR="$HOME/Downloads/WhiteSur-gtk-theme"

if [ -d "$THEME_CLONE_DIR" ]; then
  echo -e "${YELLOW}⚠️  Folder '$THEME_CLONE_DIR' already exists. Removing it...${NC}"
  rm -rf "$THEME_CLONE_DIR"
  echo -e "${GREEN}✓ Removed existing folder.${NC}"
fi

echo -e "${BLUE}Cloning WhiteSur...${NC}"
echo

git clone https://github.com/vinceliuice/WhiteSur-gtk-theme.git --depth=1 $HOME/Downloads/WhiteSur-gtk-theme

echo -e "${BLUE}Installing WhiteSur GDM...${NC}"
echo

sudo bash $HOME/Downloads/WhiteSur-gtk-theme/tweaks.sh -g -b default

echo -e "${GREEN}${BOLD}🎉 GDM Theme installed!${NC}"
echo

echo -e "${GREEN}In order to set custom background to GDM, use this command: ${UNDERLINE}sudo bash $HOME/Downloads/WhiteSur-gtk-theme/tweaks.sh -g -b 'my picture.jpg'${NC}"