import Settings from "../../settings/settings.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import { St, Clutter, Gio } from "../../gi/ext.js";
import LayoutButton from "../../indicator/layoutButton.js";
import GlobalState from "../../utils/globalState.js";
import Layout from "../../components/layout/Layout.js";
import Tile from "../../components/layout/Tile.js";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
  enableScalingFactorSupport,
  getMonitorScalingFactor
} from "../../utils/ui.js";
import { _ } from "../../translations.js";
import { widgetOrientation } from "../../utils/gnomesupport.js";
const _EditorDialog = class _EditorDialog extends ModalDialog.ModalDialog {
  _layoutHeight = 72;
  _layoutWidth = 128;
  // 16:9 ratio. -> (16*layoutHeight) / 9 and then rounded to int
  _gapsSize = 3;
  _layoutsBoxLayout;
  constructor(params) {
    super({
      destroyOnClose: true,
      styleClass: "editor-dialog"
    });
    if (params.enableScaling) {
      const monitor = Main.layoutManager.findMonitorForActor(this);
      const scalingFactor = getMonitorScalingFactor(
        monitor?.index || Main.layoutManager.primaryIndex
      );
      enableScalingFactorSupport(this, scalingFactor);
    }
    this.contentLayout.add_child(
      new St.Label({
        text: _("Select the layout to edit"),
        xAlign: Clutter.ActorAlign.CENTER,
        xExpand: true,
        styleClass: "editor-dialog-title"
      })
    );
    this._layoutsBoxLayout = new St.BoxLayout({
      styleClass: "layouts-box-layout",
      xAlign: Clutter.ActorAlign.CENTER
    });
    this.contentLayout.add_child(this._layoutsBoxLayout);
    if (!params.legend) {
      this._drawLayouts({
        layouts: GlobalState.get().layouts,
        ...params
      });
    }
    this.addButton({
      label: _("Close"),
      default: true,
      key: Clutter.KEY_Escape,
      action: () => params.onClose()
    });
    if (params.legend) {
      this._makeLegendDialog({
        onClose: params.onClose,
        path: params.path
      });
    }
  }

  _makeLegendDialog(params) {
    const suggestion1 = new St.BoxLayout();
    suggestion1.add_child(
      new St.Label({
        text: "LEFT CLICK",
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion1.add_child(
      new St.Label({
        text: ` ${_("to split a tile")}.`,
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const suggestion2 = new St.BoxLayout();
    suggestion2.add_child(
      new St.Label({
        text: "LEFT CLICK",
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion2.add_child(
      new St.Label({
        text: " + ",
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    suggestion2.add_child(
      new St.Label({
        text: "CTRL",
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion2.add_child(
      new St.Label({
        text: ` ${_("to split a tile vertically")}.`,
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const suggestion3 = new St.BoxLayout();
    suggestion3.add_child(
      new St.Label({
        text: "RIGHT CLICK",
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion3.add_child(
      new St.Label({
        text: ` ${_("to delete a tile")}.`,
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const suggestion4 = new St.BoxLayout({
      xExpand: true,
      margin_top: 16
    });
    suggestion4.add_child(
      new St.Icon({
        iconSize: 16,
        yAlign: Clutter.ActorAlign.CENTER,
        gicon: Gio.icon_new_for_string(
          `${params.path}/icons/indicator-symbolic.svg`
        ),
        styleClass: "button kbd",
        pseudoClass: "active"
      })
    );
    suggestion4.add_child(
      new St.Label({
        text: ` ${_("use the indicator button to save or cancel")}.`,
        xAlign: Clutter.ActorAlign.CENTER,
        yAlign: Clutter.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const legend = new St.BoxLayout({
      styleClass: "legend",
      ...widgetOrientation(true)
    });
    legend.add_child(suggestion1);
    legend.add_child(suggestion2);
    legend.add_child(suggestion3);
    legend.add_child(suggestion4);
    this.contentLayout.destroy_all_children();
    this.contentLayout.add_child(
      new St.Label({
        text: _("How to use the editor"),
        xAlign: Clutter.ActorAlign.CENTER,
        xExpand: true,
        styleClass: "editor-dialog-title"
      })
    );
    this.contentLayout.add_child(legend);
    this.clearButtons();
    this.addButton({
      label: _("Start editing"),
      default: true,
      key: Clutter.KEY_Escape,
      action: params.onClose
    });
  }

  _drawLayouts(params) {
    const gaps = Settings.get_inner_gaps(1).top > 0 ? this._gapsSize : 0;
    this._layoutsBoxLayout.destroy_all_children();
    params.layouts.forEach((lay, btnInd) => {
      const layoutBox = new St.BoxLayout({
        xAlign: Clutter.ActorAlign.CENTER,
        styleClass: "layout-button-container",
        ...widgetOrientation(true)
      });
      this._layoutsBoxLayout.add_child(layoutBox);
      const btn = new LayoutButton(
        layoutBox,
        lay,
        gaps,
        this._layoutHeight,
        this._layoutWidth
      );
      const moveAndDeleteButtonsBox = new St.BoxLayout({
        xAlign: Clutter.ActorAlign.CENTER,
        //styleClass: 'layout-button-container',
        ...widgetOrientation(false)
      });
      layoutBox.add_child(moveAndDeleteButtonsBox);
      if (params.layouts.length > 1) {
        if (btnInd >= 1) {
          const moveLeftBtn = new St.Button({
            xExpand: false,
            xAlign: Clutter.ActorAlign.CENTER,
            styleClass: "message-list-clear-button icon-button button delete-layout-button"
          });
          moveLeftBtn.child = new St.Icon({
            gicon: Gio.icon_new_for_string(
              `${params.path}/icons/chevron-left-symbolic.svg`
            ),
            iconSize: 16
          });
          moveLeftBtn.connect("clicked", () => {
            params.onReorderLayout(btnInd, btnInd - 1);
            this._drawLayouts({
              ...params,
              layouts: GlobalState.get().layouts
            });
          });
          moveAndDeleteButtonsBox.add_child(moveLeftBtn);
        }
        const deleteBtn = new St.Button({
          xExpand: false,
          xAlign: Clutter.ActorAlign.CENTER,
          styleClass: "message-list-clear-button icon-button button delete-layout-button"
        });
        deleteBtn.child = new St.Icon({
          gicon: Gio.icon_new_for_string(
            `${params.path}/icons/delete-symbolic.svg`
          ),
          iconSize: 16
        });
        deleteBtn.connect("clicked", () => {
          params.onDeleteLayout(btnInd, lay);
          this._drawLayouts({
            ...params,
            layouts: GlobalState.get().layouts
          });
        });
        moveAndDeleteButtonsBox.add_child(deleteBtn);
        if (btnInd + 1 < params.layouts.length) {
          const moveRightBtn = new St.Button({
            xExpand: false,
            xAlign: Clutter.ActorAlign.CENTER,
            styleClass: "message-list-clear-button icon-button button delete-layout-button"
          });
          moveRightBtn.child = new St.Icon({
            gicon: Gio.icon_new_for_string(
              `${params.path}/icons/chevron-right-symbolic.svg`
            ),
            iconSize: 16
          });
          moveRightBtn.connect("clicked", () => {
            params.onReorderLayout(btnInd, btnInd + 1);
            this._drawLayouts({
              ...params,
              layouts: GlobalState.get().layouts
            });
          });
          moveAndDeleteButtonsBox.add_child(moveRightBtn);
        }
      }
      btn.connect("clicked", () => {
        params.onSelectLayout(btnInd, lay);
        this._makeLegendDialog({
          onClose: params.onClose,
          path: params.path
        });
      });
      return btn;
    });
    const box = new St.BoxLayout({
      xAlign: Clutter.ActorAlign.CENTER,
      styleClass: "layout-button-container",
      ...widgetOrientation(true)
    });
    this._layoutsBoxLayout.add_child(box);
    const newLayoutBtn = new LayoutButton(
      box,
      new Layout(
        [new Tile({ x: 0, y: 0, width: 1, height: 1, groups: [] })],
        "New Layout"
      ),
      gaps,
      this._layoutHeight,
      this._layoutWidth
    );
    const icon = new St.Icon({
      gicon: Gio.icon_new_for_string(
        `${params.path}/icons/add-symbolic.svg`
      ),
      iconSize: 32
    });
    icon.set_size(newLayoutBtn.child.width, newLayoutBtn.child.height);
    newLayoutBtn.child.add_child(icon);
    newLayoutBtn.connect("clicked", () => {
      params.onNewLayout();
      this._makeLegendDialog({
        onClose: params.onClose,
        path: params.path
      });
    });
  }
};
registerGObjectClass(_EditorDialog);
let EditorDialog = _EditorDialog;
export {
  EditorDialog as default
};
