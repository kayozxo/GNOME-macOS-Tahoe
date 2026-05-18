import LayoutButton from "../../indicator/layoutButton.js";
import GlobalState from "../../utils/globalState.js";
import Settings from "../../settings/settings.js";
import { St, Clutter } from "../../gi/ext.js";
import {
  enableScalingFactorSupport,
  getMonitorScalingFactor
} from "../../utils/ui.js";
import * as SwitcherPopup from "resource:///org/gnome/shell/ui/switcherPopup.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import { widgetOrientation } from "../../utils/gnomesupport.js";
const LAYOUT_HEIGHT = 72;
const LAYOUT_WIDTH = 128;
const GAPS = 3;
const _LayoutSwitcherList = class _LayoutSwitcherList extends SwitcherPopup.SwitcherList {
  // those are defined in the parent but we lack them in the type definition
  
  
  _buttons;
  constructor(items, parent, monitorScalingFactor) {
    super(false);
    this.add_style_class_name("layout-switcher-list");
    this._buttons = [];
    parent.add_child(this);
    enableScalingFactorSupport(this, monitorScalingFactor);
    items.forEach((lay) => this._addLayoutItem(lay));
    parent.remove_child(this);
  }

  _addLayoutItem(layout) {
    const box = new St.BoxLayout({
      style_class: "alt-tab-app",
      ...widgetOrientation(true)
    });
    this.addItem(box, new St.Widget());
    this._buttons.push(
      new LayoutButton(
        box,
        layout,
        Settings.get_inner_gaps(1).top > 0 ? GAPS : 0,
        LAYOUT_HEIGHT,
        LAYOUT_WIDTH
      )
    );
  }

  highlight(index, justOutline) {
    this._buttons[index].set_checked(true);
    super.highlight(index, justOutline);
    this._items[this._highlighted].remove_style_pseudo_class("outlined");
    this._items[this._highlighted].remove_style_pseudo_class("selected");
  }

  unhighlight(index) {
    this._buttons[index].set_checked(false);
  }
};
registerGObjectClass(_LayoutSwitcherList);
let LayoutSwitcherList = _LayoutSwitcherList;
const _LayoutSwitcherPopup = class _LayoutSwitcherPopup extends SwitcherPopup.SwitcherPopup {
  // those are defined in the parent but we lack them in the type definition
  
  
  
  _action;
  _backwardAction;
  constructor(action, backwardAction, enableScaling) {
    super(GlobalState.get().layouts);
    this._action = action;
    this._backwardAction = backwardAction;
    const monitorScalingFactor = enableScaling ? getMonitorScalingFactor(this._getCurrentMonitorIndex()) : void 0;
    this._switcherList = new LayoutSwitcherList(
      this._items,
      this,
      monitorScalingFactor
    );
  }

  _initialSelection(backward, _binding) {
    const selectedLay = GlobalState.get().getSelectedLayoutOfMonitor(
      this._getCurrentMonitorIndex(),
      global.workspaceManager.get_active_workspace_index()
    );
    this._selectedIndex = GlobalState.get().layouts.findIndex(
      (lay) => lay.id === selectedLay.id
    );
    if (backward) this._select(this._previous());
    else this._select(this._next());
  }

  _keyPressHandler(keysym, action) {
    if (keysym === Clutter.KEY_Left) this._select(this._previous());
    else if (keysym === Clutter.KEY_Right) this._select(this._next());
    else if (action === this._action) this._select(this._next());
    else if (action === this._backwardAction) this._select(this._previous());
    else return Clutter.EVENT_PROPAGATE;
    return Clutter.EVENT_STOP;
  }

  _select(num) {
    this._switcherList.unhighlight(this._selectedIndex);
    super._select(num);
  }

  _finish(timestamp) {
    super._finish(timestamp);
    GlobalState.get().setSelectedLayoutOfMonitor(
      this._items[this._selectedIndex].id,
      this._getCurrentMonitorIndex()
    );
  }

  _getCurrentMonitorIndex() {
    const focusWindow = global.display.focus_window;
    if (focusWindow) return focusWindow.get_monitor();
    return Main.layoutManager.primaryIndex;
  }
};
registerGObjectClass(_LayoutSwitcherPopup);
let LayoutSwitcherPopup = _LayoutSwitcherPopup;
export {
  LayoutSwitcherPopup
};
