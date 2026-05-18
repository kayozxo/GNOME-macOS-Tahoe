import * as AltTab from "resource:///org/gnome/shell/ui/altTab.js";
import { St } from "../../gi/ext.js";
import MultipleWindowsIcon from "./MultipleWindowsIcon.js";
import { buildMargin, getWindows } from "../../utils/ui.js";
import Settings from "../../settings/settings.js";
const GAPS = 3;

class OverriddenAltTab {
  static _enabled = false;
  static _instance = null;
  static _old_show;
  // AltTab has these private fields
  _switcherList;
  _items;
  static get() {
    if (this._instance === null) this._instance = new OverriddenAltTab();
    return this._instance;
  }

  static enable() {
    if (this._enabled) return;
    const owm = this.get();
    OverriddenAltTab._old_show = AltTab.WindowSwitcherPopup.prototype.show;
    AltTab.WindowSwitcherPopup.prototype.show = owm.newShow;
    this._enabled = true;
  }

  static disable() {
    if (!this._enabled) return;
    AltTab.WindowSwitcherPopup.prototype.show = OverriddenAltTab._old_show;
    this._old_show = null;
    this._enabled = false;
  }

  static destroy() {
    this.disable();
    this._instance = null;
  }

  // the function will be treated as a method of class WindowMenu
  newShow(backward, binding, mask) {
    this._switcherList._list.get_layout_manager().homogeneous = false;
    this._switcherList._squareItems = false;
    const oldFunction = OverriddenAltTab._old_show?.bind(this);
    const res = !oldFunction || oldFunction(backward, binding, mask);
    const tiledWindows = this._getWindowList().filter((win) => win.assignedTile);
    if (tiledWindows.length <= 1) return res;
    const tiles = tiledWindows.map((win) => win.assignedTile).filter((tile) => tile !== void 0);
    const inner_gaps = Settings.get_inner_gaps();
    const height = this._items[0].height;
    const width = Math.floor(height * 16 / 9);
    const gaps = GAPS * St.ThemeContext.get_for_stage(global.stage).scale_factor;
    const groupWindowsIcon = new MultipleWindowsIcon({
      tiles,
      width,
      height,
      innerGaps: buildMargin({
        top: inner_gaps.top === 0 ? 0 : gaps,
        bottom: inner_gaps.bottom === 0 ? 0 : gaps,
        left: inner_gaps.left === 0 ? 0 : gaps,
        right: inner_gaps.right === 0 ? 0 : gaps
      }),
      windows: tiledWindows
    });
    this._switcherList.addItem(groupWindowsIcon, groupWindowsIcon.label);
    this._items.push(groupWindowsIcon);
    groupWindowsIcon.window.onAllWindowsUnmanaged(() => {
      this._switcherList._removeWindow(groupWindowsIcon.window);
    });
    return res;
  }

  _getWindowList() {
    return getWindows();
  }
}

export {
  OverriddenAltTab as default
};
