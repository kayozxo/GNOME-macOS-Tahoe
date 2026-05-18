#!/bin/bash

ROOT_UID=0
DEST_DIR=

# Destination directory
if [ "$UID" -eq "$ROOT_UID" ]; then
  DEST_DIR="/usr/share/icons"
else
  DEST_DIR="$HOME/.local/share/icons"
fi

OPEN_DIR="$(cd "$(dirname "$0")" && pwd)"

THEME_NAME=MacTahoe
COLOR_VARIANTS=('' '-dark')

SRC_DIR="$OPEN_DIR"/src
INDEX="$SRC_DIR/cursorSVG"

install_cursors() {
  local dest=${1}
  local name=${2}
  local color=${3}
  local svgid=${4}

  local THEME_DIR="${dest}/${name}${color}-cursors"

  [[ -d "$THEME_DIR" ]] && rm -rf "$THEME_DIR"
  mkdir -p "$THEME_DIR"
  cp -r "${OPEN_DIR}/dist${color}"/* "${THEME_DIR}"
#  cp -r "${SRC_DIR}/cursor.theme" "${THEME_DIR}"
#  sed -i "s/${name}/${name}${color}/g" "${THEME_DIR}/cursor.theme"
  cp -rf "$SRC_DIR"/scalable "${THEME_DIR}"/cursors_scalable
  cp -rf "$SRC_DIR/svg${color}/${svgid}.svg" "${THEME_DIR}/cursors_scalable/${svgid}"
  cp -rf "$SRC_DIR/svg${color}/progress"*".svg" "${THEME_DIR}/cursors_scalable/progress"
  cp -rf "$SRC_DIR/svg${color}/wait"*".svg" "${THEME_DIR}/cursors_scalable/wait"
}

install_cursor_theme() {
  for color in "${COLOR_VARIANTS[@]}"; do
    for svgid in `cat $INDEX`; do
      install_cursors "${dest:-${DEST_DIR}}" "${name:-${THEME_NAME}}" "${color}" "${svgid}"
    done
  done
}

install_cursor_theme

echo "Finished..."

