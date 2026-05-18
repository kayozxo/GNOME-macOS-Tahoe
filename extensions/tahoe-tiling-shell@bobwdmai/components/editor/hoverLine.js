import { registerGObjectClass } from "../../utils/gjs.js";
import { GLib, St, Clutter, Shell } from "../../gi/ext.js";
import { getScalingFactorOf } from "../../utils/ui.js";
const _HoverLine = class _HoverLine extends St.Widget {
  _hoverTimer;
  _size;
  _hoveredTile;
  constructor(parent) {
    super({ styleClass: "hover-line" });
    parent.add_child(this);
    this._hoveredTile = null;
    const [, scalingFactor] = getScalingFactorOf(this);
    this._size = 16 * scalingFactor;
    this.hide();
    this._hoverTimer = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT_IDLE,
      100,
      this._handleModifierChange.bind(this)
    );
    this.connect("destroy", this._onDestroy.bind(this));
  }

  handleTileDestroy(tile) {
    if (this._hoveredTile === tile) {
      this._hoveredTile = null;
      this.hide();
    }
  }

  handleMouseMove(tile, x, y) {
    this._hoveredTile = tile;
    const modifier = Shell.Global.get().get_pointer()[2];
    const splitHorizontally = (modifier & Clutter.ModifierType.CONTROL_MASK) === 0;
    this._drawLine(splitHorizontally, x, y);
  }

  _handleModifierChange() {
    if (!this._hoveredTile) return GLib.SOURCE_CONTINUE;
    if (!this._hoveredTile.hover) {
      this.hide();
      return GLib.SOURCE_CONTINUE;
    }
    const [x, y, modifier] = global.get_pointer();
    const splitHorizontally = (modifier & Clutter.ModifierType.CONTROL_MASK) === 0;
    this._drawLine(
      splitHorizontally,
      x - (this.get_parent()?.x || 0),
      y - (this.get_parent()?.y || 0)
    );
    return GLib.SOURCE_CONTINUE;
  }

  _drawLine(splitHorizontally, x, y) {
    if (!this._hoveredTile) return;
    if (splitHorizontally) {
      const newX = x - this._size / 2;
      if (newX < this._hoveredTile.x || newX + this._size > this._hoveredTile.x + this._hoveredTile.width)
        return;
      this.set_size(this._size, this._hoveredTile.height);
      this.set_position(newX, this._hoveredTile.y);
    } else {
      const newY = y - this._size / 2;
      if (newY < this._hoveredTile.y || newY + this._size > this._hoveredTile.y + this._hoveredTile.height)
        return;
      this.set_size(this._hoveredTile.width, this._size);
      this.set_position(this._hoveredTile.x, newY);
    }
    this.show();
  }

  _onDestroy() {
    GLib.Source.remove(this._hoverTimer);
    this._hoveredTile = null;
  }
};
registerGObjectClass(_HoverLine);
let HoverLine = _HoverLine;
export {
  HoverLine as default
};
