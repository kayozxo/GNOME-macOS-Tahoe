import { Gio, GLib } from "../gi/shared.js";
import Layout from "../components/layout/Layout.js";
import Tile from "../components/layout/Tile.js";
var ActivationKey = /* @__PURE__ */ ((ActivationKey2) => {
  ActivationKey2[ActivationKey2["NONE"] = -1] = "NONE";
  ActivationKey2[ActivationKey2["CTRL"] = 0] = "CTRL";
  ActivationKey2[ActivationKey2["ALT"] = 1] = "ALT";
  ActivationKey2[ActivationKey2["SUPER"] = 2] = "SUPER";
  return ActivationKey2;
})(ActivationKey || {});
var EdgeTilingMode = /* @__PURE__ */ ((EdgeTilingMode2) => {
  EdgeTilingMode2["DEFAULT"] = "default";
  EdgeTilingMode2["ADAPTIVE"] = "adaptive";
  EdgeTilingMode2["GRANULAR"] = "granular";
  return EdgeTilingMode2;
})(EdgeTilingMode || {});

function get_string(key) {
  return Settings.gioSetting.get_string(key) ?? Settings.gioSetting.get_default_value(key)?.get_string()[0];
}

function set_string(key, val) {
  return Settings.gioSetting.set_string(key, val);
}

function get_boolean(key) {
  return Settings.gioSetting.get_boolean(key) ?? Settings.gioSetting.get_default_value(key)?.get_boolean();
}

function set_boolean(key, val) {
  return Settings.gioSetting.set_boolean(key, val);
}

function get_number(key) {
  return Settings.gioSetting.get_int(key) ?? Settings.gioSetting.get_default_value(key)?.get_int64();
}

function set_number(key, val) {
  return Settings.gioSetting.set_int(key, val);
}

function get_unsigned_number(key) {
  return Settings.gioSetting.get_uint(key) ?? Settings.gioSetting.get_default_value(key)?.get_uint64();
}

function set_unsigned_number(key, val) {
  return Settings.gioSetting.set_uint(key, val);
}

function get_activationkey(key, defaultValue) {
  let val = Settings.gioSetting.get_strv(key);
  if (!val || val.length === 0) {
    val = Settings.gioSetting.get_default_value(key)?.get_strv() ?? [
      String(defaultValue)
    ];
    if (val.length === 0) val = [String(defaultValue)];
  }
  return Number(val[0]);
}

function set_activationkey(key, val) {
  return Settings.gioSetting.set_strv(key, [String(val)]);
}

class Settings {
  static _settings;
  static _is_initialized = false;
  static KEY_LAST_VERSION_NAME_INSTALLED = "last-version-name-installed";
  static KEY_OVERRIDDEN_SETTINGS = "overridden-settings";
  static KEY_WINDOW_BORDER_COLOR = "window-border-color";
  static KEY_WINDOW_USE_CUSTOM_BORDER_COLOR = "window-use-custom-border-color";
  static KEY_TILING_SYSTEM = "enable-tiling-system";
  static KEY_SNAP_ASSIST = "enable-snap-assist";
  static KEY_SNAP_ASSIST_SYNC_LAYOUT = "snap-assist-sync-layout";
  static KEY_SHOW_INDICATOR = "show-indicator";
  static KEY_TILING_SYSTEM_ACTIVATION_KEY = "tiling-system-activation-key";
  static KEY_TILING_SYSTEM_DEACTIVATION_KEY = "tiling-system-deactivation-key";
  static KEY_SPAN_MULTIPLE_TILES_ACTIVATION_KEY = "span-multiple-tiles-activation-key";
  static KEY_SPAN_MULTIPLE_TILES = "enable-span-multiple-tiles";
  static KEY_RESTORE_WINDOW_ORIGINAL_SIZE = "restore-window-original-size";
  static KEY_WRAPAROUND_FOCUS = "enable-wraparound-focus";
  static KEY_ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY = "enable-directional-focus-tiled-only";
  static KEY_RESIZE_COMPLEMENTING_WINDOWS = "resize-complementing-windows";
  static KEY_ENABLE_BLUR_SNAP_ASSISTANT = "enable-blur-snap-assistant";
  static KEY_ENABLE_BLUR_SELECTED_TILEPREVIEW = "enable-blur-selected-tilepreview";
  static KEY_ENABLE_MOVE_KEYBINDINGS = "enable-move-keybindings";
  static KEY_ENABLE_AUTO_TILING = "enable-autotiling";
  static KEY_RAISE_TOGETHER = "raise-together";
  static KEY_ACTIVE_SCREEN_EDGES = "active-screen-edges";
  static KEY_TOP_EDGE_MAXIMIZE = "top-edge-maximize";
  static KEY_OVERRIDE_WINDOW_MENU = "override-window-menu";
  static KEY_OVERRIDE_ALT_TAB = "override-alt-tab";
  static KEY_SNAP_ASSISTANT_THRESHOLD = "snap-assistant-threshold";
  static KEY_ENABLE_WINDOW_BORDER = "enable-window-border";
  static KEY_INNER_GAPS = "inner-gaps";
  static KEY_OUTER_GAPS = "outer-gaps";
  static KEY_SNAP_ASSISTANT_ANIMATION_TIME = "snap-assistant-animation-time";
  static KEY_TILE_PREVIEW_ANIMATION_TIME = "tile-preview-animation-time";
  static KEY_SETTING_LAYOUTS_JSON = "layouts-json";
  static KEY_SETTING_SELECTED_LAYOUTS = "selected-layouts";
  static KEY_WINDOW_BORDER_WIDTH = "window-border-width";
  static KEY_ENABLE_SMART_WINDOW_BORDER_RADIUS = "enable-smart-window-border-radius";
  static KEY_QUARTER_TILING_THRESHOLD = "quarter-tiling-threshold";
  static KEY_EDGE_TILING_OFFSET = "edge-tiling-offset";
  static KEY_ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS = "enable-tiling-system-windows-suggestions";
  static KEY_ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS = "enable-snap-assistant-windows-suggestions";
  static KEY_ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS = "enable-screen-edges-windows-suggestions";
  static KEY_EDGE_TILING_MODE = "edge-tiling-mode";
  static SETTING_MOVE_WINDOW_RIGHT = "move-window-right";
  static SETTING_MOVE_WINDOW_LEFT = "move-window-left";
  static SETTING_MOVE_WINDOW_UP = "move-window-up";
  static SETTING_MOVE_WINDOW_DOWN = "move-window-down";
  static SETTING_SPAN_WINDOW_RIGHT = "span-window-right";
  static SETTING_SPAN_WINDOW_LEFT = "span-window-left";
  static SETTING_SPAN_WINDOW_UP = "span-window-up";
  static SETTING_SPAN_WINDOW_DOWN = "span-window-down";
  static SETTING_SPAN_WINDOW_ALL_TILES = "span-window-all-tiles";
  static SETTING_UNTILE_WINDOW = "untile-window";
  static SETTING_MOVE_WINDOW_CENTER = "move-window-center";
  static SETTING_FOCUS_WINDOW_RIGHT = "focus-window-right";
  static SETTING_FOCUS_WINDOW_LEFT = "focus-window-left";
  static SETTING_FOCUS_WINDOW_UP = "focus-window-up";
  static SETTING_FOCUS_WINDOW_DOWN = "focus-window-down";
  static SETTING_FOCUS_WINDOW_NEXT = "focus-window-next";
  static SETTING_FOCUS_WINDOW_PREV = "focus-window-prev";
  static SETTING_HIGHLIGHT_CURRENT_WINDOW = "highlight-current-window";
  static SETTING_CYCLE_LAYOUTS = "cycle-layouts";
  static SETTING_CYCLE_LAYOUTS_BACKWARD = "cycle-layouts-backward";
  static initialize(settings) {
    if (this._is_initialized) return;
    this._is_initialized = true;
    this._settings = settings;
  }

  static destroy() {
    if (this._is_initialized) {
      this._is_initialized = false;
      this._settings = null;
    }
  }

  static get gioSetting() {
    return this._settings ?? new Gio.Settings();
  }

  static bind(key, object, property, flags = Gio.SettingsBindFlags.DEFAULT) {
    this._settings?.bind(key, object, property, flags);
  }

  static get LAST_VERSION_NAME_INSTALLED() {
    return get_string(Settings.KEY_LAST_VERSION_NAME_INSTALLED);
  }

  static set LAST_VERSION_NAME_INSTALLED(val) {
    set_string(Settings.KEY_LAST_VERSION_NAME_INSTALLED, val);
  }

  static get OVERRIDDEN_SETTINGS() {
    return get_string(Settings.KEY_OVERRIDDEN_SETTINGS);
  }

  static set OVERRIDDEN_SETTINGS(val) {
    set_string(Settings.KEY_OVERRIDDEN_SETTINGS, val);
  }

  static get TILING_SYSTEM() {
    return get_boolean(Settings.KEY_TILING_SYSTEM);
  }

  static set TILING_SYSTEM(val) {
    set_boolean(Settings.KEY_TILING_SYSTEM, val);
  }

  static get SNAP_ASSIST() {
    return get_boolean(Settings.KEY_SNAP_ASSIST);
  }

  static set SNAP_ASSIST(val) {
    set_boolean(Settings.KEY_SNAP_ASSIST, val);
  }

  static get SNAP_ASSIST_SYNC_LAYOUT() {
    return get_boolean(Settings.KEY_SNAP_ASSIST_SYNC_LAYOUT);
  }

  static set SNAP_ASSIST_SYNC_LAYOUT(val) {
    set_boolean(Settings.KEY_SNAP_ASSIST_SYNC_LAYOUT, val);
  }

  static get SHOW_INDICATOR() {
    return get_boolean(Settings.KEY_SHOW_INDICATOR);
  }

  static set SHOW_INDICATOR(val) {
    set_boolean(Settings.KEY_SHOW_INDICATOR, val);
  }

  static get TILING_SYSTEM_ACTIVATION_KEY() {
    return get_activationkey(
      Settings.KEY_TILING_SYSTEM_ACTIVATION_KEY,
      0 /* CTRL */
    );
  }

  static set TILING_SYSTEM_ACTIVATION_KEY(val) {
    set_activationkey(Settings.KEY_TILING_SYSTEM_ACTIVATION_KEY, val);
  }

  static get TILING_SYSTEM_DEACTIVATION_KEY() {
    return get_activationkey(
      Settings.KEY_TILING_SYSTEM_DEACTIVATION_KEY,
      -1 /* NONE */
    );
  }

  static set TILING_SYSTEM_DEACTIVATION_KEY(val) {
    set_activationkey(Settings.KEY_TILING_SYSTEM_DEACTIVATION_KEY, val);
  }

  static get INNER_GAPS() {
    return get_unsigned_number(Settings.KEY_INNER_GAPS);
  }

  static set INNER_GAPS(val) {
    set_unsigned_number(Settings.KEY_INNER_GAPS, val);
  }

  static get OUTER_GAPS() {
    return get_unsigned_number(Settings.KEY_OUTER_GAPS);
  }

  static set OUTER_GAPS(val) {
    set_unsigned_number(Settings.KEY_OUTER_GAPS, val);
  }

  static get SPAN_MULTIPLE_TILES() {
    return get_boolean(Settings.KEY_SPAN_MULTIPLE_TILES);
  }

  static set SPAN_MULTIPLE_TILES(val) {
    set_boolean(Settings.KEY_SPAN_MULTIPLE_TILES, val);
  }

  static get SPAN_MULTIPLE_TILES_ACTIVATION_KEY() {
    return get_activationkey(
      Settings.KEY_SPAN_MULTIPLE_TILES_ACTIVATION_KEY,
      1 /* ALT */
    );
  }

  static set SPAN_MULTIPLE_TILES_ACTIVATION_KEY(val) {
    set_activationkey(Settings.KEY_SPAN_MULTIPLE_TILES_ACTIVATION_KEY, val);
  }

  static get RESTORE_WINDOW_ORIGINAL_SIZE() {
    return get_boolean(Settings.KEY_RESTORE_WINDOW_ORIGINAL_SIZE);
  }

  static set RESTORE_WINDOW_ORIGINAL_SIZE(val) {
    set_boolean(Settings.KEY_RESTORE_WINDOW_ORIGINAL_SIZE, val);
  }

  static get WRAPAROUND_FOCUS() {
    return get_boolean(Settings.KEY_WRAPAROUND_FOCUS);
  }

  static set WRAPAROUND_FOCUS(val) {
    set_boolean(Settings.KEY_WRAPAROUND_FOCUS, val);
  }

  static get ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY() {
    return get_boolean(Settings.KEY_ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY);
  }

  static set ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY(val) {
    set_boolean(Settings.KEY_ENABLE_DIRECTIONAL_FOCUS_TILED_ONLY, val);
  }

  static get RESIZE_COMPLEMENTING_WINDOWS() {
    return get_boolean(Settings.KEY_RESIZE_COMPLEMENTING_WINDOWS);
  }

  static set RESIZE_COMPLEMENTING_WINDOWS(val) {
    set_boolean(Settings.KEY_RESIZE_COMPLEMENTING_WINDOWS, val);
  }

  static get ENABLE_BLUR_SNAP_ASSISTANT() {
    return get_boolean(Settings.KEY_ENABLE_BLUR_SNAP_ASSISTANT);
  }

  static set ENABLE_BLUR_SNAP_ASSISTANT(val) {
    set_boolean(Settings.KEY_ENABLE_BLUR_SNAP_ASSISTANT, val);
  }

  static get ENABLE_BLUR_SELECTED_TILEPREVIEW() {
    return get_boolean(Settings.KEY_ENABLE_BLUR_SELECTED_TILEPREVIEW);
  }

  static set ENABLE_BLUR_SELECTED_TILEPREVIEW(val) {
    set_boolean(Settings.KEY_ENABLE_BLUR_SELECTED_TILEPREVIEW, val);
  }

  static get ENABLE_MOVE_KEYBINDINGS() {
    return get_boolean(Settings.KEY_ENABLE_MOVE_KEYBINDINGS);
  }

  static set ENABLE_MOVE_KEYBINDINGS(val) {
    set_boolean(Settings.KEY_ENABLE_MOVE_KEYBINDINGS, val);
  }

  static get ENABLE_AUTO_TILING() {
    return get_boolean(Settings.KEY_ENABLE_AUTO_TILING);
  }

  static set ENABLE_AUTO_TILING(val) {
    set_boolean(Settings.KEY_ENABLE_AUTO_TILING, val);
  }

  static get RAISE_TOGETHER() {
    return get_boolean(Settings.KEY_RAISE_TOGETHER);
  }

  static set RAISE_TOGETHER(val) {
    set_boolean(Settings.KEY_RAISE_TOGETHER, val);
  }

  static get ACTIVE_SCREEN_EDGES() {
    return get_boolean(Settings.KEY_ACTIVE_SCREEN_EDGES);
  }

  static set ACTIVE_SCREEN_EDGES(val) {
    set_boolean(Settings.KEY_ACTIVE_SCREEN_EDGES, val);
  }

  static get TOP_EDGE_MAXIMIZE() {
    return get_boolean(Settings.KEY_TOP_EDGE_MAXIMIZE);
  }

  static set TOP_EDGE_MAXIMIZE(val) {
    set_boolean(Settings.KEY_TOP_EDGE_MAXIMIZE, val);
  }

  static get OVERRIDE_WINDOW_MENU() {
    return get_boolean(Settings.KEY_OVERRIDE_WINDOW_MENU);
  }

  static set OVERRIDE_WINDOW_MENU(val) {
    set_boolean(Settings.KEY_OVERRIDE_WINDOW_MENU, val);
  }

  static get OVERRIDE_ALT_TAB() {
    return get_boolean(Settings.KEY_OVERRIDE_ALT_TAB);
  }

  static set OVERRIDE_ALT_TAB(val) {
    set_boolean(Settings.KEY_OVERRIDE_ALT_TAB, val);
  }

  static get SNAP_ASSISTANT_THRESHOLD() {
    return get_number(Settings.KEY_SNAP_ASSISTANT_THRESHOLD);
  }

  static set SNAP_ASSISTANT_THRESHOLD(val) {
    set_number(Settings.KEY_SNAP_ASSISTANT_THRESHOLD, val);
  }

  static get QUARTER_TILING_THRESHOLD() {
    return get_unsigned_number(Settings.KEY_QUARTER_TILING_THRESHOLD);
  }

  static set QUARTER_TILING_THRESHOLD(val) {
    set_unsigned_number(Settings.KEY_QUARTER_TILING_THRESHOLD, val);
  }

  static get EDGE_TILING_OFFSET() {
    return get_unsigned_number(Settings.KEY_EDGE_TILING_OFFSET);
  }

  static set EDGE_TILING_OFFSET(val) {
    set_unsigned_number(Settings.KEY_EDGE_TILING_OFFSET, val);
  }

  static get WINDOW_BORDER_COLOR() {
    return get_string(Settings.KEY_WINDOW_BORDER_COLOR);
  }

  static set WINDOW_BORDER_COLOR(val) {
    set_string(Settings.KEY_WINDOW_BORDER_COLOR, val);
  }

  static get WINDOW_USE_CUSTOM_BORDER_COLOR() {
    return get_boolean(Settings.KEY_WINDOW_USE_CUSTOM_BORDER_COLOR);
  }

  static set WINDOW_USE_CUSTOM_BORDER_COLOR(val) {
    set_boolean(Settings.KEY_WINDOW_USE_CUSTOM_BORDER_COLOR, val);
  }

  static get WINDOW_BORDER_WIDTH() {
    return get_unsigned_number(Settings.KEY_WINDOW_BORDER_WIDTH);
  }

  static set WINDOW_BORDER_WIDTH(val) {
    set_unsigned_number(Settings.KEY_WINDOW_BORDER_WIDTH, val);
  }

  static get ENABLE_SMART_WINDOW_BORDER_RADIUS() {
    return get_boolean(Settings.KEY_ENABLE_SMART_WINDOW_BORDER_RADIUS);
  }

  static set ENABLE_SMART_WINDOW_BORDER_RADIUS(val) {
    set_boolean(Settings.KEY_ENABLE_SMART_WINDOW_BORDER_RADIUS, val);
  }

  static get ENABLE_WINDOW_BORDER() {
    return get_boolean(Settings.KEY_ENABLE_WINDOW_BORDER);
  }

  static set ENABLE_WINDOW_BORDER(val) {
    set_boolean(Settings.KEY_ENABLE_WINDOW_BORDER, val);
  }

  static get SNAP_ASSISTANT_ANIMATION_TIME() {
    return get_unsigned_number(Settings.KEY_SNAP_ASSISTANT_ANIMATION_TIME);
  }

  static set SNAP_ASSISTANT_ANIMATION_TIME(val) {
    set_unsigned_number(Settings.KEY_SNAP_ASSISTANT_ANIMATION_TIME, val);
  }

  static get TILE_PREVIEW_ANIMATION_TIME() {
    return get_unsigned_number(Settings.KEY_TILE_PREVIEW_ANIMATION_TIME);
  }

  static set TILE_PREVIEW_ANIMATION_TIME(val) {
    set_unsigned_number(Settings.KEY_TILE_PREVIEW_ANIMATION_TIME, val);
  }

  static get ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS() {
    return get_boolean(
      Settings.KEY_ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS
    );
  }

  static set ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS(val) {
    set_boolean(Settings.KEY_ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS, val);
  }

  static get ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS() {
    return get_boolean(
      Settings.KEY_ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS
    );
  }

  static set ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS(val) {
    set_boolean(
      Settings.KEY_ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS,
      val
    );
  }

  static get ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS() {
    return get_boolean(
      Settings.KEY_ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS
    );
  }

  static set ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS(val) {
    set_boolean(Settings.KEY_ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS, val);
  }

  static get EDGE_TILING_MODE() {
    const value = get_string(Settings.KEY_EDGE_TILING_MODE);
    if (Object.values(EdgeTilingMode).includes(value))
      return value;
    return "default" /* DEFAULT */;
  }

  static set EDGE_TILING_MODE(val) {
    set_string(Settings.KEY_EDGE_TILING_MODE, val);
  }

  static get_inner_gaps(scaleFactor = 1) {
    const value = this.INNER_GAPS * scaleFactor;
    return {
      top: value,
      bottom: value,
      left: value,
      right: value
    };
  }

  static get_outer_gaps(scaleFactor = 1) {
    const value = this.OUTER_GAPS * scaleFactor;
    return {
      top: value,
      bottom: value,
      left: value,
      right: value
    };
  }

  static get_layouts_json() {
    try {
      const layouts = JSON.parse(
        this._settings?.get_string(this.KEY_SETTING_LAYOUTS_JSON) || "[]"
      );
      if (layouts.length === 0)
        throw new Error("At least one layout is required");
      return layouts.filter((layout) => layout.tiles.length > 0);
    } catch (_unused) {
      this.reset_layouts_json();
      return JSON.parse(
        this._settings?.get_string(this.KEY_SETTING_LAYOUTS_JSON) || "[]"
      );
    }
  }

  static get_selected_layouts() {
    const variant = this._settings?.get_value(
      Settings.KEY_SETTING_SELECTED_LAYOUTS
    );
    if (!variant) return [];
    const result = [];
    for (let i = 0; i < variant.n_children(); i++) {
      const monitor_variant = variant.get_child_value(i);
      if (!monitor_variant) continue;
      const n_workspaces = monitor_variant.n_children();
      const monitor_result = [];
      for (let j = 0; j < n_workspaces; j++) {
        const layout_variant = monitor_variant.get_child_value(j);
        if (!layout_variant) continue;
        monitor_result.push(layout_variant.get_string()[0]);
      }
      result.push(monitor_result);
    }
    return result;
  }

  static reset_layouts_json() {
    this.save_layouts_json([
      new Layout(
        [
          new Tile({
            x: 0,
            y: 0,
            height: 0.5,
            width: 0.22,
            groups: [1, 2]
          }),
          // top-left
          new Tile({
            x: 0,
            y: 0.5,
            height: 0.5,
            width: 0.22,
            groups: [1, 2]
          }),
          // bottom-left
          new Tile({
            x: 0.22,
            y: 0,
            height: 1,
            width: 0.56,
            groups: [2, 3]
          }),
          // center
          new Tile({
            x: 0.78,
            y: 0,
            height: 0.5,
            width: 0.22,
            groups: [3, 4]
          }),
          // top-right
          new Tile({
            x: 0.78,
            y: 0.5,
            height: 0.5,
            width: 0.22,
            groups: [3, 4]
          })
          // bottom-right
        ],
        "Layout 1"
      ),
      new Layout(
        [
          new Tile({
            x: 0,
            y: 0,
            height: 1,
            width: 0.22,
            groups: [1]
          }),
          new Tile({
            x: 0.22,
            y: 0,
            height: 1,
            width: 0.56,
            groups: [1, 2]
          }),
          new Tile({
            x: 0.78,
            y: 0,
            height: 1,
            width: 0.22,
            groups: [2]
          })
        ],
        "Layout 2"
      ),
      new Layout(
        [
          new Tile({
            x: 0,
            y: 0,
            height: 1,
            width: 0.33,
            groups: [1]
          }),
          new Tile({
            x: 0.33,
            y: 0,
            height: 1,
            width: 0.67,
            groups: [1]
          })
        ],
        "Layout 3"
      ),
      new Layout(
        [
          new Tile({
            x: 0,
            y: 0,
            height: 1,
            width: 0.67,
            groups: [1]
          }),
          new Tile({
            x: 0.67,
            y: 0,
            height: 1,
            width: 0.33,
            groups: [1]
          })
        ],
        "Layout 4"
      )
    ]);
  }

  static save_layouts_json(layouts) {
    this._settings?.set_string(
      this.KEY_SETTING_LAYOUTS_JSON,
      JSON.stringify(layouts)
    );
  }

  static save_selected_layouts(ids) {
    if (ids.length === 0) {
      this._settings?.reset(Settings.KEY_SETTING_SELECTED_LAYOUTS);
      return;
    }
    const variants = ids.map(
      (monitor_ids) => GLib.Variant.new_strv(monitor_ids)
    );
    const result = GLib.Variant.new_array(null, variants);
    this._settings?.set_value(
      Settings.KEY_SETTING_SELECTED_LAYOUTS,
      result
    );
  }

  static connect(key, func) {
    return this._settings?.connect(`changed::${key}`, func) || -1;
  }

  static disconnect(id) {
    this._settings?.disconnect(id);
  }
}

export {
  ActivationKey,
  EdgeTilingMode,
  Settings as default
};
