# Tahoe Icon Overrides

Put licensed replacement app icons in `icons/overrides/apps/` before running the installer.

Supported files:

- `name.svg`
- `name.png`

The filename must match the Linux app icon name. Examples:

- `org.gnome.Nautilus.svg`
- `firefox.png`
- `com.visualstudio.code.png`

When you run `./install.sh --icons` or install a theme with `./install.sh -l` / `./install.sh -d`, the installer copies these files into every installed `Tahoe*` icon variant under `apps/scalable/`.

PNG files are resized to `512x512` when ImageMagick is available (`magick` or `convert`). If ImageMagick is not installed, the original PNG is copied as-is.

Do not commit random images from Google Images unless you have the right to redistribute them. Use your own artwork, open-licensed assets, or exports you are allowed to bundle.
