import { registerGObjectClass } from "../../utils/gjs.js";
import LayoutWidget from "../layout/LayoutWidget.js";
import SnapAssistTile from "./snapAssistTile.js";
import { buildRectangle } from "../../utils/ui.js";
const _SnapAssistLayout = class _SnapAssistLayout extends LayoutWidget {
  constructor(parent, layout, innerGaps, outerGaps, width, height) {
    super({
      containerRect: buildRectangle({ x: 0, y: 0, width, height }),
      parent,
      layout,
      innerGaps,
      outerGaps
    });
    this.set_size(width, height);
    super.relayout();
  }

  buildTile(parent, rect, gaps, tile) {
    return new SnapAssistTile({ parent, rect, gaps, tile });
  }

  getTileBelow(cursorPos) {
    const [x, y] = this.get_transformed_position();
    for (let i = 0; i < this._previews.length; i++) {
      const preview = this._previews[i];
      const pos = { x: x + preview.rect.x, y: y + preview.rect.y };
      const isHovering = cursorPos.x >= pos.x && cursorPos.x <= pos.x + preview.rect.width && cursorPos.y >= pos.y && cursorPos.y <= pos.y + preview.rect.height;
      if (isHovering) return preview;
    }
    return void 0;
  }
};
registerGObjectClass(_SnapAssistLayout);
let SnapAssistLayout = _SnapAssistLayout;
export {
  SnapAssistLayout as default
};
