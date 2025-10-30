# GNOME Extensions Setup Guide

Welcome! This guide will help you set up your GNOME desktop to look like **macOS Tahoe**, just like shown in the screenshots. Follow the steps below carefully.

## Install Required GNOME Extensions

The macOS-Tahoe like theme depends on several GNOME extensions.

### Install Extension Manager (GUI tool)

If you're on Fedora 39+ or Ubuntu 23.04+, install **Extension Manager** from Software Center or:

```bash
flatpak install flathub com.mattjakeman.ExtensionManager
```

## 1. Gnome 4x UI Improvements

- **Description:** UI improvements for GNOME.
- **Download:** [Gnome 4x UI Improvements](https://extensions.gnome.org/extension/4158/gnome-40-ui-improvements/)
- **Setup:**
  1. Download and install from the link above or through **Extension Manager**.
  2. Enable the extension using GNOME Extensions app or Extension Manager.
  3. Follow the steps in below screenshot:
  <p align="center"> <img src="extensions/4x/image.png"/> </p>

## 2. Blur My Shell

- **Description:** Adds blur effects to GNOME Shell, Dock and Applications.
- **Download:** [Blur My Shell](https://extensions.gnome.org/extension/3193/blur-my-shell/)
- **Setup:**
  1. Download and install from the link above or through **Extension Manager**.
  2. Enable the extension using GNOME Extensions app or Extension Manager.
  3. Create all the [**Pipelines**](extensions/blur-my-shell/pipelines/) first.
  <p align="center"> <img src="extensions/blur-my-shell/pipelines/default-rounded.png">
  <p align="center"> <img src="extensions/blur-my-shell/pipelines/default.png">
  <p align="center"> <img src="extensions/blur-my-shell/pipelines/dock.png">
  <p align="center"> <img src="extensions/blur-my-shell/pipelines/lock-screen.png">
  <p align="center"> <img src="extensions/blur-my-shell/pipelines/panel.png">
  4. Follow the below steps.
  <p align="center"> <img src="extensions/blur-my-shell/step1.png">
  <p align="center"> <img src="extensions/blur-my-shell/step2.png">
  <p align="center"> <img src="extensions/blur-my-shell/step3.png">
  <p align="center"> <img src="extensions/blur-my-shell/step4.png">
  <p align="center"> <img src="extensions/blur-my-shell/step5.png">

## 3. Dash to Dock

- **Description:** Moves the GNOME dash out of the overview and transforms it into a dock.
- **Download:** [Dash to Dock](https://extensions.gnome.org/extension/307/dash-to-dock/)
- **Setup:**
  1. Download and install from the link above or through **Extension Manager**.
  2. Enable the extension using GNOME Extensions app or Extension Manager.
  3. Follow the below steps.
  <p align="center"> <img src="extensions/dash-to-dock/step1.png">
  <p align="center"> <img src="extensions/dash-to-dock/step2-1.png">
  <p align="center"> <img src="extensions/dash-to-dock/step2-2.png">
  <p align="center"> <img src="extensions/dash-to-dock/step3.png">
  <p align="center"> <img src="extensions/dash-to-dock/step4.png">

## 4. Open Bar

- **Description:** macOS-style top bar for GNOME.
- **Download:** [Open Bar](https://extensions.gnome.org/extension/6580/open-bar/)
- **Setup:**
  1. Download and install from the link above or through **Extension Manager**.
  2. Enable the extension using GNOME Extensions app or Extension Manager.
  3. To import the config:
     - Open Open Bar settings (Extension Manager → Open Bar → Settings).
     - Go to the `Admin` tab.
     - Click `Import` and select the provided config files - [Dark Mode](extensions/openBar/Tahoe-Dark) and [Light Mode](extensions/openBar/Tahoe-Light)

## 5. Space Bar

- **Description:** Space-themed workspace indicator for GNOME.
- **Download:** [Space Bar](https://extensions.gnome.org/extension/5090/space-bar/)
- **Setup:**
  1. Download and install from the link above.
  2. Enable via GNOME Extensions app.
  3. Follow the below steps.
  <p align="center"> <img src="extensions/space-bar/step1.png">
  <p align="center"> <img src="extensions/space-bar/step2.png">
  <p align="center"> <img src="extensions/space-bar/step3.png">
  <p align="center"> <img src="extensions/space-bar/step4.png">

## 6. Tiling Shell

- **Description:** Tiling window management for GNOME Shell.
- **Download:** [Tiling Shell](https://extensions.gnome.org/extension/7065/tiling-shell/)
- **Setup:**
  1. Download and install from the link above.
  2. Enable via GNOME Extensions app.
  3. To import the config:
     - Open Tiling Shell settings.
     - Scroll down to the last section.
     - Click `Import` and select the provided [config file](extensions/tiling-shell/tilingshell-settings.txt).

## Install App Launcher Theme

- App launcher theme can be installed using the **Install Extra** option in the interactive CLI menu.
- Or you can find the theme for app launcher [here](https://github.com/kayozxo/ulauncher-liquid-glass) if you missed it.

## ✅ Done!

If you like my project, you can buy me a coffee, many thanks ❤️ !

<a href="https://www.buymeacoffee.com/kayozxo"><img src="screenshots/bmc-button.png" width="120" height="30"/></a>

Reboot or log out and back in — your GNOME should now resemble **macOS Tahoe**!

If you face any issues or have questions, feel free to open an issue on the repo or drop a comment on [my Reddit post](https://www.reddit.com/r/unixporn/comments/1ogcgqg/gnome_macos_tahoe_v060/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button).
