#!/usr/bin/env bash
set -euo pipefail

# macOS Tahoe Theme Installer — Hybrid Mode (Interactive TUI default, CLI flags supported)
# Features:
#  - Install Tahoe Light/Dark themes
#  - Generate accent variants (delegates to generate_accent_variants.py)
#  - Install generated color variants
#  - Libadwaita override installation (supports specific accent variant)
#  - Install Ulauncher theme from GitHub releases
#  - Install MacTahoe icons / WhiteSur cursors / WhiteSur GDM
#  - Uninstall everything (with confirmation)
#  - Fully uses gum where available; falls back to echo/read when not present
#
# Usage:
#   ./install.sh            -> interactive TUI
#   ./install.sh -l         -> install light
#   ./install.sh -d         -> install dark
#   ./install.sh -la        -> install libadwaita override (requires -l or -d)
#   ./install.sh --colors   -> generate all accent color variants
#   ./install.sh --color blue -> generate specific accent
#   ./install.sh -u         -> uninstall
#   ./install.sh --help     -> show help
#
# IMPORTANT: This script delegates color math/generation to generate_accent_variants.py

### ----------------------------
### Configuration / Constants
### ----------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GTK_DIR="$SCRIPT_DIR/gtk"
THEME_DIR="$HOME/.themes"
GTK4_CONFIG_DIR="$HOME/.config/gtk-4.0"
DOWNLOADS_DIR="$(xdg-user-dir DOWNLOAD 2>/dev/null || echo "$HOME/Downloads")"
TMP_DIR="$(mktemp -d -t tahoe-installer.XXXXXXXXXX)"
APP_LAUNCHER="kayozxo/ulauncher-liquid-glass"
TMP_ZIP_AL="ulauncher-liquid-glass.zip"

AVAILABLE_COLORS=(blue green purple pink orange red teal indigo rose emerald violet amber cyan lime sky slate)

# Pretty colors for fallback output
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

### ----------------------------
### Utility functions (gum-aware)
### ----------------------------
check_and_install_gum() {
  if command -v gum &>/dev/null; then
    return 0
  fi
  # Try best-effort installs (non-exhaustive). If they don't succeed, continue.
  echo -e "${YELLOW}gum not found. Attempt automatic install?${NC}"
  read -r -p "Install gum (y/N)? " yn
  if [[ "$yn" =~ ^[Yy]$ ]]; then
    if command -v brew &>/dev/null; then
      brew install gum
    elif command -v dnf &>/dev/null; then
      sudo dnf install -y gum
    elif command -v pacman &>/dev/null; then
      sudo pacman -S --noconfirm gum
    elif command -v apt &>/dev/null; then
      sudo mkdir -p /etc/apt/keyrings
      curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
      echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list >/dev/null
      sudo apt update && sudo apt install -y gum
    else
      echo "No known package manager — please install gum manually: https://github.com/charmbracelet/gum"
    fi
  fi
}

gum_or_echo() {
  # usage: gum_or_echo "text"
  # Strip ANSI codes if using gum, keep them for echo
  if command -v gum &>/dev/null; then
    # Remove ANSI escape sequences for gum
    local clean_text
    clean_text=$(echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g')
    gum style --border normal --padding "0 1" "$clean_text"
  else
    echo -e "$1"
  fi
}

gum_confirm_or_read() {
  # $1 prompt
  if command -v gum &>/dev/null; then
    gum confirm "$1"
  else
    read -r -p "$1 (y/N): " ans
    [[ "$ans" =~ ^[Yy]$ ]]
  fi
}

gum_choose_lines() {
  # pass newline-separated options via stdin; returns selection (stdout)
  # If gum missing, fall back to simple numbered selection
  if command -v gum &>/dev/null; then
    gum choose --cursor ">" --height 8
  else
    local -a options=()
    while IFS= read -r line; do
      options+=("$line")
    done

    if [ ${#options[@]} -eq 0 ]; then
      echo "No options available" >&2
      return 1
    fi

    local i=1
    for opt in "${options[@]}"; do
      echo "$i) $opt" >&2
      ((i++))
    done

    local selection
    local attempts=0
    local max_attempts=3

    while [ $attempts -lt $max_attempts ]; do
      read -r -p "Enter number (1-${#options[@]}): " selection </dev/tty
      if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le "${#options[@]}" ]; then
        echo "${options[$((selection-1))]}"
        return 0
      fi
      ((attempts++))
      if [ $attempts -lt $max_attempts ]; then
        echo "Invalid selection. Try again. (Attempt $attempts/$max_attempts)" >&2
      fi
    done

    echo "Max attempts reached. Selection cancelled." >&2
    return 1
  fi
}

gum_spin_run() {
  # $1 title, $2 command string
  if command -v gum &>/dev/null; then
    gum spin --spinner dot --title "$1" -- bash -c "$2"
  else
    echo "$1"
    bash -c "$2"
  fi
}

# safe lowercase and ucfirst helpers
lower() { echo "${1,,}"; }   # all lower
upper_first() { echo "${1^}"; } # First letter uppercase

### ----------------------------
### Environment sanity & cleanup
### ----------------------------
cleanup_tmp() {
  if [ -n "${TMP_DIR:-}" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

trap cleanup_tmp EXIT

mkdir -p "$TMP_DIR" "$THEME_DIR" "$DOWNLOADS_DIR" "$GTK4_CONFIG_DIR"

check_prereqs() {
  local missing=()
  for cmd in curl git unzip rsync python3; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    gum_or_echo "${YELLOW}Warning: Missing commands: ${missing[*]}${NC}"
    gum_or_echo "${YELLOW}Some features may not work properly.${NC}"
  fi
}

### ----------------------------
### Core operations
### ----------------------------
force_reload_theme() {
  # Force GNOME to reload theme
  gum_or_echo "${CYAN}🔄 Forcing theme reload...${NC}"

  # Clear caches
  rm -rf ~/.cache/icon-* ~/.cache/gnome-control-center* 2>/dev/null || true

  # Reload GTK settings with longer delay for reliability
  if command -v gsettings &>/dev/null; then
    local current_theme
    current_theme=$(gsettings get org.gnome.desktop.interface gtk-theme 2>/dev/null || echo "")
    if [ -n "$current_theme" ]; then
      gsettings set org.gnome.desktop.interface gtk-theme "" 2>/dev/null || true
      sleep 1
      gsettings set org.gnome.desktop.interface gtk-theme "$current_theme" 2>/dev/null || true
    fi
  fi

  gum_or_echo "${GREEN}✓ Theme reloaded! You may need to restart applications or log out.${NC}"
  echo
}

backup_existing() {
  local target="$1"
  if [ -d "$target" ] || [ -f "$target" ]; then
    local backup="${target}.backup.$(date +%Y%m%d-%H%M%S)"
    gum_or_echo "${CYAN}Backing up existing: $(basename "$target") -> $(basename "$backup")${NC}"
    mv "$target" "$backup"
  fi
}

install_theme_copy() {
  # args: src_dir dest_name
  local src="$1"
  local dest_name="$2"
  local dest="$THEME_DIR/$dest_name"

  if [ -z "$src" ] || [ -z "$dest_name" ]; then
    gum_or_echo "${RED}Error: Invalid arguments to install_theme_copy${NC}"
    return 1
  fi

  if [ ! -d "$src" ]; then
    gum_or_echo "${YELLOW}Source not found: $src${NC}"
    return 1
  fi

  # Backup existing theme
  backup_existing "$dest"

  if command -v rsync &>/dev/null; then
    gum_spin_run "Installing $dest_name..." "rsync -a \"$src/\" \"$dest/\""
  else
    gum_spin_run "Installing $dest_name..." "cp -a \"$src\" \"$dest\""
  fi
  gum_or_echo "✅ Installed $dest_name → $dest"
}

install_base_themes() {
  # args: install_light install_dark
  local do_light=$1
  local do_dark=$2

  if $do_light; then
    install_theme_copy "$GTK_DIR/Tahoe-Light" "Tahoe-Light"
  fi
  if $do_dark; then
    install_theme_copy "$GTK_DIR/Tahoe-Dark" "Tahoe-Dark"
  fi
}

generate_accent_variants_py() {
  # args: color (empty -> all)
  local color="$1"

  if [ ! -f "$SCRIPT_DIR/generate_accent_variants.py" ]; then
    gum_or_echo "${RED}Error: generate_accent_variants.py not found in $SCRIPT_DIR${NC}"
    return 1
  fi

  if ! command -v python3 &>/dev/null; then
    gum_or_echo "${RED}Error: python3 is required to generate accent variants${NC}"
    return 1
  fi

  if [ -n "$color" ]; then
    gum_spin_run "Generating accent: $color" "python3 \"$SCRIPT_DIR/generate_accent_variants.py\" --color \"$color\" --name \"$color\""
  else
    gum_spin_run "Generating all accent variants..." "python3 \"$SCRIPT_DIR/generate_accent_variants.py\" --all"
  fi
  gum_or_echo "✅ Accent generation finished."
}

install_color_variants_from_gtkdir() {
  local installed_count=0

  gum_or_echo "${CYAN}Scanning for generated color variants...${NC}"

  shopt -s nullglob
  for pattern in "$GTK_DIR"/Tahoe-Dark-* "$GTK_DIR"/Tahoe-Light-*; do
    if [ -d "$pattern" ]; then
      local bn
      bn=$(basename "$pattern")
      local dest="$THEME_DIR/$bn"

      backup_existing "$dest"
      cp -a "$pattern" "$THEME_DIR/"
      gum_or_echo "  ✓ Installed: $bn"
      ((installed_count++))
    fi
  done
  shopt -u nullglob

  if [ $installed_count -eq 0 ]; then
    gum_or_echo "${YELLOW}No generated color variants found in $GTK_DIR${NC}"
    gum_or_echo "${YELLOW}Run 'Generate accent variants' first.${NC}"
  else
    gum_or_echo "${GREEN}🎨 Installed $installed_count accent variant(s) to $THEME_DIR${NC}"
  fi
}

install_libadwaita_override() {
  # args: pref_mode(Light|Dark) specific_color(optional)
  local pref="$1"
  local specific="$2"

  # normalize mode to Title Case
  pref="${pref:-Light}"
  pref="$(upper_first "$(lower "$pref")")"
  specific="${specific:-}"

  local specific_uc=""
  if [ -n "$specific" ]; then
    specific_uc="$(upper_first "$(lower "$specific")")"
  fi

  # First try specific variant paths with Title Case color folder name
  local candidate=""
  if [ -n "$specific_uc" ]; then
    if [ "$pref" = "Light" ] && [ -d "$GTK_DIR/Tahoe-Light-${specific_uc}/gtk-4.0" ]; then
      candidate="$GTK_DIR/Tahoe-Light-${specific_uc}/gtk-4.0"
    elif [ "$pref" = "Dark" ] && [ -d "$GTK_DIR/Tahoe-Dark-${specific_uc}/gtk-4.0" ]; then
      candidate="$GTK_DIR/Tahoe-Dark-${specific_uc}/gtk-4.0"
    fi
  fi

  # Fallback to base gtk-4.0
  if [ -z "$candidate" ]; then
    if [ "$pref" = "Light" ] && [ -d "$GTK_DIR/Tahoe-Light/gtk-4.0" ]; then
      candidate="$GTK_DIR/Tahoe-Light/gtk-4.0"
    elif [ "$pref" = "Dark" ] && [ -d "$GTK_DIR/Tahoe-Dark/gtk-4.0" ]; then
      candidate="$GTK_DIR/Tahoe-Dark/gtk-4.0"
    fi
  fi

  if [ -z "$candidate" ]; then
    gum_or_echo "${RED}✗ libadwaita source folder not found for your selection.${NC}"
    gum_or_echo "Tried paths (examples):"
    if [ -n "$specific_uc" ]; then
      gum_or_echo "  $GTK_DIR/Tahoe-${pref}-${specific_uc}/gtk-4.0"
    fi
    gum_or_echo "  $GTK_DIR/Tahoe-${pref}/gtk-4.0"
    return 1
  fi

  # Backup existing gtk-4.0 config
  if [ -f "$GTK4_CONFIG_DIR/gtk.css" ]; then
    backup_existing "$GTK4_CONFIG_DIR/gtk.css"
  fi

  gum_spin_run "Installing libadwaita override to $GTK4_CONFIG_DIR..." "
    set -e
    mkdir -p \"$GTK4_CONFIG_DIR\"
    rm -f \"$GTK4_CONFIG_DIR/gtk.css\" \"$GTK4_CONFIG_DIR/gtk-dark.css\" \"$GTK4_CONFIG_DIR/gtk-Light.css\" \"$GTK4_CONFIG_DIR/gtk-Dark.css\" 2>/dev/null || true
    rm -rf \"$GTK4_CONFIG_DIR/assets\" \"$GTK4_CONFIG_DIR/windows-assets\" 2>/dev/null || true
    cp -a \"$candidate/\"* \"$GTK4_CONFIG_DIR/\"
  "
  gum_or_echo "✅ Installed libadwaita override from $candidate"
}

install_ulauncher_theme() {
  # Requires curl & unzip
  if ! command -v curl &>/dev/null || ! command -v unzip &>/dev/null; then
    gum_or_echo "${RED}Error: curl and unzip are required to fetch Ulauncher theme${NC}"
    return 1
  fi

  gum_spin_run "Fetching latest release URL for $APP_LAUNCHER..." '
    set -e
    api=$(curl -s "https://api.github.com/repos/'"$APP_LAUNCHER"'/releases/latest")
    DOWNLOAD_URL=$(echo "$api" | grep "\"browser_download_url\"" | sed -E "s/.*\"([^\"]+)\".*/\1/" | head -n1)
    echo "$DOWNLOAD_URL" > "'"$TMP_DIR"'/download_url.txt"
  '

  local url
  url="$(cat "$TMP_DIR/download_url.txt" 2>/dev/null || true)"

  if [ -z "$url" ]; then
    gum_or_echo "${RED}✗ Could not detect download URL from GitHub API for $APP_LAUNCHER${NC}"
    return 1
  fi

  gum_spin_run "Downloading Ulauncher theme..." "curl -L -o \"$TMP_DIR/$TMP_ZIP_AL\" \"$url\""
  gum_spin_run "Extracting to $DOWNLOADS_DIR..." "unzip -o \"$TMP_DIR/$TMP_ZIP_AL\" -d \"$DOWNLOADS_DIR\""
  rm -f "$TMP_DIR/$TMP_ZIP_AL"

  # try to run installer if exists
  local install_script
  install_script="$(find "$DOWNLOADS_DIR" -maxdepth 2 -type f -iname "install.sh" | head -n1 || true)"

  if [ -n "$install_script" ]; then
    if gum_confirm_or_read "Run extracted Ulauncher installer ($install_script) now?"; then
      bash "$install_script"
      gum_or_echo "✅ Ulauncher installer executed."
    else
      gum_or_echo "⚠️ Installer found at $install_script but not executed."
    fi
  else
    gum_or_echo "✅ Ulauncher package downloaded to $DOWNLOADS_DIR"
  fi
}

install_icons_or_cursors() {
  # args: repo_url clone_name [install_args...]
  local repo="$1"
  local dir="$2"
  shift 2
  local flags=("$@")
  local clone_dir="$DOWNLOADS_DIR/$dir"

  if [ -d "$clone_dir" ]; then
    if gum_confirm_or_read "Folder $clone_dir exists. Remove & re-clone?"; then
      rm -rf "$clone_dir"
    else
      gum_or_echo "Skipping clone."
      return 1
    fi
  fi

  gum_spin_run "Cloning $repo..." "git clone --depth=1 \"$repo\" \"$clone_dir\""

  gum_or_echo "${YELLOW}⚠️  The following operation will require sudo privileges.${NC}"

  if gum_confirm_or_read "Run installer for $dir now (requires sudo)?"; then
    sudo bash "$clone_dir/install.sh" "${flags[@]}"
    gum_or_echo "✅ Installed $dir"
  else
    gum_or_echo "⚠️ Cloned to $clone_dir — run installer manually later."
  fi
}

install_gdm_theme() {
  local repo="https://github.com/vinceliuice/WhiteSur-gtk-theme.git"
  local clone_dir="$DOWNLOADS_DIR/WhiteSur-gtk-theme"

  if [ -d "$clone_dir" ]; then
    if gum_confirm_or_read "WhiteSur GDM folder exists. Remove & re-clone?"; then
      rm -rf "$clone_dir"
    else
      gum_or_echo "Skipping GDM clone."
      return 1
    fi
  fi

  gum_spin_run "Cloning WhiteSur GDM theme..." "git clone --depth=1 \"$repo\" \"$clone_dir\""

  gum_or_echo "${YELLOW}⚠️  The following operation will require sudo privileges.${NC}"
  gum_or_echo "${CYAN}Available backgrounds: default, blank, ...${NC}"

  local bg_choice="default"
  if command -v gum &>/dev/null; then
    bg_choice=$(gum input --placeholder "Enter background (default: default)" --value "default")
  else
    read -r -p "Enter background choice (default: default): " bg_choice
    bg_choice="${bg_choice:-default}"
  fi

  if gum_confirm_or_read "Install GDM theme with background '$bg_choice' (requires sudo)?"; then
    sudo bash "$clone_dir/tweaks.sh" -g -b "$bg_choice"
    gum_or_echo "✅ GDM theme installed with background: $bg_choice"
  else
    gum_or_echo "⚠️ WhiteSur-gtk-theme cloned to $clone_dir"
  fi
}

install_wallpaper() {
  gum_or_echo "${CYAN}Installing Tahoe 26 5k wallpapers...${NC}"
  gum_or_echo "${YELLOW}⚠️  This following operation will require sudo privileges, as the wallpapers will be installed globally.${NC}"

  # Check if files exist
  local source_wallpaper_dir="$SCRIPT_DIR/.config/walls/Tahoe"
  local source_xml="$SCRIPT_DIR/.config/walls/Tahoe.xml"
  
  if [ ! -d "$source_wallpaper_dir" ]; then
    gum_or_echo "${RED}✗ Source wallpaper directory not found: $source_wallpaper_dir${NC}"
    return 1
  fi
  
  if [ ! -f "$source_xml" ]; then
    gum_or_echo "${RED}✗ Source XML file not found: $source_xml${NC}"
    return 1
  fi

  # Create directories
  gum_spin_run "Creating directories..." "
    sudo mkdir -p \"/usr/share/backgrounds/\"
    sudo mkdir -p \"/usr/share/gnome-background-properties/\"
  "

  # Copy the wallpapers and xml file
  gum_spin_run "Installing wallpapers..." "
    sudo cp -r \"$source_wallpaper_dir\" \"/usr/share/backgrounds/\"
    sudo cp \"$source_xml\" \"/usr/share/gnome-background-properties/\"
  "

  gum_or_echo "✅ Wallpapers installed!"
  gum_or_echo "${GREEN}Wallpaper location: /usr/share/backgrounds/Tahoe${NC}"
  gum_or_echo "${GREEN}XML location: /usr/share/gnome-background-properties/Tahoe.xml${NC}"
  gum_or_echo "${CYAN}Note: You can apply the wallpaper in your settings under Appearance.${NC}"

  # Pretty irrelevant information, but so i know you actually check the code: I like kissing boys :3
  # wallpaper installer made by skittle0764 https://github.com/skittle0764
}

connect_flatpak() {
  if ! command -v flatpak &>/dev/null; then
    gum_or_echo "${RED}Error: Flatpak is not installed on your system${NC}"
    return 1
  fi

  gum_or_echo "${CYAN}ℹ️  Flatpak Theme Connection${NC}"
  gum_or_echo "This will allow Flatpak apps to access your GTK themes."
  echo

  gum_or_echo "${YELLOW}⚠️  The following operations will require sudo privileges.${NC}"

  if ! gum_confirm_or_read "Grant Flatpak apps permission to access GTK configs?"; then
    gum_or_echo "Flatpak connection cancelled."
    return 0
  fi

  # Grant filesystem access to GTK config directories
  gum_spin_run "Granting Flatpak access to GTK-3.0 config..." "sudo flatpak override --filesystem=xdg-config/gtk-3.0"
  gum_spin_run "Granting Flatpak access to GTK-4.0 config..." "sudo flatpak override --filesystem=xdg-config/gtk-4.0"

  # Also grant access to themes directory
  gum_spin_run "Granting Flatpak access to themes..." "sudo flatpak override --filesystem=~/.themes"

  gum_or_echo "✅ Flatpak permissions configured successfully!"
  echo
  gum_or_echo "${GREEN}Your Flatpak apps should now be able to use Tahoe themes.${NC}"
  gum_or_echo "${CYAN}Note: You may need to restart Flatpak apps for changes to take effect.${NC}"
}

disconnect_flatpak() {
  if ! command -v flatpak &>/dev/null; then
    gum_or_echo "${YELLOW}Flatpak is not installed, nothing to disconnect.${NC}"
    return 0
  fi

  gum_or_echo "${CYAN}Disconnecting Flatpak theme access...${NC}"

  gum_or_echo "${YELLOW}⚠️  This will remove Flatpak's access to your GTK configs and themes.${NC}"

  if ! gum_confirm_or_read "Remove Flatpak GTK theme permissions?"; then
    gum_or_echo "Disconnect cancelled."
    return 0
  fi

  # Remove filesystem overrides
  gum_spin_run "Removing GTK-3.0 access..." "sudo flatpak override --nofilesystem=xdg-config/gtk-3.0 2>/dev/null || true"
  gum_spin_run "Removing GTK-4.0 access..." "sudo flatpak override --nofilesystem=xdg-config/gtk-4.0 2>/dev/null || true"
  gum_spin_run "Removing themes access..." "sudo flatpak override --nofilesystem=~/.themes 2>/dev/null || true"

  gum_or_echo "✅ Flatpak theme permissions removed."
}

uninstall_all() {
  if ! gum_confirm_or_read "Are you sure you want to uninstall all Tahoe themes and GTK overrides?"; then
    gum_or_echo "Uninstall cancelled."
    return 0
  fi

  gum_spin_run "Removing themes and variants..." '
    set -e
    if [ -d "'"$THEME_DIR"'/Tahoe-Dark" ]; then rm -rf "'"$THEME_DIR"'/Tahoe-Dark"; fi
    if [ -d "'"$THEME_DIR"'/Tahoe-Light" ]; then rm -rf "'"$THEME_DIR"'/Tahoe-Light"; fi
    shopt -s nullglob
    for d in "'"$THEME_DIR"'/Tahoe-Dark-"* "'"$THEME_DIR"'/Tahoe-Light-"*; do
      if [ -d "$d" ]; then rm -rf "$d"; fi
    done
  '

  gum_spin_run "Cleaning $GTK4_CONFIG_DIR..." '
    set -e
    if [ -f "'"$GTK4_CONFIG_DIR"'/gtk.css" ]; then rm -f "'"$GTK4_CONFIG_DIR"'/gtk.css"; fi
    if [ -f "'"$GTK4_CONFIG_DIR"'/gtk-dark.css" ]; then rm -f "'"$GTK4_CONFIG_DIR"'/gtk-dark.css"; fi
    if [ -f "'"$GTK4_CONFIG_DIR"'/gtk-Light.css" ]; then rm -f "'"$GTK4_CONFIG_DIR"'/gtk-Light.css"; fi
    if [ -f "'"$GTK4_CONFIG_DIR"'/gtk-Dark.css" ]; then rm -f "'"$GTK4_CONFIG_DIR"'/gtk-Dark.css"; fi
    if [ -d "'"$GTK4_CONFIG_DIR"'/assets" ]; then rm -rf "'"$GTK4_CONFIG_DIR"'/assets"; fi
    if [ -d "'"$GTK4_CONFIG_DIR"'/windows-assets" ]; then rm -rf "'"$GTK4_CONFIG_DIR"'/windows-assets"; fi
  '

  gum_or_echo "✅ Uninstallation complete."
  gum_or_echo "${CYAN}Note: Icons, cursors, and GDM themes may need separate uninstallers.${NC}"
  gum_or_echo "${CYAN}Check $DOWNLOADS_DIR for cloned repositories.${NC}"
}

### ----------------------------
### Interactive menu & helpers
### ----------------------------
show_help() {
  if command -v gum &>/dev/null; then
    gum format --type=markdown <<'MD'
# macOS Tahoe Theme Installer — Help

Run `./install.sh` (interactive TUI). Also supports CLI flags:

## Installation Flags
- `--install-light` or `-l` - Install Tahoe Light theme
- `--install-dark` or `-d` - Install Tahoe Dark theme
- `--install-both` - Install both Light and Dark themes

## Accent Color Flags
- `--colors` - Generate all accent color variants
- `--color NAME` - Generate specific accent variant (e.g., `--color blue`)

## Configuration Flags
- `-la` - Install libadwaita override (use with `-l` or `-d`)
- `--flatpak` - Connect Flatpak apps to Tahoe themes (requires sudo)
- `--flatpak-disconnect` - Remove Flatpak theme access

## Other Flags
- `-u` or `--uninstall` - Uninstall all themes
- `-h` or `--help` - Show this help

## Menu Actions (Interactive Mode)
- **Install Light/Dark/Both** - Copy theme files to ~/.themes
- **Generate accent variants** - Run generate_accent_variants.py
- **Install generated variants** - Copy Tahoe-Light-<color> folders to ~/.themes
- **Libadwaita override** - Install gtk-4.0 override to ~/.config/gtk-4.0
- **Extras** - Install icons, cursors, Ulauncher theme, GDM theme, or connect Flatpak
- **Uninstall** - Remove all installed themes and GTK overrides

## Flatpak Support
Flatpak apps run in a sandbox and need explicit permission to access themes:
1. Run `./install.sh --flatpak` to grant permissions
2. Restart your Flatpak apps to apply the theme
3. Use `--flatpak-disconnect` to remove permissions later
MD
  else
    cat <<'TXT'
macOS Tahoe Theme Installer — Help

Run ./install.sh to open the interactive TUI.

CLI flags:
  --install-light / -l      Install Light theme
  --install-dark / -d       Install Dark theme
  --install-both            Install both themes
  --color NAME              Generate specific accent
  --colors                  Generate all accents
  -la                       Install libadwaita override
  --flatpak                 Connect Flatpak themes
  --flatpak-disconnect      Disconnect Flatpak themes
  -u / --uninstall          Uninstall all
  -h / --help               Show help

Flatpak Support:
  Grants Flatpak apps permission to use your GTK themes.
  Run: ./install.sh --flatpak
TXT
  fi
}

choose_accent_color() {
  printf "%s\n" "${AVAILABLE_COLORS[@]}" | gum_choose_lines
}

interactive_menu() {
  check_prereqs
  while true; do
    local selection
    if command -v gum &>/dev/null; then
      selection=$(gum choose --height 14 \
        "Install: Light" \
        "Install: Dark" \
        "Install: Both" \
        "Generate: All accent variants" \
        "Generate: Specific accent variant" \
        "Install generated accent variants into ~/.themes" \
        "Install libadwaita override" \
        "Install Extras (icons/cursors/ulauncher/GDM)" \
        "Uninstall themes" \
        "Force reload theme (clear cache)" \
        "Help" \
        "Exit")
    else
      echo "Choose an option:"
      select selection in "Install: Light" "Install: Dark" "Install: Both" "Generate: All accent variants" "Generate: Specific accent variant" "Install generated accent variants into ~/.themes" "Install libadwaita override" "Install Extras (icons/cursors/ulauncher/GDM)" "Uninstall themes" "Force reload theme" "Help" "Exit"; do break; done
    fi

    case "$selection" in
      "Install: Light") install_base_themes true false ;;
      "Install: Dark") install_base_themes false true ;;
      "Install: Both") install_base_themes true true ;;
      "Generate: All accent variants")
        if gum_confirm_or_read "Run accent generation (--all) now?"; then
          generate_accent_variants_py ""
        fi
        ;;
      "Generate: Specific accent variant")
        chosen="$(choose_accent_color)"
        if [ -n "${chosen:-}" ]; then
          generate_accent_variants_py "$chosen"
        else
          gum_or_echo "No color chosen — cancelled."
        fi
        ;;
      "Install generated accent variants into ~/.themes") install_color_variants_from_gtkdir ;;
      "Install libadwaita override")
        if command -v gum &>/dev/null; then
          mode=$(gum choose "Light" "Dark")
        else
          read -r -p "Choose mode (Light/Dark): " mode
        fi
        specific=""
        if gum_confirm_or_read "Pick a specific accent variant for libadwaita override?"; then
          specific="$(choose_accent_color)"
        fi
        install_libadwaita_override "${mode:-Light}" "$specific"
        ;;
      "Install Extras (icons/cursors/ulauncher/GDM)")
        if command -v gum &>/dev/null; then
          ex=$(gum choose "Install MacTahoe icons" "Install WhiteSur cursors" "Install Ulauncher theme" "Install WhiteSur GDM theme" "Connect Flatpak themes" "Disconnect Flatpak themes" "Back")
        else
          echo "Extras: 1) icons 2) cursors 3) ulauncher 4) gdm 5) install wallpapers 6) connect flatpak 7) disconnect flatpak 8) back"
          read -r ex
        fi
        case "$ex" in
          "Install MacTahoe icons"|"1") install_icons_or_cursors "https://github.com/vinceliuice/MacTahoe-icon-theme.git" "MacTahoe-icon-theme" -b ;;
          "Install WhiteSur cursors"|"2") install_icons_or_cursors "https://github.com/vinceliuice/WhiteSur-cursors.git" "WhiteSur-cursors" ;;
          "Install Ulauncher theme"|"3") install_ulauncher_theme ;;
          "Install WhiteSur GDM theme"|"4") install_gdm_theme ;;
          "Install Tahoe Wallpapers"|"5") install_wallpaper ;;
          "Connect Flatpak themes"|"6") connect_flatpak ;;
          "Disconnect Flatpak themes"|"7") disconnect_flatpak ;;
          "Back"|"8") : ;;
        esac
        ;;
      "Uninstall themes") uninstall_all ;;
      "Force reload theme"|"Force reload theme (clear cache)") force_reload_theme ;;
      "Help") show_help ;;
      "Exit") gum_or_echo "Goodbye — enjoy the theme! 🎉"; break ;;
      *) gum_or_echo "${YELLOW}Unrecognized option${NC}" ;;
    esac

    # small refresh
    if command -v gum &>/dev/null; then
      gum spin --spinner line --title "Refreshing..." -- sleep 0.12
    else
      sleep 0.12
    fi
  done
}

### ----------------------------
### CLI flag handling (hybrid)
### ----------------------------
print_usage_and_exit() {
  show_help
  exit 0
}

# Parse CLI options first (before interactive mode)
if [[ $# -gt 0 ]]; then
  # Handle help first
  for arg in "$@"; do
    if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
      print_usage_and_exit
    fi
  done

  # Parse combined flags like -l -la or -d --color blue -la
  INSTALL_LIGHT=false
  INSTALL_DARK=false
  INSTALL_LIBADWAITA=false
  INSTALL_COLORS=false
  SPECIFIC_COLOR=""
  INSTALL_WALLPAPER=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -u|--uninstall)
        uninstall_all
        exit 0
        ;;
      -l|--install-light)
        INSTALL_LIGHT=true
        shift
        ;;
      -d|--install-dark)
        INSTALL_DARK=true
        shift
        ;;
      -la)
        INSTALL_LIBADWAITA=true
        shift
        ;;
      -w|--wallpaper)
        INSTALL_WALLPAPER=true
        shift
        ;;
      --flatpak)
        connect_flatpak
        exit 0
        ;;
      --flatpak-disconnect)
        disconnect_flatpak
        exit 0
        ;;
      --colors)
        INSTALL_COLORS=true
        shift
        ;;
      --color)
        INSTALL_COLORS=true
        SPECIFIC_COLOR="$2"
        shift 2
        ;;
      --install-both)
        INSTALL_LIGHT=true
        INSTALL_DARK=true
        shift
        ;;
      *)
        gum_or_echo "${YELLOW}Unknown option: $1${NC}"
        print_usage_and_exit
        ;;
    esac
  done

  # Execute based on parsed flags
  if $INSTALL_LIGHT || $INSTALL_DARK; then
    install_base_themes $INSTALL_LIGHT $INSTALL_DARK
  fi

  if $INSTALL_COLORS; then
    if [ -n "$SPECIFIC_COLOR" ]; then
      generate_accent_variants_py "$SPECIFIC_COLOR"
    else
      generate_accent_variants_py ""
    fi
  fi

  if $INSTALL_LIBADWAITA; then
    # Determine mode from flags
    pref="Light"
    if $INSTALL_DARK; then
      pref="Dark"
    elif ! $INSTALL_LIGHT && ! $INSTALL_DARK; then
      pref="Light"  # default
    fi

    install_libadwaita_override "$pref" "$SPECIFIC_COLOR"
  fi

  if $INSTALL_WALLPAPER; then
    install_wallpaper
  fi

  exit 0
fi

### ----------------------------
### Start interactive TUI (default)
### ----------------------------
check_and_install_gum
check_prereqs

if command -v gum &>/dev/null; then
  gum style --border double --padding "1 2" --margin "1" --foreground 212 "🌄 macOS Tahoe Theme Installer" "Welcome! Let's make your desktop beautiful."
else
  echo -e "${BOLD}macOS Tahoe Theme Installer — Interactive${NC}"
fi

interactive_menu

exit 0