import { Clutter } from "../../gi/ext.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import { buildRectangle } from "../../utils/ui.js";
import Tile from "../../components/layout/Tile.js";
import TilePreview from "../../components/tilepreview/tilePreview.js";
const _TilePreviewWithWindow = class _TilePreviewWithWindow extends TilePreview {
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
    this._gaps = gaps.copy();
    if (this._gaps.top === 0 && this._gaps.bottom === 0 && this._gaps.right === 0 && this._gaps.left === 0)
      this.remove_style_class_name("custom-tile-preview");
    else this.add_style_class_name("custom-tile-preview");
  }

  _init() {
    super._init();
    this.remove_style_class_name("tile-preview");
  }
};
registerGObjectClass(_TilePreviewWithWindow);
let TilePreviewWithWindow = _TilePreviewWithWindow;
export {
  TilePreviewWithWindow as default
};
