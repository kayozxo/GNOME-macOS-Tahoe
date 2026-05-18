import { registerGObjectClass } from "../../utils/gjs.js";
import { GObject, St, Gio } from "../../gi/ext.js";
import TilePreview from "./tilePreview.js";
import Settings from "../../settings/settings.js";
import { buildBlurEffect } from "../../utils/gnomesupport.js";
const _SelectionTilePreview = class _SelectionTilePreview extends TilePreview {
  _blur;
  constructor(params) {
    super(params);
    this._blur = false;
    Settings.bind(
      Settings.KEY_ENABLE_BLUR_SELECTED_TILEPREVIEW,
      this,
      "blur",
      Gio.SettingsBindFlags.GET
    );
    this._recolor();
    const styleChangedSignalID = St.ThemeContext.get_for_stage(
      global.get_stage()
    ).connect("changed", () => {
      this._recolor();
    });
    this.connect(
      "destroy",
      () => St.ThemeContext.get_for_stage(global.get_stage()).disconnect(
        styleChangedSignalID
      )
    );
    this._rect.width = this.gaps.left + this.gaps.right;
    this._rect.height = this.gaps.top + this.gaps.bottom;
  }

  set blur(value) {
    if (this._blur === value) return;
    this._blur = value;
    this.get_effect("blur")?.set_enabled(value);
    if (this._blur) this.add_style_class_name("blur-tile-preview");
    else this.remove_style_class_name("blur-tile-preview");
    this._recolor();
  }

  _init() {
    super._init();
    const effect = buildBlurEffect(48);
    effect.set_name("blur");
    effect.set_enabled(this._blur);
    this.add_effect(effect);
    this.add_style_class_name("selection-tile-preview");
  }

  _recolor() {
    this.set_style(null);
    const backgroundColor = this.get_theme_node().get_background_color().copy();
    const newAlpha = Math.max(
      Math.min(backgroundColor.alpha + 35, 255),
      160
    );
    this.set_style(`
            background-color: rgba(${backgroundColor.red}, ${backgroundColor.green}, ${backgroundColor.blue}, ${newAlpha / 255}) !important;
        `);
  }

  close(ease = false) {
    if (!this._showing) return;
    this._rect.width = this.gaps.left + this.gaps.right;
    this._rect.height = this.gaps.top + this.gaps.bottom;
    super.close(ease);
  }
};
registerGObjectClass(_SelectionTilePreview, {
  GTypeName: "SelectionTilePreview",
  Properties: {
    blur: GObject.ParamSpec.boolean(
      "blur",
      "blur",
      "Enable or disable the blur effect",
      GObject.ParamFlags.READWRITE,
      false
    )
  }
});
let SelectionTilePreview = _SelectionTilePreview;
export {
  SelectionTilePreview as default
};
