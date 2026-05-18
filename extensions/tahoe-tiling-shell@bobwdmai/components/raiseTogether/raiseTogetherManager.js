import SignalHandling from "../../utils/signalHandling.js";
import Settings from "../../settings/settings.js";
import { getWindows } from "../../utils/ui.js";

class RaiseTogetherManager {
  _signals;
  _raiseId;
  // map window id to 'raised' signal id
  constructor() {
    this._signals = new SignalHandling();
    this._raiseId = {};
  }

  enable() {
    if (Settings.RAISE_TOGETHER) this._turnOn();
    this._signals.connect(Settings, Settings.KEY_RAISE_TOGETHER, () => {
      if (Settings.RAISE_TOGETHER) this._turnOn();
      else this._turnOff();
    });
  }

  destroy() {
    this._signals.disconnect();
    const toDelete = [];
    Object.keys(this._raiseId).forEach((key) => {
      this._raiseId[key].win.disconnect(this._raiseId[key].id);
      toDelete.push(key);
    });
    toDelete.forEach((key) => delete this._raiseId[key]);
  }

  _turnOn() {
    getWindows().forEach((win) => this._connectRaisedSignal(win));
    this._signals.connect(
      global.display,
      "window-created",
      (_display, window) => {
        this._connectRaisedSignal(window);
      }
    );
  }

  _turnOff() {
    this.destroy();
    this.enable();
  }

  _connectRaisedSignal(window) {
    const raisedId = this._signals.connect(window, "raised", () => {
      if (!window.assignedTile) return;
      this._onTiledWindowRaised(window);
    });
    this._raiseId[window.get_id()] = { id: raisedId, win: window };
    window.connect("unmanaged", () => {
      delete this._raiseId[window.get_id()];
    });
  }

  _onTiledWindowRaised(tiledWindow) {
    const workspace = tiledWindow.get_workspace();
    getWindows(workspace).forEach((winSameWorkspace) => {
      if (!winSameWorkspace.assignedTile) return;
      this._stopRaiseSignalHandling(winSameWorkspace);
      winSameWorkspace.raise();
      this._restartRaiseSignalHandling(winSameWorkspace);
    });
    this._stopRaiseSignalHandling(tiledWindow);
    tiledWindow.raise();
    this._restartRaiseSignalHandling(tiledWindow);
  }

  _stopRaiseSignalHandling(window) {
    const data = this._raiseId[window.get_id()];
    if (!data) return;
    window.block_signal_handler(data.id);
  }

  _restartRaiseSignalHandling(window) {
    const data = this._raiseId[window.get_id()];
    if (!data) return;
    window.unblock_signal_handler(data.id);
  }
}

export {
  RaiseTogetherManager
};
