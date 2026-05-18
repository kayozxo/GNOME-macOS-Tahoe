#! /usr/bin/env bash

WITH_SHADOWS=false

for arg in "$@"; do
  case $arg in
    --with-shadows)
      WITH_SHADOWS=true
      echo "Building with shadows."
      shift
      ;;
  esac
done

# check command avalibility
has_command() {
  "$1" -v $1 > /dev/null 2>&1
}

if [ ! "$(which xcursorgen 2> /dev/null)" ]; then
  echo xcursorgen needs to be installed to generate the cursors.
  if has_command zypper; then
    sudo zypper in xcursorgen
  elif has_command apt; then
    sudo apt install xcursorgen
  elif has_command dnf; then
    sudo dnf install -y xcursorgen
  elif has_command dnf; then
    sudo dnf install xcursorgen
  elif has_command pacman; then
    sudo pacman -S --noconfirm xcursorgen
  fi
fi

if [ ! "$(which inkscape 2> /dev/null)" ]; then
  echo inkscape needs to be installed to generate the cursors.
  if has_command zypper; then
    sudo zypper in inkscape
  elif has_command apt; then
    sudo apt install inkscape
  elif has_command dnf; then
    sudo dnf install -y inkscape
  elif has_command dnf; then
    sudo dnf install inkscape
  elif has_command pacman; then
    sudo pacman -S --noconfirm inkscape
  fi
fi

function create {
	cd "$SRC"
	mkdir -p 24x24 32x32 48x48 64x64 72x72 96x96

	# https://gitlab.com/inkscape/inkscape/-/issues/4716
	export SELF_CALL='xxx'

	cd "$SRC"/$1
	find . -name "*.svg" -type f -exec sh -c 'inkscape -o "../24x24/${0%.svg}.png" -w 24 -h 24 $0' {} \; &
	find . -name "*.svg" -type f -exec sh -c 'inkscape -o "../32x32/${0%.svg}.png" -w 32 -h 32 $0' {} \; &
	find . -name "*.svg" -type f -exec sh -c 'inkscape -o "../48x48/${0%.svg}.png" -w 48 -w 48 $0' {} \; &
	find . -name "*.svg" -type f -exec sh -c 'inkscape -o "../64x64/${0%.svg}.png" -w 64 -w 64 $0' {} \; &
	find . -name "*.svg" -type f -exec sh -c 'inkscape -o "../72x72/${0%.svg}.png" -w 72 -w 72 $0' {} \; &
	find . -name "*.svg" -type f -exec sh -c 'inkscape -o "../96x96/${0%.svg}.png" -w 96 -w 96 $0' {} \; &

	wait

	cd "$SRC"

	OUTPUT="$BUILD"/cursors
	ALIASES="$SRC"/cursorList

	if [ ! -d "$BUILD" ]; then
		mkdir "$BUILD"
	fi
	if [ ! -d "$OUTPUT" ]; then
		mkdir "$OUTPUT"
	fi

	echo -ne "Generating cursor theme...\\r"
	for CUR in config/*.cursor; do
		BASENAME="$CUR"
		BASENAME="${BASENAME##*/}"
		BASENAME="${BASENAME%.*}"

		xcursorgen "$CUR" "$OUTPUT/$BASENAME"
	done
	echo -e "Generating cursor theme... DONE"

	cd "$OUTPUT"

	#generate aliases
	echo -ne "Generating shortcuts...\\r"
	while read ALIAS; do
		FROM="${ALIAS#* }"
		TO="${ALIAS% *}"

		if [ -e $TO ]; then
			continue
		fi
		ln -sr "$FROM" "$TO"
	done < "$ALIASES"
	echo -e "Generating shortcuts... DONE"

	cd "$PWD"

	echo -ne "Generating Theme Index...\\r"
	INDEX="$OUTPUT/../index.theme"
	if [ ! -e "$OUTPUT/../$INDEX" ]; then
		touch "$INDEX"
		echo -e "[Icon Theme]\nName=$THEME\n" > "$INDEX"
	fi
	echo -e "Generating Theme Index... DONE"
}

SRC="$PWD/src"

# Set SVG source directories and theme naming based on shadow flag
if [ "$WITH_SHADOWS" = true ]; then
  SVG_LIGHT="svg-shadow"
  SVG_DARK="svg-dark-shadow"
else
  SVG_LIGHT="svg"
  SVG_DARK="svg-dark"
fi

THEME="MacTahoe Cursors"
BUILD="$PWD/dist$BUILD_SUFFIX"
create "$SVG_LIGHT"

THEME="MacTahoe-dark Cursors"
BUILD="$PWD/dist-dark$BUILD_SUFFIX"
create "$SVG_DARK"

