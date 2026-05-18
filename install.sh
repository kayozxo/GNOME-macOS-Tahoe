#!/usr/bin/env bash
set -euo pipefail

# macOS Tahoe Theme Installer — Hybrid Mode (Interactive TUI default, CLI flags supported)
# Features:
#  - Install Tahoe Light/Dark themes
#  - Generate accent variants (delegates to generate_accent_variants.py)
#  - Install generated color variants
#  - Libadwaita override installation (supports specific accent variant)
#  - Install Ulauncher theme from GitHub releases
#  - Install Tahoe icons / WhiteSur cursors / WhiteSur GDM
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
TAHOE_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/gnome-macos-tahoe"
BUTTON_LAYOUT_BACKUP="$TAHOE_CACHE_DIR/button-layout.before"
TAHOE_BUTTON_LAYOUT="close,minimize,maximize:"
TMP_DIR="$(mktemp -d -t tahoe-installer.XXXXXXXXXX)"
APP_LAUNCHER="kayozxo/ulauncher-liquid-glass"
TMP_ZIP_AL="ulauncher-liquid-glass.zip"

AVAILABLE_COLORS=(blue green purple pink orange red teal indigo rose emerald violet amber cyan lime sky slate)
TAHOE_EXTENSION_UUIDS=(
  tahoe-open-bar@bobwdmai
  tahoe-blur-my-shell@bobwdmai
  tahoe-dash-to-dock@bobwdmai
  tahoe-ui-tune@bobwdmai
  tahoe-space-bar@bobwdmai
  tahoe-tiling-shell@bobwdmai
  tahoe-user-themes@bobwdmai
  tahoe-vitals@bobwdmai
)

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
      # Ubuntu 24.04+ and Debian 13+ ship gum in universe — try the
      # official archive first, fall back to charm.sh only if that misses.
      if sudo apt update && sudo apt install -y gum 2>/dev/null; then
        :
      else
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
        echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list >/dev/null
        sudo apt update && sudo apt install -y gum
      fi
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

mkdir -p "$TMP_DIR" "$THEME_DIR" "$DOWNLOADS_DIR" "$GTK4_CONFIG_DIR" "$TAHOE_CACHE_DIR"

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

# Tested-on matrix — keep in sync with README compatibility table.
TESTED_GNOME_MIN=49
TESTED_GNOME_MAX=50

check_distro_and_shell() {
  local distro="" version_id="" shell_ver=""

  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    distro="${PRETTY_NAME:-${NAME:-unknown}}"
    version_id="${VERSION_ID:-}"
  fi

  if command -v gnome-shell &>/dev/null; then
    shell_ver=$(gnome-shell --version 2>/dev/null | awk '{print $3}' | cut -d. -f1)
  fi

  gum_or_echo "${CYAN}Detected: ${distro}${version_id:+ (}${version_id}${version_id:+)}${shell_ver:+ — GNOME Shell }${shell_ver}${NC}"

  if [ -n "$shell_ver" ] && [[ "$shell_ver" =~ ^[0-9]+$ ]]; then
    if (( shell_ver < TESTED_GNOME_MIN )); then
      gum_or_echo "${YELLOW}⚠️  GNOME Shell $shell_ver is older than the tested range (${TESTED_GNOME_MIN}–${TESTED_GNOME_MAX}). The shell theme may render but expect minor glitches.${NC}"
    elif (( shell_ver > TESTED_GNOME_MAX )); then
      gum_or_echo "${YELLOW}⚠️  GNOME Shell $shell_ver is newer than the tested range (${TESTED_GNOME_MIN}–${TESTED_GNOME_MAX}). Some selectors may not match the latest Shell API.${NC}"
    fi

    # GNOME 49+ documented quirk: libadwaita override clobbers Nautilus emblem assets.
    if (( shell_ver >= 49 )); then
      gum_or_echo "${YELLOW}ℹ️  Heads-up for GNOME 49+: if Nautilus file emblems disappear after running with -la, remove ~/.config/gtk-4.0 and reinstall without the libadwaita override.${NC}"
    fi
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

apply_tahoe_button_layout() {
  if ! command -v gsettings &>/dev/null; then
    return 0
  fi

  local schema="org.gnome.desktop.wm.preferences"
  local key="button-layout"
  local current
  current=$(gsettings get "$schema" "$key" 2>/dev/null || true)

  if [ -n "$current" ] && [ ! -f "$BUTTON_LAYOUT_BACKUP" ]; then
    printf '%s\n' "$current" > "$BUTTON_LAYOUT_BACKUP"
  fi

  # macOS visual order: red close, yellow minimize, green fullscreen/maximize.
  gsettings set "$schema" "$key" "$TAHOE_BUTTON_LAYOUT" 2>/dev/null || true
}

restore_button_layout() {
  if ! command -v gsettings &>/dev/null; then
    return 0
  fi

  local schema="org.gnome.desktop.wm.preferences"
  local key="button-layout"

  if [ -s "$BUTTON_LAYOUT_BACKUP" ]; then
    local previous
    previous="$(cat "$BUTTON_LAYOUT_BACKUP")"
    gsettings set "$schema" "$key" "$previous" 2>/dev/null || true
    rm -f "$BUTTON_LAYOUT_BACKUP"
  else
    gsettings reset "$schema" "$key" 2>/dev/null || true
  fi
}

apply_theme() {
  # Activate a previously-installed Tahoe variant via gsettings.
  # Arg: theme name (e.g. "Tahoe-Light", "Tahoe-Dark", "Tahoe-Dark-Blue").
  local theme_name="$1"
  if [ -z "$theme_name" ]; then
    gum_or_echo "${RED}apply_theme: missing theme name.${NC}"
    return 1
  fi
  if ! command -v gsettings &>/dev/null; then
    gum_or_echo "${YELLOW}gsettings not found — install themes copied, but couldn't auto-apply.${NC}"
    return 1
  fi
  if [ ! -d "$THEME_DIR/$theme_name" ]; then
    gum_or_echo "${YELLOW}$theme_name not found in $THEME_DIR — copy it first.${NC}"
    return 1
  fi

  # GTK3 / fallback theme
  gsettings set org.gnome.desktop.interface gtk-theme "$theme_name" 2>/dev/null || true

  # libadwaita / GTK4 color-scheme flag
  case "$theme_name" in
    *-Dark*)  gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark' 2>/dev/null || true ;;
    *-Light*) gsettings set org.gnome.desktop.interface color-scheme 'default'     2>/dev/null || true ;;
  esac

  apply_tahoe_button_layout

  # GNOME Shell theme (requires User Themes extension)
  local shell_applied=false
  local user_theme_schema="org.gnome.shell.extensions.user-theme"
  if command -v gnome-extensions &>/dev/null; then
    for uuid in "tahoe-user-themes@bobwdmai" "user-theme@gnome-shell-extensions.gcampax.github.com"; do
      if gnome-extensions list 2>/dev/null | grep -qx "$uuid"; then
        local schema_dir="$HOME/.local/share/gnome-shell/extensions/$uuid/schemas"
        if [ -d "$schema_dir" ]; then
          GSETTINGS_SCHEMA_DIR="$schema_dir" gsettings set "$user_theme_schema" name "$theme_name" 2>/dev/null && shell_applied=true || true
        else
          gsettings set "$user_theme_schema" name "$theme_name" 2>/dev/null && shell_applied=true || true
        fi
        $shell_applied && break
      fi
    done
  fi

  if $shell_applied; then
    gum_or_echo "✅ Applied $theme_name (GTK + Shell). ${YELLOW}Log out and back in for the Shell theme to take effect.${NC}"
  else
    gum_or_echo "✅ Applied $theme_name (GTK only)."
    gum_or_echo "${YELLOW}For Shell theming: install + enable the User Themes extension, then re-run this option. (Try --extensions for the full bundle.)${NC}"
  fi
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

  # Activate it. If both were installed, dark wins (most users want dark by default
  # on Tahoe); --no-apply skips the prompt for headless automation.
  local active=""
  if $do_dark; then
    active="Tahoe-Dark"
  elif $do_light; then
    active="Tahoe-Light"
  fi

  if [ -n "$active" ] && [ "${SKIP_APPLY:-false}" != "true" ]; then
    if gum_confirm_or_read "Apply $active as the active theme now?"; then
      apply_theme "$active"
    else
      gum_or_echo "${CYAN}Skipped — set the theme later via Tweaks/Refine or 'gsettings set org.gnome.desktop.interface gtk-theme $active'.${NC}"
    fi
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

install_mactahoe_icons() {
  # Prefer the vendored copy in icons/MacTahoe/ over cloning vinceliuice's repo.
  # Install it under the Tahoe name so GTK theme + icon theme read as one set.
  local accent="${1:-blue}"
  local icon_variant
  case "$accent" in
    blue|purple|green|red|orange) icon_variant="$accent" ;;
    amber) icon_variant="yellow" ;;
    slate) icon_variant="grey" ;;
    *) icon_variant="blue" ;;
  esac

  local local_src="$SCRIPT_DIR/icons/MacTahoe"
  if [ ! -d "$local_src" ] || [ ! -x "$local_src/install.sh" ]; then
    # Fall back to the upstream clone-and-install path
    install_icons_or_cursors "https://github.com/vinceliuice/MacTahoe-icon-theme.git" "MacTahoe-icon-theme" -b -n Tahoe -t "$icon_variant"
    return $?
  fi

  gum_spin_run "Installing Tahoe icons from local source..." "bash \"$local_src/install.sh\" -b -n Tahoe -t \"$icon_variant\""

  # Activate it. The vendored installer creates Tahoe, Tahoe-light, Tahoe-dark,
  # and accent variants such as Tahoe-red / Tahoe-red-dark.
  if command -v gsettings &>/dev/null; then
    local picked=""
    local color_scheme
    color_scheme=$(gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null || true)
    if [[ "$color_scheme" == *prefer-dark* ]]; then
      for name in "Tahoe-${icon_variant}-dark" "Tahoe-${icon_variant}" Tahoe-dark Tahoe; do
        [ -d "$HOME/.local/share/icons/$name" ] && picked="$name" && break
      done
    else
      for name in "Tahoe-${icon_variant}" "Tahoe-${icon_variant}-light" Tahoe Tahoe-light; do
        [ -d "$HOME/.local/share/icons/$name" ] && picked="$name" && break
      done
    fi
    if [ -z "$picked" ]; then
      for name in Tahoe Tahoe-light Tahoe-dark; do
        [ -d "$HOME/.local/share/icons/$name" ] && picked="$name" && break
      done
    fi
    if [ -n "$picked" ]; then
      gsettings set org.gnome.desktop.interface icon-theme "$picked" 2>/dev/null || true
      gum_or_echo "✅ Tahoe icons installed and active ($picked)"
    else
      gum_or_echo "✅ Tahoe icons installed — set the icon theme via Tweaks/Refine"
    fi
  else
    gum_or_echo "✅ Tahoe icons installed (gsettings unavailable; activate manually)"
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
  gum_or_echo "${YELLOW}⚠️  This operation requires sudo privileges to install wallpapers globally.${NC}"

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

  # Pre-authenticate sudo before any operations (password prompt will be visible)
  gum_or_echo "${YELLOW}⏳ Please enter your sudo password when prompted...${NC}"
  if ! sudo -v; then
    gum_or_echo "${RED}✗ Failed to authenticate with sudo${NC}"
    return 1
  fi

  # Now run the actual commands - sudo is cached, no prompts during spinner
  gum_spin_run "Creating directories..." "sudo mkdir -p /usr/share/backgrounds/ /usr/share/gnome-background-properties/"
  gum_spin_run "Copying wallpapers..." "sudo cp -r \"$source_wallpaper_dir\" /usr/share/backgrounds/"
  gum_spin_run "Copying metadata..." "sudo cp \"$source_xml\" /usr/share/gnome-background-properties/"

  gum_or_echo "✅ Wallpapers installed!"
  gum_or_echo "${GREEN}Wallpaper location: /usr/share/backgrounds/Tahoe${NC}"
  gum_or_echo "${GREEN}XML location: /usr/share/gnome-background-properties/Tahoe.xml${NC}"
  gum_or_echo "${CYAN}Note: You can apply the wallpaper in your settings under Appearance.${NC}"

  # Wallpaper installer originally contributed by skittle0764:
  # https://github.com/skittle0764
}

install_local_extension() {
  # Build + install + enable an extension whose source lives under
  # extensions/<UUID>/ in this repo. Args: UUID friendly_name
  local uuid="$1"
  local friendly="${2:-$uuid}"
  local src="$SCRIPT_DIR/extensions/$uuid"

  if [ ! -d "$src" ]; then
    return 1   # signal "no local source"; caller may fall back to EGO
  fi
  if ! command -v gnome-extensions &>/dev/null; then
    gum_or_echo "${RED}✗ gnome-extensions not found; can't install ${friendly}.${NC}"
    return 1
  fi

  if [ -f "$src/Makefile" ]; then
    gum_spin_run "Building ${friendly} from local source..." "make -C \"$src\" install"
  else
    # No Makefile — drop the source straight into the extensions dir.
    local dest="$HOME/.local/share/gnome-shell/extensions/$uuid"
    gum_spin_run "Installing ${friendly} from local source..." "rm -rf \"$dest\" && cp -a \"$src\" \"$dest\" && { [ ! -d \"$dest/schemas\" ] || glib-compile-schemas \"$dest/schemas\"; }"
  fi

  if gnome-extensions enable "$uuid" 2>/dev/null; then
    gum_or_echo "✅ ${friendly} installed & enabled (local · ${uuid})"
  else
    gum_or_echo "✅ ${friendly} installed (local · ${uuid}) — enable after restarting GNOME Shell"
  fi

  local upstream_uuid=""
  if command -v python3 &>/dev/null && [ -f "$src/metadata.json" ]; then
    upstream_uuid=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("upstream-uuid", ""))' "$src/metadata.json" 2>/dev/null || true)
  fi
  if [ -n "$upstream_uuid" ] && [ "$upstream_uuid" != "$uuid" ] && gnome-extensions info "$upstream_uuid" &>/dev/null; then
    gnome-extensions disable "$upstream_uuid" 2>/dev/null || true
    gum_or_echo "${CYAN}Disabled upstream ${friendly} source ($upstream_uuid) to avoid duplicate behavior.${NC}"
  fi
}

install_gnome_extension() {
  # Install a GNOME Shell extension. Prefers a local source in extensions/<UUID>/
  # if a UUID is supplied (3rd arg); falls back to the extensions.gnome.org API.
  # Args: ext_id [friendly_name] [known_uuid]
  local ext_id="$1"
  local friendly="${2:-extension $ext_id}"
  local known_uuid="${3:-}"

  # Local-first path
  if [ -n "$known_uuid" ] && install_local_extension "$known_uuid" "$friendly"; then
    return 0
  fi

  for cmd in gnome-shell gnome-extensions curl python3; do
    if ! command -v "$cmd" &>/dev/null; then
      gum_or_echo "${RED}✗ '$cmd' is required to install GNOME extensions.${NC}"
      return 1
    fi
  done

  local shell_ver
  shell_ver=$(gnome-shell --version 2>/dev/null | awk '{print $3}' | cut -d. -f1)
  if [ -z "$shell_ver" ]; then
    gum_or_echo "${RED}✗ Could not detect GNOME Shell version.${NC}"
    return 1
  fi

  local info_url="https://extensions.gnome.org/extension-info/?pk=${ext_id}&shell_version=${shell_ver}"
  local info
  if ! info=$(curl -fsSL "$info_url" 2>/dev/null); then
    gum_or_echo "${RED}✗ Failed to fetch metadata for $friendly (id=$ext_id).${NC}"
    return 1
  fi

  local download_path uuid name
  download_path=$(printf '%s' "$info" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("download_url","") or "")' 2>/dev/null || true)
  uuid=$(printf '%s' "$info" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("uuid","") or "")' 2>/dev/null || true)
  name=$(printf '%s' "$info" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("name","") or "")' 2>/dev/null || true)

  if [ -z "$download_path" ] || [ -z "$uuid" ]; then
    gum_or_echo "${RED}✗ $friendly is not available for GNOME Shell $shell_ver.${NC}"
    return 1
  fi

  local zip="$TMP_DIR/${uuid}.zip"
  gum_spin_run "Downloading ${name:-$friendly}..." "curl -fsSL -o \"$zip\" \"https://extensions.gnome.org${download_path}\""
  gum_spin_run "Installing ${name:-$friendly}..." "gnome-extensions install --force \"$zip\""

  if gnome-extensions enable "$uuid" 2>/dev/null; then
    gum_or_echo "✅ ${name:-$friendly} installed & enabled ($uuid)"
  else
    gum_or_echo "✅ ${name:-$friendly} installed ($uuid) — enable after restarting GNOME Shell."
  fi
}

install_blur_my_shell() {
  install_gnome_extension 3193 "Tahoe Blur" "tahoe-blur-my-shell@bobwdmai"
  gum_or_echo "${YELLOW}⚠️  Log out and back in (or press Alt+F2 → 'r' on X11) to activate.${NC}"
}

install_recommended_extensions() {
  gum_or_echo "${CYAN}Installing recommended GNOME Shell extensions...${NC}"
  # ext_id : friendly_name : UUID (the UUID enables local-first install
  # when extensions/<UUID>/ is vendored in this repo).
  install_gnome_extension 6580 "Tahoe Open Bar"            "tahoe-open-bar@bobwdmai"                            || true
  install_blur_my_shell                                                                                          || true
  install_gnome_extension 307  "Tahoe Dock"                "tahoe-dash-to-dock@bobwdmai"                        || true
  install_gnome_extension 4158 "Tahoe UI Tune"             "tahoe-ui-tune@bobwdmai"                             || true
  install_gnome_extension 5090 "Tahoe Space Bar"           "tahoe-space-bar@bobwdmai"                           || true
  install_gnome_extension 7065 "Tahoe Tiling Shell"        "tahoe-tiling-shell@bobwdmai"                        || true
  install_gnome_extension 19   "Tahoe User Themes"         "tahoe-user-themes@bobwdmai"                         || true
  install_gnome_extension 1460 "Tahoe Vitals"              "tahoe-vitals@bobwdmai"                              || true
  gum_or_echo "${YELLOW}⚠️  Log out and back in to fully load the new extensions.${NC}"
}

connect_flatpak() {
  if ! command -v flatpak &>/dev/null; then
    gum_or_echo "${RED}Error: Flatpak is not installed on your system${NC}"
    return 1
  fi

  gum_or_echo "${CYAN}ℹ️  Flatpak Theme Connection${NC}"
  gum_or_echo "This will allow Flatpak apps to access your GTK themes."
  echo

  gum_or_echo "${YELLOW}⚠️  This operation requires sudo privileges.${NC}"

  if ! gum_confirm_or_read "Grant Flatpak apps permission to access GTK configs?"; then
    gum_or_echo "Flatpak connection cancelled."
    return 0
  fi

  # Pre-authenticate sudo before any operations
  gum_or_echo "${YELLOW}⏳ Please enter your sudo password when prompted...${NC}"
  if ! sudo -v; then
    gum_or_echo "${RED}✗ Failed to authenticate with sudo${NC}"
    return 1
  fi

  # Grant filesystem access to GTK config directories (sudo is now cached)
  gum_spin_run "Granting Flatpak access to GTK-3.0 config..." "sudo flatpak override --filesystem=xdg-config/gtk-3.0"
  gum_spin_run "Granting Flatpak access to GTK-4.0 config..." "sudo flatpak override --filesystem=xdg-config/gtk-4.0"
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

  # Pre-authenticate sudo before any operations
  gum_or_echo "${YELLOW}⏳ Please enter your sudo password when prompted...${NC}"
  if ! sudo -v; then
    gum_or_echo "${RED}✗ Failed to authenticate with sudo${NC}"
    return 1
  fi

  # Remove filesystem overrides (sudo is now cached)
  gum_spin_run "Removing GTK-3.0 access..." "sudo flatpak override --nofilesystem=xdg-config/gtk-3.0 2>/dev/null || true"
  gum_spin_run "Removing GTK-4.0 access..." "sudo flatpak override --nofilesystem=xdg-config/gtk-4.0 2>/dev/null || true"
  gum_spin_run "Removing themes access..." "sudo flatpak override --nofilesystem=~/.themes 2>/dev/null || true"

  gum_or_echo "✅ Flatpak theme permissions removed."
}

uninstall_all() {
  if ! gum_confirm_or_read "Are you sure you want to uninstall Tahoe themes, icons, extension forks, and GTK overrides?"; then
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

  gum_spin_run "Removing Tahoe icons..." '
    shopt -s nullglob
    for d in "$HOME"/.local/share/icons/Tahoe*; do
      [ -e "$d" ] && rm -rf "$d"
    done
  '

  if command -v gsettings &>/dev/null; then
    local current_gtk current_icons current_shell schema_dir
    current_gtk=$(gsettings get org.gnome.desktop.interface gtk-theme 2>/dev/null | sed "s/^'//;s/'$//" || true)
    current_icons=$(gsettings get org.gnome.desktop.interface icon-theme 2>/dev/null | sed "s/^'//;s/'$//" || true)

    case "$current_gtk" in
      Tahoe*) gsettings reset org.gnome.desktop.interface gtk-theme 2>/dev/null || true ;;
    esac
    case "$current_icons" in
      Tahoe*) gsettings reset org.gnome.desktop.interface icon-theme 2>/dev/null || true ;;
    esac

    for uuid in "tahoe-user-themes@bobwdmai" "user-theme@gnome-shell-extensions.gcampax.github.com"; do
      schema_dir="$HOME/.local/share/gnome-shell/extensions/$uuid/schemas"
      if [ -d "$schema_dir" ]; then
        current_shell=$(GSETTINGS_SCHEMA_DIR="$schema_dir" gsettings get org.gnome.shell.extensions.user-theme name 2>/dev/null | sed "s/^'//;s/'$//" || true)
        case "$current_shell" in
          Tahoe*) GSETTINGS_SCHEMA_DIR="$schema_dir" gsettings set org.gnome.shell.extensions.user-theme name "''" 2>/dev/null || true ;;
        esac
      else
        current_shell=$(gsettings get org.gnome.shell.extensions.user-theme name 2>/dev/null | sed "s/^'//;s/'$//" || true)
        case "$current_shell" in
          Tahoe*) gsettings set org.gnome.shell.extensions.user-theme name "''" 2>/dev/null || true ;;
        esac
      fi
    done
  fi

  gum_or_echo "${CYAN}Removing Tahoe GNOME extension forks...${NC}"
  local uuid
  for uuid in "${TAHOE_EXTENSION_UUIDS[@]}"; do
    if command -v gnome-extensions &>/dev/null; then
      gnome-extensions disable "$uuid" >/dev/null 2>&1 || true
      gnome-extensions uninstall "$uuid" >/dev/null 2>&1 || true
    fi
    rm -rf "$HOME/.local/share/gnome-shell/extensions/$uuid"
  done

  restore_button_layout

  gum_or_echo "✅ Uninstallation complete."
  gum_or_echo "${CYAN}Note: WhiteSur cursors and GDM themes may need their upstream uninstallers if you installed them separately.${NC}"
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

## GNOME Extension Flags
- `--extensions` - Install all recommended GNOME Shell extensions
  (Tahoe Open Bar, Tahoe Blur, Tahoe Dock, Tahoe UI Tune,
   Tahoe Space Bar, Tahoe Tiling Shell, Tahoe User Themes, Tahoe Vitals)
- `--blur` or `--blur-my-shell` - Install only Tahoe Blur
- `--icons` - Install Tahoe icons and apply them

## Other Flags
- `-u` or `--uninstall` - Uninstall Tahoe themes, icons, extension forks, and GTK overrides
- `./uninstall.sh` - Same uninstall flow, easier to find
- `-h` or `--help` - Show this help

## Menu Actions (Interactive Mode)
- **Install Light/Dark/Both** - Copy theme files to ~/.themes
- **Generate accent variants** - Run generate_accent_variants.py
- **Install generated variants** - Copy Tahoe-Light-<color> folders to ~/.themes
- **Libadwaita override** - Install gtk-4.0 override to ~/.config/gtk-4.0
- **Extras** - Install icons, cursors, Ulauncher theme, GDM theme, or connect Flatpak
- **Uninstall** - Remove Tahoe themes, icons, extension forks, and GTK overrides

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
  --extensions              Install recommended GNOME Shell extensions
                            (Tahoe Open Bar, Tahoe Blur, Tahoe Dock,
                             Tahoe UI Tune, Tahoe Space Bar,
                             Tahoe Tiling Shell, Tahoe User Themes,
                             Tahoe Vitals)
  --blur / --blur-my-shell  Install only Tahoe Blur
  --icons                   Install Tahoe icons and apply them
  -u / --uninstall          Uninstall Tahoe themes/icons/extensions
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
        "Apply: pick an installed theme as active" \
        "Install libadwaita override" \
        "Install Extras (icons/wallpapers/cursors/ulauncher/GDM/extensions)" \
        "Uninstall Tahoe" \
        "Force reload theme (clear cache)" \
        "Help" \
        "Exit")
    else
      echo "Choose an option:"
      select selection in "Install: Light" "Install: Dark" "Install: Both" "Generate: All accent variants" "Generate: Specific accent variant" "Install generated accent variants into ~/.themes" "Apply: pick an installed theme as active" "Install libadwaita override" "Install Extras (icons/wallpapers/cursors/ulauncher/GDM/extensions)" "Uninstall Tahoe" "Force reload theme" "Help" "Exit"; do break; done
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
      "Apply: pick an installed theme as active")
        # List Tahoe-* dirs in ~/.themes and let user pick
        mapfile -t _installed < <(find "$THEME_DIR" -mindepth 1 -maxdepth 1 -type d -name "Tahoe-*" -printf "%f\n" 2>/dev/null | sort)
        if [ ${#_installed[@]} -eq 0 ]; then
          gum_or_echo "${YELLOW}No installed Tahoe themes found in $THEME_DIR. Install one first.${NC}"
        else
          if command -v gum &>/dev/null; then
            _picked=$(printf '%s\n' "${_installed[@]}" | gum choose --cursor ">" --height 12)
          else
            select _picked in "${_installed[@]}"; do break; done
          fi
          [ -n "${_picked:-}" ] && apply_theme "$_picked"
        fi
        ;;
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
      "Install Extras (icons/wallpapers/cursors/ulauncher/GDM/extensions)")
        if command -v gum &>/dev/null; then
          ex=$(gum choose \
            "Install all recommended GNOME extensions" \
            "Install Tahoe Blur extension" \
            "Install Tahoe icons" \
            "Install WhiteSur cursors" \
            "Install Ulauncher theme" \
            "Install WhiteSur GDM theme" \
            "Install Tahoe Wallpapers" \
            "Connect Flatpak themes" \
            "Disconnect Flatpak themes" \
            "Back")
        else
          echo "Extras:"
          echo "  1) Install all recommended GNOME extensions"
          echo "  2) Install Tahoe Blur extension"
          echo "  3) Install Tahoe icons"
          echo "  4) Install WhiteSur cursors"
          echo "  5) Install Ulauncher theme"
          echo "  6) Install WhiteSur GDM theme"
          echo "  7) Install Tahoe Wallpapers"
          echo "  8) Connect Flatpak themes"
          echo "  9) Disconnect Flatpak themes"
          echo " 10) Back"
          read -r -p "Enter choice (1-10): " ex
        fi
        case "$ex" in
          "Install all recommended GNOME extensions"|1) install_recommended_extensions ;;
          "Install Tahoe Blur extension"|2) install_blur_my_shell ;;
          "Install Tahoe icons"|3)
            _icon_color=""
            if gum_confirm_or_read "Match icons to a Tahoe accent color?"; then
              _icon_color="$(choose_accent_color)"
            fi
            install_mactahoe_icons "${_icon_color:-blue}"
            ;;
          "Install WhiteSur cursors"|4) install_icons_or_cursors "https://github.com/vinceliuice/WhiteSur-cursors.git" "WhiteSur-cursors" ;;
          "Install Ulauncher theme"|5) install_ulauncher_theme ;;
          "Install WhiteSur GDM theme"|6) install_gdm_theme ;;
          "Install Tahoe Wallpapers"|7) install_wallpaper ;;
          "Connect Flatpak themes"|8) connect_flatpak ;;
          "Disconnect Flatpak themes"|9) disconnect_flatpak ;;
          "Back"|10) : ;;
          *) gum_or_echo "${YELLOW}Unrecognized option in Extras menu${NC}" ;;
        esac
        ;;
      "Uninstall themes"|"Uninstall Tahoe") uninstall_all ;;
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
  INSTALL_BLUR=false
  INSTALL_EXTENSIONS=false
  INSTALL_ICONS=false

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
      --apply)
        if [ -n "${2:-}" ] && [[ "$2" != -* ]]; then
          apply_theme "$2"
          shift 2
        else
          gum_or_echo "${YELLOW}--apply needs a theme name (e.g. Tahoe-Dark, Tahoe-Light-Blue)${NC}"
          exit 1
        fi
        exit 0
        ;;
      --no-apply)
        SKIP_APPLY=true
        shift
        ;;
      --blur|--blur-my-shell)
        INSTALL_BLUR=true
        shift
        ;;
      --extensions|--gnome-extensions)
        INSTALL_EXTENSIONS=true
        shift
        ;;
      --icons|--icon-theme)
        INSTALL_ICONS=true
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

  if $INSTALL_ICONS; then
    install_mactahoe_icons "${SPECIFIC_COLOR:-blue}"
  fi

  if $INSTALL_EXTENSIONS; then
    install_recommended_extensions
  elif $INSTALL_BLUR; then
    install_blur_my_shell
  fi

  exit 0
fi

### ----------------------------
### Start interactive TUI (default)
### ----------------------------
check_and_install_gum
check_prereqs
check_distro_and_shell

if command -v gum &>/dev/null; then
  gum style --border double --padding "1 2" --margin "1" --foreground 212 "🌄 macOS Tahoe Theme Installer" "Welcome! Let's make your desktop beautiful."
else
  echo -e "${BOLD}macOS Tahoe Theme Installer — Interactive${NC}"
fi

interactive_menu

exit 0
