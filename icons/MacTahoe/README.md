<img src="logo.png" alt="Logo" align="right" /> MacTahoe Icon Theme
===

MacOS Tahoe like icon theme for linux desktops

### Donate

If you like my project, you can buy me a coffee:

<span class="paypal"><a href="https://www.paypal.me/vinceliuice" title="Donate to this project using Paypal"><img src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png" alt="PayPal donate button" /></a></span>

![1](preview.png)
![2](screenshot1.jpg)
![3](screenshot2.jpg)

## Install tips

Usage:  `./install.sh`  **[OPTIONS...]**

|  OPTIONS:           | |
|:--------------------|:-------------|
|-d, --dest           | Specify theme destination directory (Default: $HOME/.local/share/icons)|
|-n, --name           | Specify theme name (Default: MacTahoe)|
|-t, --theme          | Specify theme color variant(s) [default/purple/pink/red/orange/yellow/green/grey/all] (Default: blue)|
|-b, --bold           | Install bold panel icons version|
|-r,--remove,-u,--uninstall | Uninstall (remove) icon themes|
|-h, --help           | Show this help|

> **Note for snaps:** To use these icons with snaps, the best way is to make a copy of the application's .desktop located in `/var/lib/snapd/desktop/applications/name-of-the-snap-application.desktop` into `$HOME/.local/share/applications/`. Then use any text editor and change the "Icon=" to "Icon=name-of-the-icon.svg"

> For more information, run: `./install.sh --help`

![bold](bold-size.png?raw=true)

> The bold version is recommended for use with a `High resolution display` like a 4k display with a 200% scale factor!

## Recommendations
This icon theme works well with:

### GTK themes
MacTahoe-gtk-theme: https://github.com/vinceliuice/MacTahoe-gtk-theme

### Cursor themes
MacTahoe-cursor-theme: https://github.com/vinceliuice/MacTahoe-icon-theme/tree/main/cursors