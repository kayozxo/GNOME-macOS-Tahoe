import { registerGObjectClass } from "../../utils/gjs.js";
import { Clutter, St } from "../../gi/ext.js";
import LayoutWidget from "../../components/layout/LayoutWidget.js";
import Layout from "../../components/layout/Layout.js";
import { buildMarginOf, buildRectangle } from "../../utils/ui.js";
import TilePreviewWithWindow from "./tilePreviewWithWindow.js";
import MetaWindowGroup from "./MetaWindowGroup.js";
import { _ } from "../../translations.js";
const OUTER_GAPS = 2;
const _MultipleWindowsIcon = class _MultipleWindowsIcon extends LayoutWidget {
  _label;
  _window;
  constructor(params) {
    super({
      layout: new Layout(params.tiles, ""),
      innerGaps: params.innerGaps.copy(),
      outerGaps: buildMarginOf(OUTER_GAPS)
    });
    this.set_size(params.width, params.height);
    super.relayout({
      containerRect: buildRectangle({
        x: 0,
        y: 0,
        width: params.width,
        height: params.height
      })
    });
    this._previews.forEach((preview, index) => {
      const window = params.windows[index];
      if (!window) {
        preview.hide();
        return;
      }
      const winClone = new Clutter.Clone({
        source: window.get_compositor_private(),
        width: preview.innerWidth,
        height: preview.innerHeight
      });
      preview.add_child(winClone);
    });
    this._label = new St.Label({
      text: _("Tiled windows")
    });
    this._window = new MetaWindowGroup(params.windows);
    let rightMostPercentage = 0;
    params.tiles.forEach((t) => {
      if (t.x + t.width > rightMostPercentage)
        rightMostPercentage = t.x + t.width;
    });
    this.set_width(params.width * rightMostPercentage);
  }

  buildTile(parent, rect, gaps, tile) {
    return new TilePreviewWithWindow({ parent, rect, gaps, tile });
  }

  get window() {
    return this._window;
  }

  get label() {
    return this._label;
  }
};
registerGObjectClass(_MultipleWindowsIcon);
let MultipleWindowsIcon = _MultipleWindowsIcon;
export {
  MultipleWindowsIcon as default
};
