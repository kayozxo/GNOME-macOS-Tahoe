#!/usr/bin/env bash
set -euo pipefail

THEME_FOLDER="macOS-Tahoe"
SRC_PATH="$(pwd)/$THEME_FOLDER"
DEST_DIR="$HOME/.themes/$THEME_FOLDER"

REPO="arcnations-united/evolve-core"
TMP_ZIP="evolve-core-latest.zip"

echo "📁 Installing local theme '$THEME_FOLDER'..."

if [ ! -d "$SRC_PATH" ]; then
  echo "❌ Error: '$THEME_FOLDER' not found in current directory."
  exit 1
fi

mkdir -p "$HOME/.themes"

if [ -e "$DEST_DIR" ]; then
  echo "⚠️  Found existing local theme at '$DEST_DIR', removing..."
  rm -rf "$DEST_DIR"
fi

cp -r "$SRC_PATH" "$DEST_DIR"
echo "✅ Local theme installed."

echo
echo "🌐 Downloading latest release of '$REPO'..."
DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" \
  | grep '"browser_download_url":' \
  | sed -E 's/.*"([^"]+)".*/\1/')

echo "⬇️  URL: $DOWNLOAD_URL"
curl -L -o "$TMP_ZIP" "$DOWNLOAD_URL"

echo "📦 Extracting release ZIP to ~/.themes..."
unzip -o "$TMP_ZIP" -d "$HOME/Downloads/Evolve"
rm "$TMP_ZIP"
echo "✅ Release extracted."

echo
echo "🎨 Finalized installation in ~/.themes/"
echo "👉 Open Downloads folder and look for folder Evolve"
echo "   • Open the app, select GTK 3.0 Theme and GTK 4.0 → '$THEME_FOLDER'"
echo
echo "Enjoy the theme! 🍎"
exit 0