import Layout from "../../components/layout/Layout.js";
import LayoutWidget from "../../components/layout/LayoutWidget.js";
import SnapAssistTile from "../../components/snapassist/snapAssistTile.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import { buildRectangle, getScalingFactorOf } from "../../utils/ui.js";
const _LayoutIcon = class _LayoutIcon extends LayoutWidget {
  constructor(parent, importantTiles, tiles, innerGaps, outerGaps, width, height) {
    super({
      parent,
      layout: new Layout(tiles, ""),
      innerGaps: innerGaps.copy(),
      outerGaps: outerGaps.copy(),
      containerRect: buildRectangle(),
      styleClass: "layout-icon button"
    });
    const [, scalingFactor] = getScalingFactorOf(this);
    width *= scalingFactor;
    height *= scalingFactor;
    super.relayout({
      containerRect: buildRectangle({ x: 0, y: 0, width, height })
    });
    this.set_size(width, height);
    this.set_x_expand(false);
    this.set_y_expand(false);
    importantTiles.forEach((t) => {
      const preview = this._previews.find(
        (snap) => snap.tile.x === t.x && snap.tile.y === t.y
      );
      if (preview) preview.add_style_class_name("important");
    });
  }

  buildTile(parent, rect, gaps, tile) {
    return new SnapAssistTile({ parent, rect, gaps, tile });
  }
};
registerGObjectClass(_LayoutIcon);
let LayoutIcon = _LayoutIcon;
export {
  LayoutIcon as default
};
