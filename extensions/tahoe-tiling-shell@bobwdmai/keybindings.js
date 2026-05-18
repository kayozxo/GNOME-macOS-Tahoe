import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { GObject, Meta, Gio, Shell, GLib } from "./gi/ext.js";
import Settings from "./settings/settings.js";
import SettingsOverride from "./settings/settingsOverride.js";
import SignalHandling from "./utils/signalHandling.js";
import { registerGObjectClass } from "./utils/gjs.js";
import { logger } from "./utils/logger.js";
const debug = logger("KeyBindings");
var KeyBindingsDirection = /* @__PURE__ */ ((KeyBindingsDirection2) => {
  KeyBindingsDirection2[KeyBindingsDirection2["NODIRECTION"] = 1] = "NODIRECTION";
  KeyBindingsDirection2[KeyBindingsDirection2["UP"] = 2] = "UP";
  KeyBindingsDirection2[KeyBindingsDirection2["DOWN"] = 3] = "DOWN";
  KeyBindingsDirection2[KeyBindingsDirection2["LEFT"] = 4] = "LEFT";
  KeyBindingsDirection2[KeyBindingsDirection2["RIGHT"] = 5] = "RIGHT";
  return KeyBindingsDirection2;
})(KeyBindingsDirection || {});
var FocusSwitchDirection = /* @__PURE__ */ ((FocusSwitchDirection2) => {
  FocusSwitchDirection2[FocusSwitchDirection2["NEXT"] = 1] = "NEXT";
  FocusSwitchDirection2[FocusSwitchDirection2["PREV"] = 2] = "PREV";
  return FocusSwitchDirection2;
})(FocusSwitchDirection || {});
const _KeyBindings = class _KeyBindings extends GObject.Object {
  _signals;
  _cycleLayoutsAction;
  _cycleLayoutsBackwardAction;
  constructor(extensionSettings) {
    super();
    this._signals = new SignalHandling();
    this._signals.connect(
      Settings,
      Settings.KEY_ENABLE_MOVE_KEYBINDINGS,
      () => {
        this._setupKeyBindings(extensionSettings);
      }
    );
    if (Settings.ENABLE_MOVE_KEYBINDINGS)
      this._setupKeyBindings(extensionSettings);
  }

  get cycleLayoutsAction() {
    return this._cycleLayoutsAction;
  }

  get cycleLayoutsBackwardAction() {
    return this._cycleLayoutsBackwardAction;
  }

  _setupKeyBindings(extensionSettings) {
    if (Settings.ENABLE_MOVE_KEYBINDINGS)
      this._applyKeybindings(extensionSettings);
    else this._removeKeybindings();
  }

  _applyKeybindings(extensionSettings) {
    this._overrideNatives(extensionSettings);
    Main.wm.addKeybinding(
      Settings.SETTING_SPAN_WINDOW_RIGHT,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("span-window", display, 5 /* RIGHT */);
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_SPAN_WINDOW_LEFT,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("span-window", display, 4 /* LEFT */);
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_SPAN_WINDOW_UP,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("span-window", display, 2 /* UP */);
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_SPAN_WINDOW_DOWN,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("span-window", display, 3 /* DOWN */);
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_SPAN_WINDOW_ALL_TILES,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("span-window-all-tiles", display);
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_UNTILE_WINDOW,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (dp) => this.emit("untile-window", dp)
    );
    Main.wm.addKeybinding(
      Settings.SETTING_MOVE_WINDOW_CENTER,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (dp) => this.emit("move-window-center", dp)
    );
    Main.wm.addKeybinding(
      Settings.SETTING_FOCUS_WINDOW_RIGHT,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit(
          "focus-window-direction",
          display,
          5 /* RIGHT */
        );
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_FOCUS_WINDOW_LEFT,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit(
          "focus-window-direction",
          display,
          4 /* LEFT */
        );
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_FOCUS_WINDOW_UP,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit(
          "focus-window-direction",
          display,
          2 /* UP */
        );
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_FOCUS_WINDOW_DOWN,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit(
          "focus-window-direction",
          display,
          3 /* DOWN */
        );
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_FOCUS_WINDOW_NEXT,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("focus-window", display, 1 /* NEXT */);
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_FOCUS_WINDOW_PREV,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("focus-window", display, 2 /* PREV */);
      }
    );
    Main.wm.addKeybinding(
      Settings.SETTING_HIGHLIGHT_CURRENT_WINDOW,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display) => {
        this.emit("highlight-current-window", display);
      }
    );
    this._cycleLayoutsAction = Main.wm.addKeybinding(
      Settings.SETTING_CYCLE_LAYOUTS,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      (display, _unused, event, binding) => {
        this._onCycleLayouts(display, event, binding, this._cycleLayoutsAction);
      }
    );
    this._cycleLayoutsBackwardAction = Main.wm.addKeybinding(
      Settings.SETTING_CYCLE_LAYOUTS_BACKWARD,
      extensionSettings,
      Meta.KeyBindingFlags.IS_REVERSED,
      Shell.ActionMode.NORMAL,
      (display, _unused, event, binding) => {
        this._onCycleLayouts(display, event, binding, this._cycleLayoutsBackwardAction);
      }
    );
  }

  _onCycleLayouts(display, event, binding, action) {
    const mask = event.get_mask ? event.get_mask() : binding.get_mask();
    this.emit("cycle-layouts", display, action, mask);
  }

  _overrideNatives(extensionSettings) {
    const mutterKeybindings = new Gio.Settings({
      schema_id: "org.gnome.mutter.keybindings"
    });
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_RIGHT,
      (display) => {
        this.emit("move-window", display, 5 /* RIGHT */);
      },
      extensionSettings,
      mutterKeybindings,
      "toggle-tiled-right"
    );
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_LEFT,
      (display) => {
        this.emit("move-window", display, 4 /* LEFT */);
      },
      extensionSettings,
      mutterKeybindings,
      "toggle-tiled-left"
    );
    const desktopWm = new Gio.Settings({
      schema_id: "org.gnome.desktop.wm.keybindings"
    });
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_UP,
      (display) => {
        this.emit("move-window", display, 2 /* UP */);
      },
      extensionSettings,
      desktopWm,
      "maximize"
    );
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_DOWN,
      (display) => {
        this.emit("move-window", display, 3 /* DOWN */);
      },
      extensionSettings,
      desktopWm,
      "unmaximize"
    );
  }

  _overrideKeyBinding(name, handler, extensionSettings, nativeSettings, nativeKeyName) {
    const done = SettingsOverride.get().override(
      nativeSettings,
      nativeKeyName,
      new GLib.Variant("as", [])
    );
    if (!done) {
      debug(`failed to override ${nativeKeyName}`);
      return;
    }
    Main.wm.addKeybinding(
      name,
      extensionSettings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.NORMAL,
      handler
    );
  }

  _removeKeybindings() {
    this._restoreNatives();
    Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_RIGHT);
    Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_LEFT);
    Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_UP);
    Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_DOWN);
    Main.wm.removeKeybinding(Settings.SETTING_SPAN_WINDOW_RIGHT);
    Main.wm.removeKeybinding(Settings.SETTING_SPAN_WINDOW_LEFT);
    Main.wm.removeKeybinding(Settings.SETTING_SPAN_WINDOW_UP);
    Main.wm.removeKeybinding(Settings.SETTING_SPAN_WINDOW_DOWN);
    Main.wm.removeKeybinding(Settings.SETTING_SPAN_WINDOW_ALL_TILES);
    Main.wm.removeKeybinding(Settings.SETTING_UNTILE_WINDOW);
    Main.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_CENTER);
    Main.wm.removeKeybinding(Settings.SETTING_FOCUS_WINDOW_UP);
    Main.wm.removeKeybinding(Settings.SETTING_FOCUS_WINDOW_DOWN);
    Main.wm.removeKeybinding(Settings.SETTING_FOCUS_WINDOW_LEFT);
    Main.wm.removeKeybinding(Settings.SETTING_FOCUS_WINDOW_RIGHT);
    Main.wm.removeKeybinding(Settings.SETTING_FOCUS_WINDOW_NEXT);
    Main.wm.removeKeybinding(Settings.SETTING_FOCUS_WINDOW_PREV);
    Main.wm.removeKeybinding(Settings.SETTING_HIGHLIGHT_CURRENT_WINDOW);
    Main.wm.removeKeybinding(Settings.SETTING_CYCLE_LAYOUTS);
    Main.wm.removeKeybinding(Settings.SETTING_CYCLE_LAYOUTS_BACKWARD);
  }

  _restoreNatives() {
    const mutterKeybindings = new Gio.Settings({
      schema_id: "org.gnome.mutter.keybindings"
    });
    SettingsOverride.get().restoreKey(
      mutterKeybindings,
      "toggle-tiled-right"
    );
    SettingsOverride.get().restoreKey(
      mutterKeybindings,
      "toggle-tiled-left"
    );
    const desktopWm = new Gio.Settings({
      schema_id: "org.gnome.desktop.wm.keybindings"
    });
    SettingsOverride.get().restoreKey(desktopWm, "maximize");
    SettingsOverride.get().restoreKey(desktopWm, "unmaximize");
  }

  destroy() {
    this._removeKeybindings();
  }
};
registerGObjectClass(_KeyBindings, {
  GTypeName: "KeyBindings",
  Signals: {
    "move-window": {
      param_types: [Meta.Display.$gtype, GObject.TYPE_INT]
      // Meta.Display, KeyBindingsDirection
    },
    "span-window": {
      param_types: [Meta.Display.$gtype, GObject.TYPE_INT]
      // Meta.Display, KeyBindingsDirection
    },
    "span-window-all-tiles": {
      param_types: [Meta.Display.$gtype]
      // Meta.Display
    },
    "untile-window": {
      param_types: [Meta.Display.$gtype]
      // Meta.Display
    },
    "move-window-center": {
      param_types: [Meta.Display.$gtype]
      // Meta.Display
    },
    "focus-window-direction": {
      param_types: [Meta.Display.$gtype, GObject.TYPE_INT]
      // Meta.Display, KeyBindingsDirection
    },
    "focus-window": {
      param_types: [Meta.Display.$gtype, GObject.TYPE_INT]
      // Meta.Display, FocusSwitchDirection
    },
    "highlight-current-window": {
      param_types: [Meta.Display.$gtype]
      // Meta.Display
    },
    "cycle-layouts": {
      param_types: [
        Meta.Display.$gtype,
        GObject.TYPE_INT,
        GObject.TYPE_INT
      ]
      // Meta.Display, action number, mask number
    }
  }
});
let KeyBindings = _KeyBindings;
export {
  FocusSwitchDirection,
  KeyBindingsDirection,
  KeyBindings as default
};
