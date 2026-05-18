import { registerGObjectClass } from "../../utils/gjs.js";
import TilePreview from "../tilepreview/tilePreview.js";
import { St } from "../../gi/ext.js";
import { getScalingFactorOf } from "../../utils/ui.js";
const MIN_RADIUS = 2;
const _SnapAssistTile = class _SnapAssistTile extends TilePreview {
  _styleChangedSignalID;
  constructor(params) {
    super({
      parent: params.parent,
      rect: params.rect,
      gaps: params.gaps,
      tile: params.tile
    });
    const isLeft = this._tile.x <= 1e-3;
    const isTop = this._tile.y <= 1e-3;
    const isRight = this._tile.x + this._tile.width >= 0.99;
    const isBottom = this._tile.y + this._tile.height >= 0.99;
    const [alreadyScaled, scalingFactor] = getScalingFactorOf(this);
    const radiusValue = (alreadyScaled ? 1 : scalingFactor) * (this.get_theme_node().get_length("border-radius-value") / (alreadyScaled ? scalingFactor : 1));
    const borderWidthValue = (alreadyScaled ? 1 : scalingFactor) * (this.get_theme_node().get_length("border-width-value") / (alreadyScaled ? scalingFactor : 1));
    const radius = [
      this._gaps.top === 0 && this._gaps.left === 0 ? 0 : MIN_RADIUS,
      this._gaps.top === 0 && this._gaps.right === 0 ? 0 : MIN_RADIUS,
      this._gaps.bottom === 0 && this._gaps.right === 0 ? 0 : MIN_RADIUS,
      this._gaps.bottom === 0 && this._gaps.left === 0 ? 0 : MIN_RADIUS
    ];
    if (isTop && isLeft) radius[St.Corner.TOPLEFT] = radiusValue;
    if (isTop && isRight) radius[St.Corner.TOPRIGHT] = radiusValue;
    if (isBottom && isRight) radius[St.Corner.BOTTOMRIGHT] = radiusValue;
    if (isBottom && isLeft) radius[St.Corner.BOTTOMLEFT] = radiusValue;
    const borderWidth = [
      borderWidthValue,
      borderWidthValue,
      borderWidthValue,
      borderWidthValue
    ];
    if (isTop || this._gaps.top > 0) borderWidth[St.Side.TOP] *= 2;
    else borderWidth[St.Side.TOP] = Math.floor(borderWidth[St.Side.TOP]);
    if (isRight || this._gaps.right > 0) borderWidth[St.Side.RIGHT] *= 2;
    else
      borderWidth[St.Side.RIGHT] = Math.floor(borderWidth[St.Side.RIGHT]);
    if (isBottom || this._gaps.bottom > 0) borderWidth[St.Side.BOTTOM] *= 2;
    if (isLeft || this._gaps.left > 0) borderWidth[St.Side.LEFT] *= 2;
    this.set_style(`
            border-radius: ${radius[St.Corner.TOPLEFT]}px ${radius[St.Corner.TOPRIGHT]}px ${radius[St.Corner.BOTTOMRIGHT]}px ${radius[St.Corner.BOTTOMLEFT]}px;
            border-top-width: ${borderWidth[St.Side.TOP]}px;
            border-right-width: ${borderWidth[St.Side.RIGHT]}px;
            border-bottom-width: ${borderWidth[St.Side.BOTTOM]}px;
            border-left-width: ${borderWidth[St.Side.LEFT]}px;`);
    this._applyStyle();
    this._styleChangedSignalID = St.ThemeContext.get_for_stage(
      global.get_stage()
    ).connect("changed", () => {
      this._applyStyle();
    });
    this.connect("destroy", () => this.onDestroy());
  }

  _init() {
    super._init();
    this.set_style_class_name("snap-assist-tile");
  }

  _applyStyle() {
    const [hasColor, { red, green, blue }] = this.get_theme_node().lookup_color("color", true);
    if (!hasColor) return;
    if (red * 0.299 + green * 0.587 + blue * 0.114 > 186) {
      this.remove_style_class_name("dark");
    } else {
      this.add_style_class_name("dark");
    }
  }

  onDestroy() {
    if (this._styleChangedSignalID) {
      St.ThemeContext.get_for_stage(global.get_stage()).disconnect(
        this._styleChangedSignalID
      );
      this._styleChangedSignalID = void 0;
    }
  }
};
registerGObjectClass(_SnapAssistTile);
let SnapAssistTile = _SnapAssistTile;
export {
  SnapAssistTile as default
};
