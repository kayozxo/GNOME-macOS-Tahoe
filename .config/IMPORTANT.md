# Start here

Welcome! This guide will help you set up your GNOME desktop to look like **macOS Tahoe**, just like shown in the screenshots. Follow the steps below carefully.

---

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

---

## Step 2: Install WhiteSur GTK Theme

We are using the **WhiteSur GTK Theme** for macOS-like [lock screen](https://github.com/vinceliuice/WhiteSur-gtk-theme?tab=readme-ov-file#--install-and-customize-gdm-theme--).

1. **Download the theme**
   Head over to the official theme page:
   → [https://github.com/vinceliuice/WhiteSur-gtk-theme](https://github.com/vinceliuice/WhiteSur-gtk-theme)

2. **Install the GDM theme**

   ```bash
   git clone https://github.com/vinceliuice/WhiteSur-gtk-theme.git
   cd WhiteSur-gtk-theme
   ```

   - And follow the guide [here](https://github.com/vinceliuice/WhiteSur-gtk-theme?tab=readme-ov-file#--install-and-customize-gdm-theme--)

3. **(Optional) Install matching icon and cursor theme:**

   ```bash
   # Icon Theme
   git clone https://github.com/vinceliuice/WhiteSur-icon-theme.git
   cd WhiteSur-icon-theme
   ./install.sh

   # Cursor Theme
   git clone https://github.com/vinceliuice/WhiteSur-cursors.git
   cd WhiteSur-cursors
   ./install.sh
   ```

   > The cursor theme I use is [Phinger](https://github.com/phisch/phinger-cursors)

4. **Apply the theme using GNOME Tweaks**

   - Open **GNOME Tweaks**
   - Go to **Appearance**
   - Set:

     - **Icons**: `WhiteSur`
     - **Cursor**: `WhiteSur`

---

## Step 3: Install Required GNOME Extensions

The macOS-Tahoe like theme depends on several GNOME extensions.

### Install Extension Manager (GUI tool)

If you're on Fedora 39+ or Ubuntu 23.04+, install **Extension Manager** from Software Center or:

```bash
flatpak install flathub com.mattjakeman.ExtensionManager
```

### Enable the following extensions:

- You can find the list of all required extensions in the `README.md` file of this repo. Please enable **each one** using the Extension Manager or GNOME Extensions website: [https://extensions.gnome.org](https://extensions.gnome.org)
- After that, navigate to [extension](./extensions/) folder and follow steps for each extension.
- You can find the theme for app launcher [here](https://github.com/kayozxo/ulauncher-liquid-glass)

---

## ✅ Done!

Reboot or log out and back in — your GNOME should now resemble **macOS Tahoe**!

If you face any issues or have questions, feel free to open an issue on the repo or drop a comment on [my Reddit post](https://www.reddit.com/r/unixporn/comments/1l9dqpk/gnome_macos_tahoe_but_better/).
