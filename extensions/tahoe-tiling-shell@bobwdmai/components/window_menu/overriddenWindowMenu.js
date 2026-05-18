var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import * as windowMenu from "resource:///org/gnome/shell/ui/windowMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { GObject, St, Clutter, Meta } from "../../gi/ext.js";
import GlobalState from "../../utils/globalState.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import Tile from "../../components/layout/Tile.js";
import {
  enableScalingFactorSupport,
  getMonitorScalingFactor,
  getWindows
} from "../../utils/ui.js";
import TileUtils from "../../components/layout/TileUtils.js";
import LayoutTileButtons from "./layoutTileButtons.js";
import { buildMarginOf } from "../../utils/ui.js";
import LayoutIcon from "./layoutIcon.js";
import { _ } from "../../translations.js";
import { widgetOrientation } from "../../utils/gnomesupport.js";
const LAYOUT_ICON_WIDTH = 46;
const LAYOUT_ICON_HEIGHT = 32;
const INNER_GAPS = 2;

function buildMenuWithLayoutIcon(title, popupMenu, importantTiles, tiles, innerGaps) {
  popupMenu.add_child(
    new St.Label({
      text: title,
      yAlign: Clutter.ActorAlign.CENTER,
      xExpand: true
    })
  );
  const layoutIcon = new LayoutIcon(
    popupMenu,
    importantTiles,
    tiles,
    buildMarginOf(innerGaps),
    buildMarginOf(4),
    LAYOUT_ICON_WIDTH,
    LAYOUT_ICON_HEIGHT
  );
  layoutIcon.set_x_align(Clutter.ActorAlign.END);
}
const _OverriddenWindowMenu = class _OverriddenWindowMenu extends GObject.Object {
  static get() {
    if (this._instance === null)
      this._instance = new _OverriddenWindowMenu();
    return this._instance;
  }

  static enable() {
    if (this._enabled) return;
    const owm = this.get();
    _OverriddenWindowMenu._old_buildMenu = windowMenu.WindowMenu.prototype._buildMenu;
    windowMenu.WindowMenu.prototype._buildMenu = owm.newBuildMenu;
    this._enabled = true;
  }

  static disable() {
    if (!this._enabled) return;
    windowMenu.WindowMenu.prototype._buildMenu = _OverriddenWindowMenu._old_buildMenu;
    this._old_buildMenu = null;
    this._enabled = false;
  }

  static destroy() {
    this.disable();
    this._instance = null;
  }

  // the function will be treated as a method of class WindowMenu
  newBuildMenu(window) {
    const oldFunction = _OverriddenWindowMenu._old_buildMenu?.bind(this);
    if (oldFunction) oldFunction(window);
    const layouts = GlobalState.get().layouts;
    if (layouts.length === 0) return;
    const workArea = Main.layoutManager.getWorkAreaForMonitor(
      window.get_monitor()
    );
    const tiledWindows = getWindows().map((otherWindow) => {
      return otherWindow && !otherWindow.minimized && otherWindow.assignedTile ? otherWindow : void 0;
    }).filter((w) => w !== void 0);
    const tiles = GlobalState.get().getSelectedLayoutOfMonitor(
      window.get_monitor(),
      global.workspaceManager.get_active_workspace_index()
    ).tiles;
    const vacantTiles = tiles.filter((t) => {
      const tileRect = TileUtils.apply_props(t, workArea);
      return !tiledWindows.find(
        (win) => tileRect.overlap(win.get_frame_rect())
      );
    });
    const enableScaling = window.get_monitor() === Main.layoutManager.primaryIndex;
    const scalingFactor = getMonitorScalingFactor(window.get_monitor());
    if (vacantTiles.length > 0) {
      vacantTiles.sort((a, b) => a.x - b.x);
      let bestTileIndex = 0;
      let bestDistance = Math.abs(
        0.5 - vacantTiles[bestTileIndex].x + vacantTiles[bestTileIndex].width / 2
      );
      for (let index = 1; index < vacantTiles.length; index++) {
        const distance = Math.abs(
          0.5 - (vacantTiles[index].x + vacantTiles[index].width / 2)
        );
        if (bestDistance > distance) {
          bestTileIndex = index;
          bestDistance = distance;
        }
      }
      this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const vacantPopupMenu = new PopupMenu.PopupBaseMenuItem();
      this.addMenuItem(vacantPopupMenu);
      if (enableScaling)
        enableScalingFactorSupport(vacantPopupMenu, scalingFactor);
      buildMenuWithLayoutIcon(
        _("Move to best tile"),
        vacantPopupMenu,
        [vacantTiles[bestTileIndex]],
        tiles,
        INNER_GAPS
      );
      vacantPopupMenu.connect("activate", () => {
        _OverriddenWindowMenu.get().emit(
          "tile-clicked",
          vacantTiles[bestTileIndex],
          window
        );
      });
    }
    if (vacantTiles.length > 1) {
      const vacantLeftPopupMenu = new PopupMenu.PopupBaseMenuItem();
      this.addMenuItem(vacantLeftPopupMenu);
      if (enableScaling)
        enableScalingFactorSupport(vacantLeftPopupMenu, scalingFactor);
      buildMenuWithLayoutIcon(
        _("Move to leftmost tile"),
        vacantLeftPopupMenu,
        [vacantTiles[0]],
        tiles,
        INNER_GAPS
      );
      vacantLeftPopupMenu.connect("activate", () => {
        _OverriddenWindowMenu.get().emit(
          "tile-clicked",
          vacantTiles[0],
          window
        );
      });
      const tilesFromRightToLeft = vacantTiles.slice(0).sort((a, b) => b.x === a.x ? a.y - b.y : b.x - a.x);
      const vacantRightPopupMenu = new PopupMenu.PopupBaseMenuItem();
      this.addMenuItem(vacantRightPopupMenu);
      if (enableScaling)
        enableScalingFactorSupport(vacantRightPopupMenu, scalingFactor);
      buildMenuWithLayoutIcon(
        _("Move to rightmost tile"),
        vacantRightPopupMenu,
        [tilesFromRightToLeft[0]],
        tiles,
        INNER_GAPS
      );
      vacantRightPopupMenu.connect("activate", () => {
        _OverriddenWindowMenu.get().emit(
          "tile-clicked",
          tilesFromRightToLeft[0],
          window
        );
      });
    }
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    const layoutsPopupMenu = new PopupMenu.PopupBaseMenuItem();
    this.addMenuItem(layoutsPopupMenu);
    const container = new St.BoxLayout({
      xAlign: Clutter.ActorAlign.START,
      yAlign: Clutter.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      style: "spacing: 16px !important",
      ...widgetOrientation(true)
    });
    layoutsPopupMenu.add_child(container);
    const layoutsPerRow = 4;
    const rows = [];
    for (let index = 0; index < layouts.length; index += layoutsPerRow) {
      const box = new St.BoxLayout({
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        xExpand: true,
        yExpand: true,
        style: "spacing: 6px;"
      });
      rows.push(box);
      container.add_child(box);
    }
    if (enableScaling)
      enableScalingFactorSupport(layoutsPopupMenu, scalingFactor);
    const layoutHeight = 30;
    const layoutWidth = 52;
    layouts.forEach((lay, ind) => {
      const row = rows[Math.floor(ind / layoutsPerRow)];
      const layoutWidget = new LayoutTileButtons(
        row,
        lay,
        INNER_GAPS,
        layoutHeight,
        layoutWidth
      );
      layoutWidget.set_x_align(Clutter.ActorAlign.END);
      layoutWidget.buttons.forEach((btn) => {
        btn.connect("clicked", () => {
          _OverriddenWindowMenu.get().emit(
            "tile-clicked",
            btn.tile,
            window
          );
          layoutsPopupMenu.activate(Clutter.get_current_event());
        });
      });
    });
  }

  static connect(key, func) {
    return this.get().connect(key, func) || -1;
  }

  static disconnect(id) {
    this.get().disconnect(id);
  }
};
registerGObjectClass(_OverriddenWindowMenu, {
  GTypeName: "OverriddenWindowMenu",
  Signals: {
    "tile-clicked": {
      param_types: [Tile.$gtype, Meta.Window.$gtype]
    }
  }
});
__publicField(_OverriddenWindowMenu, "_instance", null);
__publicField(_OverriddenWindowMenu, "_old_buildMenu");
__publicField(_OverriddenWindowMenu, "_enabled", false);
let OverriddenWindowMenu = _OverriddenWindowMenu;
export {
  buildMenuWithLayoutIcon,
  OverriddenWindowMenu as default
};
