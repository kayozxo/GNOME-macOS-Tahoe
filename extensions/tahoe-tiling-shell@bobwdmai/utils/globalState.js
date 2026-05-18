var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { registerGObjectClass } from "../utils/gjs.js";
import Settings from "../settings/settings.js";
import SignalHandling from "./signalHandling.js";
import { GObject, Gio } from "../gi/ext.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { logger } from "./logger.js";
import { getWindows } from "./ui.js";
const debug = logger("GlobalState");
const _GlobalState = class _GlobalState extends GObject.Object {
  _signals;
  _layouts;
  _tilePreviewAnimationTime;
  // if workspaces are reordered, we use this map to know which layouts where selected
  // to each workspace and we save the new ordering in the settings
  _selected_layouts;
  // used to handle reordering of workspaces
  static get() {
    if (!this._instance) this._instance = new _GlobalState();
    return this._instance;
  }

  static destroy() {
    if (this._instance) {
      this._instance._signals.disconnect();
      this._instance._layouts = [];
      this._instance = null;
    }
  }

  constructor() {
    super();
    this._signals = new SignalHandling();
    this._layouts = Settings.get_layouts_json();
    this._tilePreviewAnimationTime = 100;
    this._selected_layouts = /* @__PURE__ */ new Map();
    this.validate_selected_layouts();
    Settings.bind(
      Settings.KEY_TILE_PREVIEW_ANIMATION_TIME,
      this,
      "tilePreviewAnimationTime",
      Gio.SettingsBindFlags.GET
    );
    this._signals.connect(
      Settings,
      Settings.KEY_SETTING_LAYOUTS_JSON,
      () => {
        this._layouts = Settings.get_layouts_json();
        this.emit(_GlobalState.SIGNAL_LAYOUTS_CHANGED);
      }
    );
    this._signals.connect(
      Settings,
      Settings.KEY_SETTING_SELECTED_LAYOUTS,
      () => {
        const selected_layouts = Settings.get_selected_layouts();
        if (selected_layouts.length === 0) {
          this.validate_selected_layouts();
          return;
        }
        const defaultLayout = this._layouts[0];
        const n_monitors = Main.layoutManager.monitors.length;
        const n_workspaces = global.workspaceManager.get_n_workspaces();
        for (let i = 0; i < n_workspaces; i++) {
          const ws = global.workspaceManager.get_workspace_by_index(i);
          if (!ws) continue;
          const monitors_layouts = i < selected_layouts.length ? selected_layouts[i] : [defaultLayout.id];
          while (monitors_layouts.length < n_monitors)
            monitors_layouts.push(defaultLayout.id);
          while (monitors_layouts.length > n_monitors)
            monitors_layouts.pop();
          this._selected_layouts.set(ws, monitors_layouts);
        }
      }
    );
    this._signals.connect(
      global.workspaceManager,
      "workspace-added",
      (_, index) => {
        const n_workspaces = global.workspaceManager.get_n_workspaces();
        const newWs = global.workspaceManager.get_workspace_by_index(index);
        if (!newWs) return;
        debug(`added workspace ${index}`);
        const secondLastWs = global.workspaceManager.get_workspace_by_index(
          n_workspaces - 2
        );
        const secondLastWsLayoutsId = secondLastWs ? this._selected_layouts.get(secondLastWs) ?? [] : [];
        if (secondLastWsLayoutsId.length === 0) {
          secondLastWsLayoutsId.push(
            ...Main.layoutManager.monitors.map(
              () => this._layouts[0].id
            )
          );
        }
        this._selected_layouts.set(
          newWs,
          secondLastWsLayoutsId
          // Main.layoutManager.monitors.map(() => layout.id),
        );
        const to_be_saved = [];
        for (let i = 0; i < n_workspaces; i++) {
          const ws = global.workspaceManager.get_workspace_by_index(i);
          if (!ws) continue;
          const monitors_layouts = this._selected_layouts.get(ws);
          if (!monitors_layouts) continue;
          to_be_saved.push(monitors_layouts);
        }
        Settings.save_selected_layouts(to_be_saved);
      }
    );
    this._signals.connect(
      global.workspaceManager,
      "workspace-removed",
      () => {
        const newMap = /* @__PURE__ */ new Map();
        const n_workspaces = global.workspaceManager.get_n_workspaces();
        const to_be_saved = [];
        for (let i = 0; i < n_workspaces; i++) {
          const ws = global.workspaceManager.get_workspace_by_index(i);
          if (!ws) continue;
          const monitors_layouts = this._selected_layouts.get(ws);
          if (!monitors_layouts) continue;
          this._selected_layouts.delete(ws);
          newMap.set(ws, monitors_layouts);
          to_be_saved.push(monitors_layouts);
        }
        Settings.save_selected_layouts(to_be_saved);
        this._selected_layouts.clear();
        this._selected_layouts = newMap;
        debug("deleted workspace");
      }
    );
    this._signals.connect(
      global.workspaceManager,
      "workspaces-reordered",
      () => {
        this._save_selected_layouts();
        debug("reordered workspaces");
      }
    );
  }

  validate_selected_layouts() {
    const n_monitors = Main.layoutManager.monitors.length;
    const old_selected_layouts = Settings.get_selected_layouts();
    for (let i = 0; i < global.workspaceManager.get_n_workspaces(); i++) {
      const ws = global.workspaceManager.get_workspace_by_index(i);
      if (!ws) continue;
      const monitors_layouts = i < old_selected_layouts.length ? old_selected_layouts[i] : [];
      while (monitors_layouts.length < n_monitors)
        monitors_layouts.push(this._layouts[0].id);
      while (monitors_layouts.length > n_monitors) monitors_layouts.pop();
      monitors_layouts.forEach((_, ind) => {
        if (this._layouts.findIndex(
          (lay) => lay.id === monitors_layouts[ind]
        ) === -1)
          monitors_layouts[ind] = monitors_layouts[0];
      });
      this._selected_layouts.set(ws, monitors_layouts);
    }
    this._save_selected_layouts();
  }

  _save_selected_layouts() {
    const to_be_saved = [];
    const n_workspaces = global.workspaceManager.get_n_workspaces();
    for (let i = 0; i < n_workspaces; i++) {
      const ws = global.workspaceManager.get_workspace_by_index(i);
      if (!ws) continue;
      const monitors_layouts = this._selected_layouts.get(ws);
      if (!monitors_layouts) continue;
      to_be_saved.push(monitors_layouts);
    }
    Settings.save_selected_layouts(to_be_saved);
  }

  get layouts() {
    return this._layouts;
  }

  addLayout(newLay) {
    this._layouts.push(newLay);
    this.layouts = this._layouts;
  }

  deleteLayout(layoutToDelete) {
    const layFoundIndex = this._layouts.findIndex(
      (lay) => lay.id === layoutToDelete.id
    );
    if (layFoundIndex === -1) return;
    this._layouts.splice(layFoundIndex, 1);
    this.layouts = this._layouts;
    this._selected_layouts.forEach((monitors_selected) => {
      if (layoutToDelete.id === monitors_selected[Main.layoutManager.primaryIndex]) {
        monitors_selected[Main.layoutManager.primaryIndex] = this._layouts[0].id;
        this._save_selected_layouts();
      }
    });
  }

  editLayout(newLay) {
    const layFoundIndex = this._layouts.findIndex(
      (lay) => lay.id === newLay.id
    );
    if (layFoundIndex === -1) return;
    this._layouts[layFoundIndex] = newLay;
    this.layouts = this._layouts;
  }

  swapLayouts(first, second) {
    const tmp = this._layouts[first];
    this._layouts[first] = this._layouts[second];
    this._layouts[second] = tmp;
    this.layouts = this._layouts;
  }

  set layouts(layouts) {
    this._layouts = layouts;
    Settings.save_layouts_json(layouts);
    this.emit(_GlobalState.SIGNAL_LAYOUTS_CHANGED);
  }

  getSelectedLayoutOfMonitor(monitorIndex, workspaceIndex) {
    const selectedLayouts = Settings.get_selected_layouts();
    if (workspaceIndex < 0 || workspaceIndex >= selectedLayouts.length)
      workspaceIndex = 0;
    const monitors_selected = workspaceIndex < selectedLayouts.length ? selectedLayouts[workspaceIndex] : _GlobalState.get().layouts[0].id;
    if (monitorIndex < 0 || monitorIndex >= monitors_selected.length)
      monitorIndex = 0;
    return this._layouts.find(
      (lay) => lay.id === monitors_selected[monitorIndex]
    ) || this._layouts[0];
  }

  get tilePreviewAnimationTime() {
    return this._tilePreviewAnimationTime;
  }

  set tilePreviewAnimationTime(value) {
    this._tilePreviewAnimationTime = value;
  }

  setSelectedLayoutOfMonitor(layoutToSelectId, monitorIndex) {
    const selected = Settings.get_selected_layouts();
    selected[global.workspaceManager.get_active_workspace_index()][monitorIndex] = layoutToSelectId;
    const n_workspaces = global.workspaceManager.get_n_workspaces();
    if (global.workspaceManager.get_active_workspace_index() === n_workspaces - 2) {
      const lastWs = global.workspaceManager.get_workspace_by_index(
        n_workspaces - 1
      );
      if (!lastWs) return;
      const tiledWindows = getWindows(lastWs).find(
        (win) => win.assignedTile && win.get_monitor() === monitorIndex
      );
      if (!tiledWindows) {
        selected[lastWs.index()][monitorIndex] = layoutToSelectId;
      }
    }
    Settings.save_selected_layouts(selected);
  }
};
registerGObjectClass(_GlobalState, {
  GTypeName: "GlobalState",
  Signals: {
    "layouts-changed": {
      param_types: []
    }
  },
  Properties: {
    tilePreviewAnimationTime: GObject.ParamSpec.uint(
      "tilePreviewAnimationTime",
      "tilePreviewAnimationTime",
      "Animation time of tile previews in milliseconds",
      GObject.ParamFlags.READWRITE,
      0,
      2e3,
      100
    )
  }
});
__publicField(_GlobalState, "SIGNAL_LAYOUTS_CHANGED", "layouts-changed");
__publicField(_GlobalState, "_instance");
let GlobalState = _GlobalState;
export {
  GlobalState as default
};
