/*!
 * Tiling Shell: advanced and modern window management for GNOME
 *
 * Copyright (C) 2025 Domenico Ferraro
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Extension } from "./polyfill.js";
import { Gio, GLib, Meta } from "./gi/ext.js";
import { logger } from "./utils/logger.js";
import {
  filterUnfocusableWindows,
  getMonitors,
  getWindows,
  squaredEuclideanDistance
} from "./utils/ui.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { TilingManager } from "./components/tilingsystem/tilingManager.js";
import Settings from "./settings/settings.js";
import SignalHandling from "./utils/signalHandling.js";
import GlobalState from "./utils/globalState.js";
import Indicator from "./indicator/indicator.js";
import DBus from "./dbus.js";
import { KeyBindingsDirection, FocusSwitchDirection } from "./keybindings.js";
import KeyBindings from "./keybindings.js";
import SettingsOverride from "./settings/settingsOverride.js";
import { ResizingManager } from "./components/tilingsystem/resizeManager.js";
import OverriddenWindowMenu from "./components/window_menu/overriddenWindowMenu.js";
import { WindowBorderManager } from "./components/windowBorder/windowBorderManager.js";
import TilingShellWindowManager from "./components/windowManager/tilingShellWindowManager.js";
import OverriddenAltTab from "./components/altTab/overriddenAltTab.js";
import { LayoutSwitcherPopup } from "./components/layoutSwitcher/layoutSwitcher.js";
import { unmaximizeWindow } from "./utils/gnomesupport.js";
import * as Config from "resource:///org/gnome/shell/misc/config.js";
import { RaiseTogetherManager } from "./components/raiseTogether/raiseTogetherManager.js";
const debug = logger("extension");

class TilingShellExtension extends Extension {
  _indicator;
  _tilingManagers;
  _fractionalScalingEnabled;
  _dbus;
  _signals;
  _keybindings;
  _resizingManager;
  _windowBorderManager;
  _raiseTogetherManager;
  constructor(metadata) {
    super(metadata);
    this._signals = null;
    this._fractionalScalingEnabled = false;
    this._tilingManagers = [];
    this._indicator = null;
    this._dbus = null;
    this._keybindings = null;
    this._resizingManager = null;
    this._windowBorderManager = null;
    this._raiseTogetherManager = null;
  }

  createIndicator() {
    this._indicator = new Indicator(this.path, this.uuid);
    this._indicator.enableScaling = !this._fractionalScalingEnabled;
    this._indicator.enable();
    this._signals?.connect(this._indicator, "open-preferences", () => this.openPreferences());
  }

  _validateSettings() {
    if (Settings.LAST_VERSION_NAME_INSTALLED === "17.0") {
      debug("apply compatibility changes");
      Settings.WINDOW_USE_CUSTOM_BORDER_COLOR = Settings.ENABLE_WINDOW_BORDER;
    }
    if (Settings.LAST_VERSION_NAME_INSTALLED !== "17.3") {
      debug("apply compatibility changes for 17.3");
      Settings.gioSetting.set_strv(Settings.SETTING_CYCLE_LAYOUTS_BACKWARD, [
        `<Shift>${Settings.gioSetting.get_strv(Settings.SETTING_CYCLE_LAYOUTS)}`
      ]);
    }
  }

  _onInstall() {
    const GNOME_VERSION_MAJOR = Number(
      Config.PACKAGE_VERSION.split(".")[0]
    );
    Settings.WINDOW_USE_CUSTOM_BORDER_COLOR = GNOME_VERSION_MAJOR < 47;
  }

  enable() {
    if (this._signals) this._signals.disconnect();
    this._signals = new SignalHandling();
    Settings.initialize(this.getSettings());
    if (Settings.LAST_VERSION_NAME_INSTALLED === "0") {
      this._onInstall();
      if (this.metadata["version-name"]) {
        Settings.LAST_VERSION_NAME_INSTALLED = this.metadata["version-name"] || "0";
      }
    }
    this._validateSettings();
    TilingShellWindowManager.get();
    this._fractionalScalingEnabled = this._isFractionalScalingEnabled(
      new Gio.Settings({ schema: "org.gnome.mutter" })
    );
    if (this._keybindings) this._keybindings.destroy();
    this._keybindings = new KeyBindings(this.getSettings());
    if (Settings.ACTIVE_SCREEN_EDGES) {
      SettingsOverride.get().override(
        new Gio.Settings({ schemaId: "org.gnome.mutter" }),
        "edge-tiling",
        new GLib.Variant("b", false)
      );
    }
    if (Main.layoutManager._startingUp) {
      this._signals.connect(
        Main.layoutManager,
        "startup-complete",
        () => {
          this._createTilingManagers();
          this._setupSignals();
        }
      );
    } else {
      this._createTilingManagers();
      this._setupSignals();
    }
    this._resizingManager = new ResizingManager();
    this._resizingManager.enable();
    if (this._windowBorderManager) this._windowBorderManager.destroy();
    this._windowBorderManager = new WindowBorderManager(
      !this._fractionalScalingEnabled
    );
    this._windowBorderManager.enable();
    this._raiseTogetherManager = new RaiseTogetherManager();
    this._raiseTogetherManager.enable();
    this.createIndicator();
    if (this._dbus) this._dbus.disable();
    this._dbus = new DBus();
    this._dbus.enable(this);
    if (Settings.OVERRIDE_WINDOW_MENU) OverriddenWindowMenu.enable();
    if (Settings.OVERRIDE_ALT_TAB) OverriddenAltTab.enable();
    debug("extension is enabled");
  }

  openLayoutEditor() {
    this._indicator?.openLayoutEditor();
  }

  _createTilingManagers() {
    debug("building a tiling manager for each monitor");
    this._tilingManagers.forEach((tm) => tm.destroy());
    this._tilingManagers = getMonitors().map(
      (monitor) => new TilingManager(monitor, !this._fractionalScalingEnabled)
    );
    this._tilingManagers.forEach((tm) => tm.enable());
  }

  _setupSignals() {
    if (!this._signals) return;
    this._signals.connect(global.display, "workareas-changed", () => {
      const allMonitors = getMonitors();
      if (this._tilingManagers.length !== allMonitors.length) {
        GlobalState.get().validate_selected_layouts();
        this._createTilingManagers();
      } else {
        this._tilingManagers.forEach((tm, index) => {
          tm.workArea = Main.layoutManager.getWorkAreaForMonitor(index);
        });
      }
    });
    this._signals.connect(
      new Gio.Settings({ schema: "org.gnome.mutter" }),
      "changed::experimental-features",
      (_mutterSettings) => {
        if (!_mutterSettings) return;
        const fractionalScalingEnabled = this._isFractionalScalingEnabled(_mutterSettings);
        if (this._fractionalScalingEnabled === fractionalScalingEnabled)
          return;
        this._fractionalScalingEnabled = fractionalScalingEnabled;
        this._createTilingManagers();
        if (this._indicator) {
          this._indicator.enableScaling = !this._fractionalScalingEnabled;
        }
        if (this._windowBorderManager)
          this._windowBorderManager.destroy();
        this._windowBorderManager = new WindowBorderManager(
          this._fractionalScalingEnabled
        );
        this._windowBorderManager.enable();
      }
    );
    if (this._keybindings) {
      this._signals.connect(
        this._keybindings,
        "move-window",
        (kb, dp, dir) => {
          this._onKeyboardMoveWin(dp, dir, false);
        }
      );
      this._signals.connect(
        this._keybindings,
        "span-window",
        (kb, dp, dir) => {
          this._onKeyboardMoveWin(dp, dir, true);
        }
      );
      this._signals.connect(
        this._keybindings,
        "span-window-all-tiles",
        (kb, dp) => {
          const window = dp.focus_window;
          const monitorIndex = window.get_monitor();
          const manager = this._tilingManagers[monitorIndex];
          if (manager) manager.onSpanAllTiles(window);
        }
      );
      this._signals.connect(
        this._keybindings,
        "untile-window",
        this._onKeyboardUntileWindow.bind(this)
      );
      this._signals.connect(
        this._keybindings,
        "move-window-center",
        (kb, dp) => {
          this._onKeyboardMoveWin(
            dp,
            KeyBindingsDirection.NODIRECTION,
            false
          );
        }
      );
      this._signals.connect(
        this._keybindings,
        "focus-window",
        (kb, dp, dir) => {
          this._onKeyboardFocusWin(dp, dir);
        }
      );
      this._signals.connect(
        this._keybindings,
        "focus-window-direction",
        (kb, dp, dir) => {
          this._onKeyboardFocusWinDirection(dp, dir);
        }
      );
      this._signals.connect(
        this._keybindings,
        "highlight-current-window",
        (kb, dp) => {
          const focus_window = dp.get_focus_window();
          getWindows(
            global.workspaceManager.get_active_workspace()
          ).forEach((win) => {
            if (win !== focus_window && win.can_minimize())
              win.minimize();
          });
          Main.activateWindow(
            focus_window,
            global.get_current_time()
          );
        }
      );
      this._signals.connect(
        this._keybindings,
        "cycle-layouts",
        (kb, dp, currentAction, mask) => {
          const backwardAction = kb.cycleLayoutsBackwardAction;
          const switcher = new LayoutSwitcherPopup(
            kb.cycleLayoutsAction,
            backwardAction,
            !this._fractionalScalingEnabled
          );
          if (!switcher.show(currentAction === backwardAction, "", mask)) switcher.destroy();
        }
      );
    }
    this._signals.connect(
      Settings,
      Settings.KEY_ACTIVE_SCREEN_EDGES,
      () => {
        const gioSettings = new Gio.Settings({
          schemaId: "org.gnome.mutter"
        });
        if (Settings.ACTIVE_SCREEN_EDGES) {
          debug("disable native edge tiling");
          SettingsOverride.get().override(
            gioSettings,
            "edge-tiling",
            new GLib.Variant("b", false)
          );
        } else {
          debug("bring back native edge tiling");
          SettingsOverride.get().restoreKey(
            gioSettings,
            "edge-tiling"
          );
        }
      }
    );
    this._signals.connect(
      Settings,
      Settings.KEY_OVERRIDE_WINDOW_MENU,
      () => {
        if (Settings.OVERRIDE_WINDOW_MENU)
          OverriddenWindowMenu.enable();
        else OverriddenWindowMenu.disable();
      }
    );
    this._signals.connect(
      OverriddenWindowMenu,
      "tile-clicked",
      (_, tile, window) => {
        const monitorIndex = window.get_monitor();
        const manager = this._tilingManagers[monitorIndex];
        if (manager) manager.onTileFromWindowMenu(tile, window);
      }
    );
    this._signals.connect(Settings, Settings.KEY_OVERRIDE_ALT_TAB, () => {
      if (Settings.OVERRIDE_ALT_TAB) OverriddenAltTab.enable();
      else OverriddenAltTab.disable();
    });
  }

  /* todo private _moveMaximizedToWorkspace(
          wm: Shell.WM,
          winActor: Meta.WindowActor,
          change: Meta.SizeChange,
      ) {
          const window = winActor.metaWindow;
          if (
              window.wmClass === null ||
              change !== Meta.SizeChange.MAXIMIZE || // handle maximize changes only
              (window.maximizedHorizontally && window.maximizedVertically) || // handle maximized window only
              window.is_attached_dialog() || // skip dialogs
              window.is_on_all_workspaces() ||
              window.windowType !== Meta.WindowType.NORMAL || // handle normal windows only
              window.wmClass === 'gjs'
          )
              return;
  
          const prevWorkspace = window.get_workspace();
          // if it is the only window in the workspace, no new workspace is needed
          if (
              !prevWorkspace
                  .list_windows()
                  .find(
                      (otherWin) =>
                          otherWin !== window &&
                          otherWin.windowType === Meta.WindowType.NORMAL &&
                          !otherWin.is_always_on_all_workspaces() &&
                          otherWin.wmClass !== null &&
                          otherWin.wmClass !== 'gjs',
                  )
          )
              return;
  
          // disable GNOME default fade out animation
          // @ts-expect-error Main.wm has "_sizeChangeWindowDone" function
          Main.wm._sizeChangeWindowDone(global.windowManager, winActor);
  
          const wasActive = prevWorkspace.active;
          // create a new workspace, do not focus it
          const newWorkspace = global.workspace_manager.append_new_workspace(
              false,
              global.get_current_time(),
          );
          // place the workspace after the current one
          global.workspace_manager.reorder_workspace(
              newWorkspace,
              prevWorkspace.index() + 1,
          );
          // queue focus the workspace, focusing the window too. This will trigger workspace slide-in animation
          if (wasActive) window._queue_focus_ws = newWorkspace;
      }
  
      private _onSizeChanged(wm: Shell.WM, winActor: Meta.WindowActor) {
          const window = winActor.metaWindow;
  
          if (!window._queue_focus_ws) return;
          const ws = window._queue_focus_ws;
          delete window._queue_focus_ws;
  
          console.log(`_onSizeChanged ${ws}`);
          // move the window
          ws.activate_with_focus(window, global.get_current_time());
          window.change_workspace(ws);
          // todo check the following
          // If the selected window is on a different workspace, we don't
          // want it to disappear, then slide in with the workspace; instead,
          // always activate it on the active workspace ...
          activeWs.activate_with_focus(window, global.get_current_time());
  
          // ... then slide it over to the original workspace if necessary
          Main.wm.actionMoveWindow(window, ws);
  
      }*/
  _onKeyboardMoveWin(display, direction, spanFlag) {
    const focus_window = display.get_focus_window();
    if (!focus_window || !focus_window.has_focus() || focus_window.get_wm_class() && focus_window.get_wm_class() === "gjs" || focus_window.is_fullscreen())
      return;
    if ((focus_window.maximizedHorizontally || focus_window.maximizedVertically) && spanFlag)
      return;
    if ((focus_window.maximizedHorizontally || focus_window.maximizedVertically) && direction === KeyBindingsDirection.DOWN) {
      unmaximizeWindow(focus_window);
      return;
    }
    const monitorTilingManager = this._tilingManagers[focus_window.get_monitor()];
    if (!monitorTilingManager) return;
    if (Settings.ENABLE_AUTO_TILING && (focus_window.maximizedHorizontally || focus_window.maximizedVertically)) {
      unmaximizeWindow(focus_window);
      return;
    }
    let displayDirection = Meta.DisplayDirection.DOWN;
    switch (direction) {
      case KeyBindingsDirection.LEFT:
        displayDirection = Meta.DisplayDirection.LEFT;
        break;
      case KeyBindingsDirection.RIGHT:
        displayDirection = Meta.DisplayDirection.RIGHT;
        break;
      case KeyBindingsDirection.UP:
        displayDirection = Meta.DisplayDirection.UP;
        break;
    }
    const neighborMonitorIndex = display.get_monitor_neighbor_index(
      focus_window.get_monitor(),
      displayDirection
    );
    const success = monitorTilingManager.onKeyboardMoveWindow(
      focus_window,
      direction,
      false,
      spanFlag,
      neighborMonitorIndex === -1
      // clamp if there is NOT a monitor in this direction
    );
    if (success || direction === KeyBindingsDirection.NODIRECTION || neighborMonitorIndex === -1)
      return;
    if ((focus_window.maximizedHorizontally || focus_window.maximizedVertically) && direction === KeyBindingsDirection.UP) {
      Main.wm.skipNextEffect(focus_window.get_compositor_private());
      unmaximizeWindow(focus_window);
      focus_window.assignedTile = void 0;
    }
    const neighborTilingManager = this._tilingManagers[neighborMonitorIndex];
    if (!neighborTilingManager) return;
    neighborTilingManager.onKeyboardMoveWindow(
      focus_window,
      direction,
      true,
      spanFlag,
      false
    );
  }

  _onKeyboardFocusWinDirection(display, direction) {
    const focus_window = display.get_focus_window();
    if (!focus_window || !focus_window.has_focus() || focus_window.get_wm_class() && focus_window.get_wm_class() === "gjs")
      return;
    let bestWindow;
    let bestWindowDistance = -1;
    const focusWindowRect = focus_window.get_frame_rect();
    const focusWindowCenter = {
      x: focusWindowRect.x + focusWindowRect.width / 2,
      y: focusWindowRect.y + focusWindowRect.height / 2
    };
    const windowList = filterUnfocusableWindows(
      focus_window.get_workspace().list_windows()
    );
    const onlyTiledWindows = Settings.ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY;
    windowList.filter((win) => {
      if (win === focus_window || win.minimized) return false;
      if (onlyTiledWindows && win.assignedTile === void 0)
        return false;
      const winRect = win.get_frame_rect();
      switch (direction) {
        case KeyBindingsDirection.RIGHT:
          return winRect.x > focusWindowRect.x;
        case KeyBindingsDirection.LEFT:
          return winRect.x < focusWindowRect.x;
        case KeyBindingsDirection.UP:
          return winRect.y < focusWindowRect.y;
        case KeyBindingsDirection.DOWN:
          return winRect.y > focusWindowRect.y;
      }
      return false;
    }).forEach((win) => {
      const winRect = win.get_frame_rect();
      const winCenter = {
        x: winRect.x + winRect.width / 2,
        y: winRect.y + winRect.height / 2
      };
      const euclideanDistance = squaredEuclideanDistance(
        winCenter,
        focusWindowCenter
      );
      if (!bestWindow || euclideanDistance < bestWindowDistance || euclideanDistance === bestWindowDistance && bestWindow.get_frame_rect().y > winRect.y) {
        bestWindow = win;
        bestWindowDistance = euclideanDistance;
      }
    });
    if (!bestWindow) return;
    bestWindow.activate(global.get_current_time());
  }

  _onKeyboardFocusWin(display, direction) {
    const focus_window = display.get_focus_window();
    if (!focus_window || !focus_window.has_focus() || focus_window.get_wm_class() && focus_window.get_wm_class() === "gjs")
      return;
    const windowList = filterUnfocusableWindows(
      focus_window.get_workspace().list_windows()
    );
    const focusParent = focus_window.get_transient_for() || focus_window;
    const focusedIdx = windowList.findIndex((win) => {
      return win === focusParent;
    });
    let nextIndex = -1;
    switch (direction) {
      case FocusSwitchDirection.PREV:
        if (focusedIdx === 0 && Settings.WRAPAROUND_FOCUS) {
          windowList[windowList.length - 1].activate(
            global.get_current_time()
          );
        } else {
          windowList[focusedIdx - 1].activate(
            global.get_current_time()
          );
        }
        break;
      case FocusSwitchDirection.NEXT:
        nextIndex = (focusedIdx + 1) % windowList.length;
        if (nextIndex > 0 || Settings.WRAPAROUND_FOCUS)
          windowList[nextIndex].activate(global.get_current_time());
        break;
    }
  }

  _onKeyboardUntileWindow(kb, display) {
    const focus_window = display.get_focus_window();
    if (!focus_window || !focus_window.has_focus() || focus_window.windowType !== Meta.WindowType.NORMAL || focus_window.get_wm_class() && focus_window.get_wm_class() === "gjs")
      return;
    if (focus_window.maximizedHorizontally || focus_window.maximizedVertically)
      unmaximizeWindow(focus_window);
    const monitorTilingManager = this._tilingManagers[focus_window.get_monitor()];
    if (!monitorTilingManager) return;
    monitorTilingManager.onUntileWindow(focus_window, true);
  }

  _isFractionalScalingEnabled(_mutterSettings) {
    return _mutterSettings.get_strv("experimental-features").find(
      (feat) => feat === "scale-monitor-framebuffer" || feat === "x11-randr-fractional-scaling"
    ) !== void 0;
  }

  disable() {
    this._keybindings?.destroy();
    this._keybindings = null;
    this._indicator?.destroy();
    this._indicator = null;
    this._tilingManagers.forEach((tm) => tm.destroy());
    this._tilingManagers = [];
    this._signals?.disconnect();
    this._signals = null;
    this._resizingManager?.destroy();
    this._resizingManager = null;
    this._windowBorderManager?.destroy();
    this._windowBorderManager = null;
    this._raiseTogetherManager?.destroy();
    this._raiseTogetherManager = null;
    this._dbus?.disable();
    this._dbus = null;
    this._fractionalScalingEnabled = false;
    OverriddenWindowMenu.destroy();
    OverriddenAltTab.destroy();
    SettingsOverride.destroy();
    GlobalState.destroy();
    Settings.destroy();
    TilingShellWindowManager.destroy();
    debug("extension is disabled");
  }
}

export {
  TilingShellExtension as default
};
