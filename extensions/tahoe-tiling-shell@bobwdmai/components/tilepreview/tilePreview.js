import { St, Clutter } from "../../gi/ext.js";
import { buildRectangle, getScalingFactorOf } from "../../utils/ui.js";
import GlobalState from "../../utils/globalState.js";
import Tile from "../../components/layout/Tile.js";
import { registerGObjectClass } from "../../utils/gjs.js";
const _TilePreview = class _TilePreview extends St.Widget {
  _rect;
  _showing;
  _tile;
  _gaps;
  constructor(params) {
    super(params);
    if (params.parent) params.parent.add_child(this);
    this._showing = false;
    this._rect = params.rect || buildRectangle({});
    this._gaps = new Clutter.Margin();
    this.gaps = params.gaps || new Clutter.Margin();
    this._tile = params.tile || new Tile({ x: 0, y: 0, width: 0, height: 0, groups: [] });
  }

  set gaps(gaps) {
    const [, scalingFactor] = getScalingFactorOf(this);
    this._gaps.top = gaps.top * scalingFactor;
    this._gaps.right = gaps.right * scalingFactor;
    this._gaps.bottom = gaps.bottom * scalingFactor;
    this._gaps.left = gaps.left * scalingFactor;
  }

  updateBorderRadius(hasNeighborTop, hasNeighborRight, hasNeighborBottom, hasNeighborLeft) {
    this.remove_style_class_name("top-left-border-radius");
    this.remove_style_class_name("top-right-border-radius");
    this.remove_style_class_name("bottom-right-border-radius");
    this.remove_style_class_name("bottom-left-border-radius");
    this.remove_style_class_name("custom-tile-preview");
    const topLeft = hasNeighborTop && hasNeighborLeft;
    const topRight = hasNeighborTop && hasNeighborRight;
    const bottomRight = hasNeighborBottom && hasNeighborRight;
    const bottomLeft = hasNeighborBottom && hasNeighborLeft;
    if (topLeft) this.add_style_class_name("top-left-border-radius");
    if (topRight) this.add_style_class_name("top-right-border-radius");
    if (bottomRight)
      this.add_style_class_name("bottom-right-border-radius");
    if (bottomLeft) this.add_style_class_name("bottom-left-border-radius");
  }

  get gaps() {
    return this._gaps;
  }

  get tile() {
    return this._tile;
  }

  _init() {
    super._init();
    this.set_style_class_name("tile-preview");
    this.hide();
  }

  get innerX() {
    return this._rect.x + this._gaps.left;
  }

  get innerY() {
    return this._rect.y + this._gaps.top;
  }

  get innerWidth() {
    return this._rect.width - this._gaps.right - this._gaps.left;
  }

  get innerHeight() {
    return this._rect.height - this._gaps.top - this._gaps.bottom;
  }

  get rect() {
    return this._rect;
  }

  get showing() {
    return this._showing;
  }

  open(position = void 0, ease = false) {
    if (position) this._rect = position;
    const fadeInMove = this._showing;
    this._showing = true;
    this.show();
    if (fadeInMove) {
      this.ease({
        x: this.innerX,
        y: this.innerY,
        width: this.innerWidth,
        height: this.innerHeight,
        opacity: 255,
        duration: ease ? GlobalState.get().tilePreviewAnimationTime : 0,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD
      });
    } else {
      this.set_position(this.innerX, this.innerY);
      this.set_size(this.innerWidth, this.innerHeight);
      this.ease({
        opacity: 255,
        duration: ease ? GlobalState.get().tilePreviewAnimationTime : 0,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD
      });
    }
  }

  openBelow(window, position, ease = false) {
    if (this.get_parent() === global.windowGroup) {
      const windowActor = window.get_compositor_private();
      if (!windowActor) return;
      global.windowGroup.set_child_below_sibling(this, windowActor);
    }
    this.open(position, ease);
  }

  openAbove(window, position, ease = false) {
    if (this.get_parent() === global.windowGroup) {
      global.windowGroup.set_child_above_sibling(this, null);
    }
    this.open(position, ease);
  }

  close(ease = false) {
    if (!this._showing) return;
    this._showing = false;
    this.ease({
      opacity: 0,
      duration: ease ? GlobalState.get().tilePreviewAnimationTime : 0,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => this.hide()
    });
  }
};
registerGObjectClass(_TilePreview);
let TilePreview = _TilePreview;
export {
  TilePreview as default
};
