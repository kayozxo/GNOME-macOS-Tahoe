const node = `<node>
    <interface name="org.gnome.Shell.Extensions.TilingShell">
        <method name="openLayoutEditor" />
    </interface>
</node>`;
import { Gio } from "./gi/ext.js";

class DBus {
  _dbus;
  constructor() {
    this._dbus = null;
  }

  enable(ext) {
    if (this._dbus) return;
    this._dbus = Gio.DBusExportedObject.wrapJSObject(node, ext);
    this._dbus.export(
      Gio.DBus.session,
      "/org/gnome/Shell/Extensions/TilingShell"
    );
  }

  disable() {
    this._dbus?.flush();
    this._dbus?.unexport();
    this._dbus = null;
  }
}

export {
  DBus as default
};
