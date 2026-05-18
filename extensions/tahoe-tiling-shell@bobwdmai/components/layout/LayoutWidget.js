import { St, Clutter } from "../../gi/ext.js";
import {
  buildRectangle,
  buildTileGaps,
  enableScalingFactorSupport
} from "../../utils/ui.js";
import { logger } from "../../utils/logger.js";
import Layout from "./Layout.js";
import TileUtils from "./TileUtils.js";
import { registerGObjectClass } from "../../utils/gjs.js";
const debug = logger("LayoutWidget");
const _LayoutWidget = class _LayoutWidget extends St.Widget {
  _previews;
  _containerRect;
  _layout;
  _innerGaps;
  _outerGaps;
  _scalingFactor;
  constructor(params) {
    super({ styleClass: params.styleClass || "" });
    if (params.parent) params.parent.add_child(this);
    this._scalingFactor = 1;
    if (params.scalingFactor) this.scalingFactor = params.scalingFactor;
    this._previews = [];
    this._containerRect = params.containerRect || buildRectangle();
    this._layout = params.layout || new Layout([], "");
    this._innerGaps = params.innerGaps || new Clutter.Margin();
    this._outerGaps = params.outerGaps || new Clutter.Margin();
  }

  set scalingFactor(value) {
    enableScalingFactorSupport(this, value);
    this._scalingFactor = value;
  }

  get scalingFactor() {
    return this._scalingFactor;
  }

  get innerGaps() {
    return this._innerGaps.copy();
  }

  get outerGaps() {
    return this._outerGaps.copy();
  }

  get layout() {
    return this._layout;
  }

  draw_layout() {
    const containerWithoutOuterGaps = buildRectangle({
      x: this._outerGaps.left + this._containerRect.x,
      y: this._outerGaps.top + this._containerRect.y,
      width: this._containerRect.width - this._outerGaps.left - this._outerGaps.right,
      height: this._containerRect.height - this._outerGaps.top - this._outerGaps.bottom
    });
    this._previews = this._layout.tiles.map((tile) => {
      const tileRect = TileUtils.apply_props(
        tile,
        containerWithoutOuterGaps
      );
      const { gaps, isTop, isRight, isBottom, isLeft } = buildTileGaps(
        tileRect,
        this._innerGaps,
        this._outerGaps,
        containerWithoutOuterGaps
      );
      if (isTop) {
        tileRect.height += this._outerGaps.top;
        tileRect.y -= this._outerGaps.top;
      }
      if (isLeft) {
        tileRect.width += this._outerGaps.left;
        tileRect.x -= this._outerGaps.left;
      }
      if (isRight) tileRect.width += this._outerGaps.right;
      if (isBottom) tileRect.height += this._outerGaps.bottom;
      return this.buildTile(this, tileRect, gaps, tile);
    });
  }

  buildTile(_parent, _rect, _margin, _tile) {
    throw new Error(
      "This class shouldn't be instantiated but it should be extended instead"
    );
  }

  relayout(params) {
    let trigger_relayout = this._previews.length === 0;
    if (params?.layout && this._layout !== params.layout) {
      this._layout = params.layout;
      trigger_relayout = true;
    }
    if (params?.innerGaps) {
      trigger_relayout || (trigger_relayout = !this._areGapsEqual(
        this._innerGaps,
        params.innerGaps
      ));
      this._innerGaps = params.innerGaps.copy();
    }
    if (params?.outerGaps && this._outerGaps !== params.outerGaps) {
      trigger_relayout || (trigger_relayout = !this._areGapsEqual(
        this._outerGaps,
        params.outerGaps
      ));
      this._outerGaps = params.outerGaps.copy();
    }
    if (params?.containerRect && !this._containerRect.equal(params.containerRect)) {
      this._containerRect = params.containerRect.copy();
      trigger_relayout = true;
    }
    if (!trigger_relayout) {
      debug("relayout not needed");
      return false;
    }
    this._previews?.forEach((preview) => {
      if (preview.get_parent() === this) this.remove_child(preview);
      preview.destroy();
    });
    this._previews = [];
    if (this._containerRect.width === 0 || this._containerRect.height === 0)
      return true;
    this.draw_layout();
    this._previews.forEach((lay) => lay.open());
    return true;
  }

  _areGapsEqual(first, second) {
    return first.bottom === second.bottom && first.top === second.top && first.left === second.left && first.right === second.right;
  }
};
registerGObjectClass(_LayoutWidget);
let LayoutWidget = _LayoutWidget;
export {
  LayoutWidget as default
};
