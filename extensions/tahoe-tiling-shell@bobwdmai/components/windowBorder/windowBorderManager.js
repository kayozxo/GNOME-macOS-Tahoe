import { Gio } from "../../gi/ext.js";
import WindowBorder from "./windowBorder.js";
import SignalHandling from "../../utils/signalHandling.js";
import Settings from "../../settings/settings.js";

class WindowBorderManager {
  _signals;
  _border;
  _enableScaling;
  _interfaceSettings;
  constructor(enableScaling) {
    this._signals = new SignalHandling();
    this._border = null;
    this._enableScaling = enableScaling;
    this._interfaceSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.interface"
    });
  }

  enable() {
    if (Settings.ENABLE_WINDOW_BORDER) this._turnOn();
    this._signals.connect(
      Settings,
      Settings.KEY_ENABLE_WINDOW_BORDER,
      () => {
        if (Settings.ENABLE_WINDOW_BORDER) this._turnOn();
        else this._turnOff();
      }
    );
  }

  _turnOn() {
    this._onWindowFocused();
    this._signals.connect(
      global.display,
      "notify::focus-window",
      this._onWindowFocused.bind(this)
    );
    this._signals.connect(
      Settings,
      Settings.KEY_WINDOW_BORDER_COLOR,
      () => this._border?.updateStyle()
    );
    this._signals.connect(
      Settings,
      Settings.KEY_WINDOW_USE_CUSTOM_BORDER_COLOR,
      () => this._border?.updateStyle()
    );
    this._interfaceSettings.connect(
      "changed::accent-color",
      () => this._border?.updateStyle()
    );
    this._signals.connect(
      Settings,
      Settings.KEY_WINDOW_BORDER_WIDTH,
      () => this._border?.updateStyle()
    );
  }

  _turnOff() {
    this.destroy();
    this.enable();
  }

  destroy() {
    this._signals.disconnect();
    this._border?.destroy();
    this._border = null;
  }

  _onWindowFocused() {
    const metaWindow = global.display.focus_window;
    if (!metaWindow || metaWindow.get_wm_class() === null || metaWindow.get_wm_class() === "gjs") {
      this._border?.destroy();
      this._border = null;
      return;
    }
    if (!this._border)
      this._border = new WindowBorder(metaWindow, this._enableScaling);
    else this._border.trackWindow(metaWindow);
  }
}

export {
  WindowBorderManager
};
