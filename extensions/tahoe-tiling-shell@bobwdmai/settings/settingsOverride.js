import Settings from "../settings/settings.js";
import { Gio, GLib } from "../gi/shared.js";

class SettingsOverride {
  // map schema_id with map of keys and old values
  _overriddenKeys;
  static _instance;
  constructor() {
    this._overriddenKeys = this._jsonToOverriddenKeys(
      Settings.OVERRIDDEN_SETTINGS
    );
  }

  static get() {
    if (!this._instance) this._instance = new SettingsOverride();
    return this._instance;
  }

  static destroy() {
    if (!this._instance) return;
    this._instance.restoreAll();
    this._instance = null;
  }

  /*
  json will have the following structure
  {
      "schema.id": {
          "overridden.key.one": oldvalue,
          "overridden.key.two": oldvalue
          ...
      },
      ...
  }
  */
  _overriddenKeysToJSON() {
    const obj = {};
    this._overriddenKeys.forEach((override, schemaId) => {
      obj[schemaId] = {};
      override.forEach((oldValue, key) => {
        obj[schemaId][key] = oldValue.print(true);
      });
    });
    return JSON.stringify(obj);
  }

  _jsonToOverriddenKeys(json) {
    const result = /* @__PURE__ */ new Map();
    const obj = JSON.parse(json);
    for (const schemaId in obj) {
      const schemaMap = /* @__PURE__ */ new Map();
      result.set(schemaId, schemaMap);
      const overrideObj = obj[schemaId];
      for (const key in overrideObj) {
        schemaMap.set(
          key,
          GLib.Variant.parse(null, overrideObj[key], null, null)
        );
      }
    }
    return result;
  }

  override(giosettings, keyToOverride, newValue) {
    const schemaId = giosettings.schemaId;
    const schemaMap = this._overriddenKeys.get(schemaId) || /* @__PURE__ */ new Map();
    if (!this._overriddenKeys.has(schemaId))
      this._overriddenKeys.set(schemaId, schemaMap);
    const oldValue = schemaMap.has(keyToOverride) ? schemaMap.get(keyToOverride) : giosettings.get_value(keyToOverride);
    const res = giosettings.set_value(keyToOverride, newValue);
    if (!res) return null;
    if (!schemaMap.has(keyToOverride)) {
      schemaMap.set(keyToOverride, oldValue);
      Settings.OVERRIDDEN_SETTINGS = this._overriddenKeysToJSON();
    }
    return oldValue;
  }

  restoreKey(giosettings, keyToOverride) {
    const overridden = this._overriddenKeys.get(giosettings.schemaId);
    if (!overridden) return null;
    const oldValue = overridden.get(keyToOverride);
    if (!oldValue) return null;
    const res = giosettings.set_value(keyToOverride, oldValue);
    if (res) {
      overridden.delete(keyToOverride);
      if (overridden.size === 0)
        this._overriddenKeys.delete(giosettings.schemaId);
      Settings.OVERRIDDEN_SETTINGS = this._overriddenKeysToJSON();
    }
    return oldValue;
  }

  restoreAll() {
    const schemaToDelete = [];
    this._overriddenKeys.forEach(
      (map, schemaId) => {
        const giosettings = new Gio.Settings({ schemaId });
        const overridden = this._overriddenKeys.get(
          giosettings.schemaId
        );
        if (!overridden) return;
        const toDelete = [];
        overridden.forEach((oldValue, key) => {
          const done = giosettings.set_value(key, oldValue);
          if (done) toDelete.push(key);
        });
        toDelete.forEach((key) => overridden.delete(key));
        if (overridden.size === 0) schemaToDelete.push(schemaId);
      }
    );
    schemaToDelete.forEach((schemaId) => {
      this._overriddenKeys.delete(schemaId);
    });
    if (this._overriddenKeys.size === 0) this._overriddenKeys = /* @__PURE__ */ new Map();
    Settings.OVERRIDDEN_SETTINGS = this._overriddenKeysToJSON();
  }
}

export {
  SettingsOverride as default
};
