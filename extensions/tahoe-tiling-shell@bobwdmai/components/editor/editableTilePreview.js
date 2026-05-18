var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import TilePreview from "../tilepreview/tilePreview.js";
import { St, Mtk } from "../../gi/ext.js";
import TileUtils from "../layout/TileUtils.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import { buildTileGaps } from "../../utils/ui.js";
const _EditableTilePreview = class _EditableTilePreview extends TilePreview {
  _btn;
  _containerRect;
  _sliders;
  _signals;
  constructor(params) {
    super(params);
    this.add_style_class_name("editable-tile-preview");
    this._tile = params.tile;
    this._containerRect = params.containerRect;
    this._sliders = [null, null, null, null];
    this._signals = [null, null, null, null];
    this._btn = new St.Button({
      styleClass: "editable-tile-preview-button",
      xExpand: true,
      trackHover: true
    });
    this.add_child(this._btn);
    this._btn.set_size(this.innerWidth, this.innerHeight);
    this._btn.set_button_mask(St.ButtonMask.ONE | St.ButtonMask.THREE);
    this._updateLabelText();
    this.connect("destroy", this._onDestroy.bind(this));
  }

  set gaps(newGaps) {
    super.gaps = newGaps;
    this.updateBorderRadius(
      this._gaps.top > 0,
      this._gaps.right > 0,
      this._gaps.bottom > 0,
      this._gaps.left > 0
    );
  }

  getSlider(side) {
    return this._sliders[side];
  }

  getAllSliders() {
    return [...this._sliders];
  }

  get hover() {
    return this._btn.hover;
  }

  addSlider(slider, side) {
    const sig = this._signals[side];
    if (sig) this._sliders[side]?.disconnect(sig);
    this._sliders[side] = slider;
    this._signals[side] = slider.connect(
      "slide",
      () => this._onSliderMove(side)
    );
    this._tile.groups = [];
    this._sliders.forEach((sl) => sl && this._tile.groups.push(sl.groupId));
  }

  removeSlider(side) {
    if (this._sliders[side] === null) return;
    const sig = this._signals[side];
    if (sig) this._sliders[side]?.disconnect(sig);
    this._sliders[side] = null;
    this._tile.groups = [];
    this._sliders.forEach((sl) => sl && this._tile.groups.push(sl.groupId));
  }

  updateTile({
    x,
    y,
    width,
    height,
    innerGaps,
    outerGaps
  }) {
    const oldSize = this._rect.copy();
    this._tile.x = x;
    this._tile.y = y;
    this._tile.width = width;
    this._tile.height = height;
    this._rect = TileUtils.apply_props(this._tile, this._containerRect);
    if (innerGaps && outerGaps) {
      this.gaps = buildTileGaps(
        this._rect,
        innerGaps,
        outerGaps,
        this._containerRect
      ).gaps;
    }
    this.set_size(this.innerWidth, this.innerHeight);
    this.set_position(this.innerX, this.innerY);
    this._btn.set_size(this.width, this.height);
    this._updateLabelText();
    const newSize = this._rect.copy();
    this.emit("size-changed", oldSize, newSize);
  }

  connect(signal, callback) {
    if (signal === "clicked" || signal === "notify::hover" || signal === "motion-event")
      return this._btn.connect(signal, callback);
    return super.connect(signal, callback);
  }

  _updateLabelText() {
    this._btn.label = `${this.innerWidth}x${this.innerHeight}`;
  }

  _onSliderMove(side) {
    const slider = this._sliders[side];
    if (slider === null) return;
    const posHoriz = (slider.x + slider.width / 2 - this._containerRect.x) / this._containerRect.width;
    const posVert = (slider.y + slider.height / 2 - this._containerRect.y) / this._containerRect.height;
    switch (side) {
      case St.Side.TOP:
        this._tile.height += this._tile.y - posVert;
        this._tile.y = posVert;
        break;
      case St.Side.RIGHT:
        this._tile.width = posHoriz - this._tile.x;
        break;
      case St.Side.BOTTOM:
        this._tile.height = posVert - this._tile.y;
        break;
      case St.Side.LEFT:
        this._tile.width += this._tile.x - posHoriz;
        this._tile.x = posHoriz;
        break;
    }
    this.updateTile({ ...this._tile });
  }

  _onDestroy() {
    this._signals.forEach(
      (id, side) => id && this._sliders[side]?.disconnect(id)
    );
  }
};
registerGObjectClass(_EditableTilePreview, {
  Signals: {
    "size-changed": {
      param_types: [Mtk.Rectangle.$gtype, Mtk.Rectangle.$gtype]
      // oldSize, newSize
    }
  },
  GTypeName: "EditableTilePreview"
});
__publicField(_EditableTilePreview, "MIN_TILE_SIZE", 140);
let EditableTilePreview = _EditableTilePreview;
export {
  EditableTilePreview as default
};
