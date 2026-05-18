import { St } from "../gi/ext.js";
import { createButton } from "./utils.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { _ } from "../translations.js";
import { widgetOrientation } from "../utils/gnomesupport.js";

class EditingMenu {
  _indicator;
  constructor(indicator) {
    this._indicator = indicator;
    const boxLayout = new St.BoxLayout({
      styleClass: "buttons-box-layout",
      xExpand: true,
      style: "spacing: 8px",
      ...widgetOrientation(true)
    });
    const openMenuBtn = createButton(
      "menu-symbolic",
      _("Menu"),
      this._indicator.path
    );
    openMenuBtn.connect("clicked", () => this._indicator.openMenu(false));
    boxLayout.add_child(openMenuBtn);
    const infoMenuBtn = createButton(
      "info-symbolic",
      _("Info"),
      this._indicator.path
    );
    infoMenuBtn.connect("clicked", () => this._indicator.openMenu(true));
    boxLayout.add_child(infoMenuBtn);
    const saveBtn = createButton(
      "save-symbolic",
      _("Save"),
      this._indicator.path
    );
    saveBtn.connect("clicked", () => {
      this._indicator.menu.toggle();
      this._indicator.saveLayoutOnClick();
    });
    boxLayout.add_child(saveBtn);
    const cancelBtn = createButton(
      "cancel-symbolic",
      _("Cancel"),
      this._indicator.path
    );
    cancelBtn.connect("clicked", () => {
      this._indicator.menu.toggle();
      this._indicator.cancelLayoutOnClick();
    });
    boxLayout.add_child(cancelBtn);
    const menuItem = new PopupMenu.PopupBaseMenuItem({
      style_class: "indicator-menu-item"
    });
    menuItem.add_child(boxLayout);
    this._indicator.menu.addMenuItem(menuItem);
  }

  destroy() {
    this._indicator.menu.removeAll();
  }
}

export {
  EditingMenu as default
};
