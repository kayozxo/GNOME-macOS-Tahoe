import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

function openPrefs(ext) {
  if (Extension.openPrefs) {
    Extension.openPrefs();
  } else {
    ext.openPreferences();
  }
}
export {
  Extension,
  openPrefs
};
