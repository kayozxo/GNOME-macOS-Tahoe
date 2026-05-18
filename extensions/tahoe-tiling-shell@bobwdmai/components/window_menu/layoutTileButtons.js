import LayoutWidget from "../../components/layout/LayoutWidget.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import { buildMarginOf, buildRectangle, getScalingFactorOf } from "../../utils/ui.js";
import SnapAssistTileButton from "../snapassist/snapAssistTileButton.js";
const _LayoutTileButtons = class _LayoutTileButtons extends LayoutWidget {
  constructor(parent, layout, gapSize, height, width) {
    super({
      parent,
      layout,
      containerRect: buildRectangle(),
      innerGaps: buildMarginOf(gapSize),
      outerGaps: buildMarginOf(gapSize),
      styleClass: "window-menu-layout"
    });
    const [, scalingFactor] = getScalingFactorOf(this);
    this.relayout({
      containerRect: buildRectangle({
        x: 0,
        y: 0,
        width: width * scalingFactor,
        height: height * scalingFactor
      })
    });
    this._fixFloatingPointErrors();
  }

  buildTile(parent, rect, gaps, tile) {
    return new SnapAssistTileButton({ parent, rect, gaps, tile });
  }

  get buttons() {
    return this._previews;
  }

  _fixFloatingPointErrors() {
    const xMap = /* @__PURE__ */ new Map();
    const yMap = /* @__PURE__ */ new Map();
    this._previews.forEach((prev) => {
      const tile = prev.tile;
      const newX = xMap.get(tile.x);
      if (!newX) xMap.set(tile.x, prev.rect.x);
      const newY = yMap.get(tile.y);
      if (!newY) yMap.set(tile.y, prev.rect.y);
      if (newX || newY) {
        prev.open(
          buildRectangle({
            x: newX ?? prev.rect.x,
            y: newY ?? prev.rect.y,
            width: prev.rect.width,
            height: prev.rect.height
          }),
          false
        );
      }
      xMap.set(
        tile.x + tile.width,
        xMap.get(tile.x + tile.width) ?? prev.rect.x + prev.rect.width
      );
      yMap.set(
        tile.y + tile.height,
        yMap.get(tile.y + tile.height) ?? prev.rect.y + prev.rect.height
      );
    });
  }
};
registerGObjectClass(_LayoutTileButtons);
let LayoutTileButtons = _LayoutTileButtons;
export {
  LayoutTileButtons as default
};
