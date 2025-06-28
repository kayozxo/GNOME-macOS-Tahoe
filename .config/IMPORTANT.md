# Start here

Welcome! This guide will help you set up your GNOME desktop to look like **macOS Tahoe**, just like shown in the screenshots. Follow the steps below carefully.

## Step 1: Install GNOME Tweaks

> GNOME Tweaks is essential for applying GTK themes, icons, cursors, and more.

### Fedora

```bash
sudo dnf install gnome-tweaks
```

### Ubuntu/Debian

```bash
sudo apt install gnome-tweaks
```

## Step 2: Install Cursor and Icons

1. **(Optional) Install matching icon and cursor theme:**

   ```bash
   # Icon Theme
   git clone https://github.com/vinceliuice/MacTahoe-icon-theme.git
   cd MacTahoe-icon-theme
   ./install.sh

   # Cursor Theme
   git clone https://github.com/vinceliuice/WhiteSur-cursors.git
   cd WhiteSur-cursors
   ./install.sh
   ```

   > The cursor theme I use is [Phinger](https://github.com/phisch/phinger-cursors)

2. **Apply the theme using GNOME Tweaks**

   - Open **GNOME Tweaks**
   - Go to **Appearance**
   - Set:

     - **Icons**: `MacTahoe-Dark` or `MacTahoe-Light`
     - **Cursor**: `WhiteSur`

## Step 3: Install Required GNOME Extensions

The macOS-Tahoe like theme depends on several GNOME extensions.

### Install Extension Manager (GUI tool)

If you're on Fedora 39+ or Ubuntu 23.04+, install **Extension Manager** from Software Center or:

```bash
flatpak install flathub com.mattjakeman.ExtensionManager
```

### Enable the following extensions:

- Follow [this](EXTENSIONS.md)
- You can find the theme for app launcher [here](https://github.com/kayozxo/ulauncher-liquid-glass)

## ✅ Done!

Reboot or log out and back in — your GNOME should now resemble **macOS Tahoe**!

If you face any issues or have questions, feel free to open an issue on the repo or drop a comment on [my Reddit post](https://www.reddit.com/r/unixporn/comments/1lkaxv4/gnome_macos_tahoe_v030/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button)
