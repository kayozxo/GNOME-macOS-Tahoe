import { GObject, St, Clutter, Gio } from "../gi/ext.js";
import SignalHandling from "../utils/signalHandling.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
  enableScalingFactorSupport,
  getMonitors,
  getMonitorScalingFactor,
  getScalingFactorOf
} from "../utils/ui.js";
import Settings from "../settings/settings.js";
import GlobalState from "../utils/globalState.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import LayoutButton from "./layoutButton.js";
import { logger } from "../utils/logger.js";
import { registerGObjectClass } from "../utils/gjs.js";
import { _ } from "../translations.js";
import { widgetOrientation } from "../utils/gnomesupport.js";
import { createButton, createIconButton } from "./utils.js";
const debug = logger("DefaultMenu");
const _LayoutsRow = class _LayoutsRow extends St.BoxLayout {
  _layoutsBox;
  _layoutsButtons;
  _label;
  _monitor;
  constructor(parent, layouts, selectedId, showMonitorName, monitor) {
    super({
      xAlign: Clutter.ActorAlign.CENTER,
      yAlign: Clutter.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      style: "spacing: 8px",
      ...widgetOrientation(true)
    });
    this._layoutsBox = new St.BoxLayout({
      xAlign: Clutter.ActorAlign.CENTER,
      yAlign: Clutter.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      styleClass: "layouts-box-layout"
    });
    this._monitor = monitor;
    this._label = new St.Label({
      text: `Monitor ${this._monitor.index + 1}`,
      styleClass: "monitor-layouts-title"
    });
    this.add_child(this._label);
    if (!showMonitorName) this._label.hide();
    this.add_child(this._layoutsBox);
    parent.add_child(this);
    const selectedIndex = layouts.findIndex((lay) => lay.id === selectedId);
    const hasGaps = Settings.get_inner_gaps(1).top > 0;
    const layoutHeight = 36;
    const layoutWidth = 64;
    this._layoutsButtons = layouts.map((lay, ind) => {
      const btn = new LayoutButton(
        this._layoutsBox,
        lay,
        hasGaps ? 2 : 0,
        layoutHeight,
        layoutWidth
      );
      btn.connect(
        "clicked",
        () => !btn.checked && this.emit("selected-layout", lay.id)
      );
      if (ind === selectedIndex) btn.set_checked(true);
      return btn;
    });
  }

  selectLayout(selectedId) {
    const selectedIndex = GlobalState.get().layouts.findIndex(
      (lay) => lay.id === selectedId
    );
    this._layoutsButtons.forEach(
      (btn, ind) => btn.set_checked(ind === selectedIndex)
    );
  }

  updateMonitorName(showMonitorName, monitorsDetails) {
    if (!showMonitorName) this._label.hide();
    else this._label.show();
    debug(`updateMonitorName: monitor=${this._monitor.index}, x=${this._monitor.x}, y=${this._monitor.y}`);
    debug(`updateMonitorName: monitorsDetails=${JSON.stringify(monitorsDetails)}`);
    let details = monitorsDetails.find(
      (m) => m.index === this._monitor.index
    );
    if (details) {
      debug(`updateMonitorName: matched by index ${this._monitor.index}`);
    }
    if (!details) {
      details = monitorsDetails.find(
        (m) => m.x === this._monitor.x && m.y === this._monitor.y
      );
      if (details) {
        debug(`updateMonitorName: matched by coordinates (${this._monitor.x}, ${this._monitor.y})`);
      }
    }
    if (!details) {
      debug(`updateMonitorName: no match found for monitor ${this._monitor.index}`);
      return;
    }
    debug(`updateMonitorName: setting label to "${details.name}"`);
    this._label.set_text(details.name);
  }
};
registerGObjectClass(_LayoutsRow, {
  GTypeName: "LayoutsRow",
  Signals: {
    "selected-layout": {
      param_types: [GObject.TYPE_STRING]
    }
  }
});
let LayoutsRow = _LayoutsRow;

class DefaultMenu {
  _signals;
  _indicator;
  _layoutsRows;
  _container;
  _scalingFactor;
  _children;
  _openPrefsFn;
  constructor(indicator, enableScalingFactor, openPrefsFn) {
    this._indicator = indicator;
    this._signals = new SignalHandling();
    this._openPrefsFn = openPrefsFn;
    this._children = [];
    const layoutsPopupMenu = new PopupMenu.PopupBaseMenuItem({
      style_class: "indicator-menu-item"
    });
    this._children.push(layoutsPopupMenu);
    this._container = new St.BoxLayout({
      xAlign: Clutter.ActorAlign.CENTER,
      yAlign: Clutter.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      styleClass: "default-menu-container",
      ...widgetOrientation(true)
    });
    layoutsPopupMenu.add_child(this._container);
    this._indicator.menu.addMenuItem(
      layoutsPopupMenu
    );
    if (enableScalingFactor) {
      const monitor = Main.layoutManager.findMonitorForActor(
        this._container
      );
      const scalingFactor = getMonitorScalingFactor(
        monitor?.index || Main.layoutManager.primaryIndex
      );
      enableScalingFactorSupport(this._container, scalingFactor);
    }
    this._scalingFactor = getScalingFactorOf(this._container)[1];
    this._layoutsRows = [];
    this._drawLayouts();
    this._signals.connect(
      Settings,
      Settings.KEY_SETTING_LAYOUTS_JSON,
      () => {
        this._drawLayouts();
      }
    );
    this._signals.connect(Settings, Settings.KEY_INNER_GAPS, () => {
      this._drawLayouts();
    });
    this._signals.connect(
      Settings,
      Settings.KEY_SETTING_SELECTED_LAYOUTS,
      () => {
        this._updateScaling();
        if (this._layoutsRows.length !== getMonitors().length)
          this._drawLayouts();
        const selected_layouts = Settings.get_selected_layouts();
        const wsIndex = global.workspaceManager.get_active_workspace_index();
        getMonitors().forEach((m, index) => {
          const selectedId = wsIndex < selected_layouts.length ? selected_layouts[wsIndex][index] : GlobalState.get().layouts[0].id;
          this._layoutsRows[index].selectLayout(selectedId);
        });
      }
    );
    this._signals.connect(
      global.workspaceManager,
      "active-workspace-changed",
      () => {
        const selected_layouts = Settings.get_selected_layouts();
        const wsIndex = global.workspaceManager.get_active_workspace_index();
        getMonitors().forEach((m, index) => {
          const selectedId = wsIndex < selected_layouts.length ? selected_layouts[wsIndex][index] : GlobalState.get().layouts[0].id;
          this._layoutsRows[index].selectLayout(selectedId);
        });
      }
    );
    this._signals.connect(Main.layoutManager, "monitors-changed", () => {
      if (!enableScalingFactor) return;
      const monitor = Main.layoutManager.findMonitorForActor(
        this._container
      );
      const scalingFactor = getMonitorScalingFactor(
        monitor?.index || Main.layoutManager.primaryIndex
      );
      enableScalingFactorSupport(this._container, scalingFactor);
      this._updateScaling();
      if (this._layoutsRows.length !== getMonitors().length)
        this._drawLayouts();
      this._computeMonitorsDetails();
    });
    this._computeMonitorsDetails();
    const buttonsPopupMenu = this._buildEditingButtonsRow();
    this._indicator.menu.addMenuItem(
      buttonsPopupMenu
    );
    this._children.push(buttonsPopupMenu);
  }

  // compute monitors details and update labels asynchronously (if we have successful results...)
  _computeMonitorsDetails() {
    if (getMonitors().length === 1) {
      this._layoutsRows.forEach((lr) => lr.updateMonitorName(false, []));
      return;
    }
    const monitorsDetails = this._get_display_name();
    if (monitorsDetails) {
      this._layoutsRows.forEach(
        (lr) => lr.updateMonitorName(true, monitorsDetails)
      );
      return;
    }
    try {
      const proc = Gio.Subprocess.new(
        ["gjs", "-m", `${this._indicator.path}/monitorDescription.js`],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
      );
      proc.communicate_utf8_async(
        null,
        null,
        (pr, res) => {
          if (!pr) return;
          const [, stdout, stderr] = pr.communicate_utf8_finish(res);
          if (pr.get_successful()) {
            debug(stdout);
            const parsedMonitorsDetails = JSON.parse(stdout);
            this._layoutsRows.forEach(
              (lr) => lr.updateMonitorName(true, parsedMonitorsDetails)
            );
          } else {
            debug("error:", stderr);
          }
        }
      );
    } catch (e) {
      debug(e);
    }
  }

  // Use GNOME 49+'s Meta.Monitor with get_display_name()
  _get_display_name() {
    const monitorManager = global.backend.get_monitor_manager();
    if (!monitorManager.get_logical_monitors) return void 0;
    const logicalMonitors = monitorManager.get_logical_monitors();
    if (!logicalMonitors || logicalMonitors.length <= 0) return void 0;
    const monitorsDetails = [];
    logicalMonitors.forEach((logicalMonitor) => {
      const metaMonitors = logicalMonitor.get_monitors();
      if (metaMonitors.length <= 0) return;
      const metaMonitor = metaMonitors[0];
      if (!metaMonitor.get_display_name) return;
      const x = logicalMonitor.x ?? 0;
      const y = logicalMonitor.y ?? 0;
      monitorsDetails.push({
        name: metaMonitor.get_display_name(),
        index: logicalMonitor.get_number(),
        x,
        y
      });
    });
    return monitorsDetails;
  }

  _updateScaling() {
    const newScalingFactor = getScalingFactorOf(this._container)[1];
    if (this._scalingFactor === newScalingFactor) return;
    this._scalingFactor = newScalingFactor;
    this._drawLayouts();
  }

  _buildEditingButtonsRow() {
    const buttonsBoxLayout = new St.BoxLayout({
      xAlign: Clutter.ActorAlign.CENTER,
      yAlign: Clutter.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      styleClass: "buttons-box-layout"
    });
    const editLayoutsBtn = createButton(
      "edit-symbolic",
      `${_("Edit Layouts")}...`,
      this._indicator.path
    );
    editLayoutsBtn.connect(
      "clicked",
      () => this._indicator.openLayoutEditor()
    );
    buttonsBoxLayout.add_child(editLayoutsBtn);
    const newLayoutBtn = createButton(
      "add-symbolic",
      `${_("New Layout")}...`,
      this._indicator.path
    );
    newLayoutBtn.connect(
      "clicked",
      () => this._indicator.newLayoutOnClick(true)
    );
    buttonsBoxLayout.add_child(newLayoutBtn);
    const prefsBtn = createIconButton(
      "prefs-symbolic",
      this._indicator.path
    );
    prefsBtn.connect("clicked", () => {
      this._openPrefsFn();
      this._indicator.menu.toggle();
    });
    buttonsBoxLayout.add_child(prefsBtn);
    const buttonsPopupMenu = new PopupMenu.PopupBaseMenuItem({
      style_class: "indicator-menu-item"
    });
    buttonsPopupMenu.add_child(buttonsBoxLayout);
    return buttonsPopupMenu;
  }

  _drawLayouts() {
    const layouts = GlobalState.get().layouts;
    this._container.destroy_all_children();
    this._layoutsRows = [];
    const selected_layouts = Settings.get_selected_layouts();
    const ws_index = global.workspaceManager.get_active_workspace_index();
    const monitors = getMonitors();
    this._layoutsRows = monitors.map((monitor) => {
      const ws_selected_layouts = ws_index < selected_layouts.length ? selected_layouts[ws_index] : [];
      const selectedId = monitor.index < ws_selected_layouts.length ? ws_selected_layouts[monitor.index] : GlobalState.get().layouts[0].id;
      const row = new LayoutsRow(
        this._container,
        layouts,
        selectedId,
        monitors.length > 1,
        monitor
      );
      row.connect(
        "selected-layout",
        (r, layoutId) => {
          this._indicator.selectLayoutOnClick(
            monitor.index,
            layoutId
          );
        }
      );
      return row;
    });
  }

  destroy() {
    this._signals.disconnect();
    this._layoutsRows.forEach((lr) => lr.destroy());
    this._layoutsRows = [];
    this._children.forEach((c) => c.destroy());
    this._children = [];
  }
}

export {
  DefaultMenu as default
};
