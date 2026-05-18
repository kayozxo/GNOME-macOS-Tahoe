import { registerGObjectClass } from "../../utils/gjs.js";
import { GObject, St, Clutter, Meta } from "../../gi/ext.js";
import EditableTilePreview from "./editableTilePreview.js";
import { getScalingFactorOf } from "../../utils/ui.js";
import { getEventCoords } from "../../utils/gnomesupport.js";
const _Slider = class _Slider extends St.Button {
  _sliderSize = 48;
  _groupId;
  _signals;
  _dragging;
  _grab;
  _horizontalDir;
  _lastEventCoord;
  _previousTiles;
  _nextTiles;
  _minTileCoord;
  _maxTileCoord;
  _scalingFactor;
  constructor(parent, groupId, x, y, horizontal) {
    super({
      styleClass: "layout-editor-slider",
      canFocus: true,
      xExpand: false,
      trackHover: true
    });
    parent.add_child(this);
    this._signals = /* @__PURE__ */ new Map();
    this._groupId = groupId;
    this._horizontalDir = horizontal;
    const [, scalingFactor] = getScalingFactorOf(this);
    this._scalingFactor = scalingFactor;
    this.set_width(this.desiredWidth);
    this.set_height(this.desiredHeight);
    this._previousTiles = [];
    this._nextTiles = [];
    this._minTileCoord = Number.MAX_VALUE;
    this._maxTileCoord = Number.MIN_VALUE;
    this._dragging = false;
    this._lastEventCoord = null;
    this.set_position(
      Math.round(Math.round(x - this.width / 2)),
      Math.round(y - this.height / 2)
    );
    this.connect(
      "notify::hover",
      () => global.display.set_cursor(this.preferredCursor)
    );
    this.connect("destroy", this._onDestroy.bind(this));
  }

  get groupId() {
    return this._groupId;
  }

  get desiredWidth() {
    return (this._horizontalDir ? 12 : this._sliderSize) * this._scalingFactor;
  }

  get desiredHeight() {
    return (this._horizontalDir ? this._sliderSize : 12) * this._scalingFactor;
  }

  get preferredCursor() {
    const horizCursor = Meta.Cursor.WEST_RESIZE ?? Meta.Cursor.W_RESIZE;
    const vertCursor = Meta.Cursor.NORTH_RESIZE ?? Meta.Cursor.N_RESIZE;
    return this.hover || this._dragging ? this._horizontalDir ? horizCursor : vertCursor : Meta.Cursor.DEFAULT;
  }

  addTile(tile) {
    const isNext = this._horizontalDir ? this.x <= tile.rect.x : this.y <= tile.rect.y;
    if (isNext) this._nextTiles.push(tile);
    else this._previousTiles.push(tile);
    const side = this._horizontalDir ? isNext ? St.Side.LEFT : St.Side.RIGHT : isNext ? St.Side.TOP : St.Side.BOTTOM;
    tile.addSlider(this, side);
    this._minTileCoord = Math.min(
      this._minTileCoord,
      this._horizontalDir ? tile.rect.y : tile.rect.x
    );
    this._maxTileCoord = Math.max(
      this._maxTileCoord,
      this._horizontalDir ? tile.rect.y + tile.rect.height : tile.rect.x + tile.rect.width
    );
    this._updatePosition();
    this._createTileSignals(tile);
  }

  _onTileSizeChanged(tile, oldSize, newSize) {
    if (this._horizontalDir) {
      if (this._minTileCoord !== oldSize.y && this._maxTileCoord !== oldSize.y + oldSize.height)
        return;
      if (this._minTileCoord === oldSize.y)
        this._minTileCoord = newSize.y;
      if (this._maxTileCoord === oldSize.y + oldSize.height)
        this._maxTileCoord = newSize.y + newSize.height;
    } else {
      if (this._minTileCoord !== oldSize.x && this._maxTileCoord !== oldSize.x + oldSize.width)
        return;
      if (this._minTileCoord === oldSize.x)
        this._minTileCoord = newSize.x;
      if (this._maxTileCoord === oldSize.x + oldSize.width)
        this._maxTileCoord = newSize.x + newSize.width;
    }
    this._updatePosition();
  }

  _updatePosition() {
    this.set_width(this.desiredWidth);
    this.set_height(this.desiredHeight);
    const newCoord = (this._minTileCoord + this._maxTileCoord) / 2;
    if (this._horizontalDir)
      this.set_y(Math.round(newCoord - this.height / 2));
    else this.set_x(Math.round(newCoord - this.width / 2));
  }

  _onTileDeleted(tile) {
    const isNext = this._horizontalDir ? this.x <= tile.rect.x : this.y <= tile.rect.y;
    const array = isNext ? this._nextTiles : this._previousTiles;
    const index = array.indexOf(tile, 0);
    if (index >= 0) array.splice(index, 1);
    const sig = this._signals.get(tile);
    if (sig) {
      sig.forEach((id) => tile.disconnect(id));
      this._signals.delete(tile);
    }
  }

  onTileSplit(tileToRemove, newTiles) {
    if (newTiles.length === 0) return;
    const isNext = this._horizontalDir ? this.x <= tileToRemove.rect.x : this.y <= tileToRemove.rect.y;
    const array = isNext ? this._nextTiles : this._previousTiles;
    const index = array.indexOf(tileToRemove);
    if (index < 0) return;
    const side = this._horizontalDir ? isNext ? St.Side.LEFT : St.Side.RIGHT : isNext ? St.Side.TOP : St.Side.BOTTOM;
    const sig = this._signals.get(tileToRemove);
    if (sig) {
      sig.forEach((id) => tileToRemove.disconnect(id));
      this._signals.delete(tileToRemove);
    }
    array[index] = newTiles[0];
    newTiles[0].addSlider(this, side);
    this._createTileSignals(newTiles[0]);
    for (let i = 1; i < newTiles.length; i++) {
      const tile = newTiles[i];
      array.push(tile);
      tile.addSlider(this, side);
      this._createTileSignals(tile);
    }
  }

  _createTileSignals(tile) {
    if (this._signals.has(tile)) return;
    this._signals.set(tile, []);
    this._signals.get(tile)?.push(
      tile.connect(
        "size-changed",
        this._onTileSizeChanged.bind(this)
      )
    );
    this._signals.get(tile)?.push(tile.connect("destroy", this._onTileDeleted.bind(this)));
  }

  deleteSlider(tileToDelete, innerGaps, outerGaps) {
    const isNext = this._horizontalDir ? this.x <= tileToDelete.rect.x : this.y <= tileToDelete.rect.y;
    const array = isNext ? this._nextTiles : this._previousTiles;
    if (array.length > 1 || array[0] !== tileToDelete) return false;
    array.pop();
    const oppositeSide = this._horizontalDir ? isNext ? St.Side.RIGHT : St.Side.LEFT : isNext ? St.Side.BOTTOM : St.Side.TOP;
    const extendTilesArray = isNext ? this._previousTiles : this._nextTiles;
    extendTilesArray.forEach((tileToExtend) => {
      tileToExtend.updateTile({
        x: !isNext && this._horizontalDir ? tileToDelete.tile.x : tileToExtend.tile.x,
        y: !isNext && !this._horizontalDir ? tileToDelete.tile.y : tileToExtend.tile.y,
        width: this._horizontalDir ? tileToExtend.tile.width + tileToDelete.tile.width : tileToExtend.tile.width,
        height: this._horizontalDir ? tileToExtend.tile.height : tileToExtend.tile.height + tileToDelete.tile.height,
        innerGaps,
        outerGaps
      });
      tileToExtend.removeSlider(oppositeSide);
      tileToDelete.getSlider(oppositeSide)?.addTile(tileToExtend);
    });
    return true;
  }

  vfunc_button_press_event(event) {
    return this._startDragging(event);
  }

  vfunc_button_release_event() {
    if (this._dragging) return this._endDragging();
    return Clutter.EVENT_PROPAGATE;
  }

  vfunc_motion_event(event) {
    if (this._dragging) {
      const [stageX, stageY] = getEventCoords(event);
      this._move(stageX, stageY);
      return Clutter.EVENT_STOP;
    }
    return Clutter.EVENT_PROPAGATE;
  }

  _startDragging(event) {
    if (this._dragging) return Clutter.EVENT_PROPAGATE;
    this._dragging = true;
    global.display.set_cursor(this.preferredCursor);
    this._grab = global.stage.grab(this);
    const [stageX, stageY] = getEventCoords(event);
    this._move(stageX, stageY);
    return Clutter.EVENT_STOP;
  }

  _endDragging() {
    if (this._dragging) {
      if (this._grab) {
        this._grab.dismiss();
        this._grab = null;
      }
      this._dragging = false;
      this._lastEventCoord = null;
    }
    global.display.set_cursor(this.preferredCursor);
    return Clutter.EVENT_STOP;
  }

  _move(eventX, eventY) {
    eventX = Math.round(eventX);
    eventY = Math.round(eventY);
    if (this._lastEventCoord !== null) {
      const movement = {
        x: this._horizontalDir ? eventX - this._lastEventCoord.x : 0,
        y: this._horizontalDir ? 0 : eventY - this._lastEventCoord.y
      };
      for (const prevTile of this._previousTiles) {
        if (prevTile.rect.width + movement.x < EditableTilePreview.MIN_TILE_SIZE || prevTile.rect.height + movement.y < EditableTilePreview.MIN_TILE_SIZE)
          return;
      }
      for (const nextTile of this._nextTiles) {
        if (nextTile.rect.width - movement.x < EditableTilePreview.MIN_TILE_SIZE || nextTile.rect.height - movement.y < EditableTilePreview.MIN_TILE_SIZE)
          return;
      }
      this.set_position(this.x + movement.x, this.y + movement.y);
      this.emit("slide", this._horizontalDir ? movement.x : movement.y);
    }
    this._lastEventCoord = { x: eventX, y: eventY };
  }

  _onDestroy() {
    this._signals.forEach(
      (ids, tile) => ids.forEach((id) => tile.disconnect(id))
    );
    this._minTileCoord = Number.MAX_VALUE;
    this._maxTileCoord = Number.MIN_VALUE;
    this._previousTiles = [];
    this._nextTiles = [];
    this._lastEventCoord = null;
    this._endDragging();
  }
};
registerGObjectClass(_Slider, {
  Signals: {
    slide: {
      param_types: [GObject.TYPE_INT]
      // movement
    }
  },
  GTypeName: "Slider"
});
let Slider = _Slider;
export {
  Slider as default
};
