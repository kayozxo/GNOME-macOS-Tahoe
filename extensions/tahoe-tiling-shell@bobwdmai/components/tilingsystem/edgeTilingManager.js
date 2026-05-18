import {
  buildRectangle,
  isPointInsideRect,
  clampPointInsideRect
} from "../../utils/ui.js";
import { GObject } from "../../gi/ext.js";
import Settings from "../../settings/settings.js";
import { EdgeTilingMode } from "../../settings/settings.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import { logger } from "../../utils/logger.js";
import GlobalState from "../../utils/globalState.js";
const TOP_EDGE_TILING_OFFSET = 8;
const QUARTER_PERCENTAGE = 0.5;
const _EdgeTilingManager = class _EdgeTilingManager extends GObject.Object {
  _workArea;
  _quarterActivationPercentage;
  _edgeTilingOffset;
  _currentLayout;
  _monitorIndex = 0;
  _workspaceIndex = 0;
  _debug;
  // activation zones
  _topLeft;
  _topRight;
  _bottomLeft;
  _bottomRight;
  _topCenter;
  _leftCenter;
  _rightCenter;
  // current active zone
  _activeEdgeTile;
  constructor(initialWorkArea) {
    super();
    this._workArea = buildRectangle();
    this._topLeft = buildRectangle();
    this._topRight = buildRectangle();
    this._bottomLeft = buildRectangle();
    this._bottomRight = buildRectangle();
    this._topCenter = buildRectangle();
    this._leftCenter = buildRectangle();
    this._rightCenter = buildRectangle();
    this._activeEdgeTile = null;
    this._currentLayout = null;
    this.workarea = initialWorkArea;
    this._quarterActivationPercentage = Settings.QUARTER_TILING_THRESHOLD;
    this._debug = logger("EdgeTilingManager");
    Settings.bind(
      Settings.KEY_QUARTER_TILING_THRESHOLD,
      this,
      "quarterActivationPercentage"
    );
    this._edgeTilingOffset = Settings.EDGE_TILING_OFFSET;
    Settings.bind(
      Settings.KEY_EDGE_TILING_OFFSET,
      this,
      "edgeTilingOffset"
    );
  }

  set quarterActivationPercentage(value) {
    this._quarterActivationPercentage = value / 100;
    this._updateActivationZones();
  }

  set edgeTilingOffset(value) {
    this._edgeTilingOffset = value;
  }

  set workarea(newWorkArea) {
    this._workArea.x = newWorkArea.x;
    this._workArea.y = newWorkArea.y;
    this._workArea.width = newWorkArea.width;
    this._workArea.height = newWorkArea.height;
    this._updateActivationZones();
  }

  set monitorIndex(index) {
    this._monitorIndex = index;
  }

  set workspaceIndex(index) {
    this._workspaceIndex = index;
    this._updateCurrentLayout();
  }

  _updateCurrentLayout() {
    this._currentLayout = GlobalState.get().getSelectedLayoutOfMonitor(
      this._monitorIndex,
      this._workspaceIndex
    );
  }

  _updateActivationZones() {
    const width = Math.ceil(
      this._workArea.width * this._quarterActivationPercentage
    );
    const height = Math.ceil(
      this._workArea.height * this._quarterActivationPercentage
    );
    this._topLeft.x = this._workArea.x;
    this._topLeft.y = this._workArea.y;
    this._topLeft.width = width;
    this._topLeft.height = height;
    this._topRight.x = this._workArea.x + this._workArea.width - this._topLeft.width;
    this._topRight.y = this._topLeft.y;
    this._topRight.width = width;
    this._topRight.height = height;
    this._bottomLeft.x = this._workArea.x;
    this._bottomLeft.y = this._workArea.y + this._workArea.height - height;
    this._bottomLeft.width = width;
    this._bottomLeft.height = height;
    this._bottomRight.x = this._topRight.x;
    this._bottomRight.y = this._bottomLeft.y;
    this._bottomRight.width = width;
    this._bottomRight.height = height;
    this._topCenter.x = this._topLeft.x + this._topLeft.width;
    this._topCenter.y = this._topRight.y;
    this._topCenter.height = this._topRight.height;
    this._topCenter.width = this._topRight.x - this._topCenter.x;
    this._leftCenter.x = this._topLeft.x;
    this._leftCenter.y = this._topLeft.y + this._topLeft.height;
    this._leftCenter.height = this._bottomLeft.y - this._leftCenter.y;
    this._leftCenter.width = this._topLeft.width;
    this._rightCenter.x = this._topRight.x;
    this._rightCenter.y = this._topRight.y + this._topRight.height;
    this._rightCenter.height = this._bottomRight.y - this._rightCenter.y;
    this._rightCenter.width = this._topRight.width;
  }

  canActivateEdgeTiling(pointerPos) {
    return pointerPos.x <= this._workArea.x + this._edgeTilingOffset || pointerPos.y <= this._workArea.y + TOP_EDGE_TILING_OFFSET || pointerPos.x >= this._workArea.x + this._workArea.width - this._edgeTilingOffset || pointerPos.y >= this._workArea.y + this._workArea.height - this._edgeTilingOffset;
  }

  isPerformingEdgeTiling() {
    return this._activeEdgeTile !== null;
  }

  startEdgeTiling(pointerPos) {
    const { x, y } = clampPointInsideRect(pointerPos, this._workArea);
    const previewRect = buildRectangle();
    if (this._activeEdgeTile && isPointInsideRect({ x, y }, this._activeEdgeTile)) {
      return {
        changed: false,
        rect: previewRect
      };
    }
    if (!this._activeEdgeTile) this._activeEdgeTile = buildRectangle();
    const edgeSnapMode = Settings.EDGE_TILING_MODE;
    previewRect.width = this._workArea.width * QUARTER_PERCENTAGE;
    previewRect.height = this._workArea.height * QUARTER_PERCENTAGE;
    previewRect.y = this._workArea.y;
    previewRect.x = this._workArea.x;
    switch (edgeSnapMode) {
      case EdgeTilingMode.DEFAULT:
        return this._handleDefaultEdgeTiling(x, y, previewRect);
      case EdgeTilingMode.ADAPTIVE:
        return this._handleAdaptiveEdgeTiling(x, y, previewRect);
      case EdgeTilingMode.GRANULAR:
        return this._handleGranularEdgeTiling(x, y, previewRect);
      default:
        return this._handleDefaultEdgeTiling(x, y, previewRect);
    }
  }

  _handleDefaultEdgeTiling(x, y, previewRect) {
    if (isPointInsideRect({ x, y }, this._topCenter)) {
      previewRect.width = this._workArea.width;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._topCenter;
    } else if (isPointInsideRect({ x, y }, this._leftCenter)) {
      previewRect.width = this._workArea.width * QUARTER_PERCENTAGE;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._leftCenter;
    } else if (isPointInsideRect({ x, y }, this._rightCenter)) {
      previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      previewRect.width = this._workArea.width * QUARTER_PERCENTAGE;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._rightCenter;
    } else if (x <= this._workArea.x + this._workArea.width / 2) {
      if (isPointInsideRect({ x, y }, this._topLeft)) {
        this._activeEdgeTile = this._topLeft;
      } else if (isPointInsideRect({ x, y }, this._bottomLeft)) {
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
        this._activeEdgeTile = this._bottomLeft;
      } else {
        return {
          changed: false,
          rect: previewRect
        };
      }
    } else {
      previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      if (isPointInsideRect({ x, y }, this._topRight)) {
        this._activeEdgeTile = this._topRight;
      } else if (isPointInsideRect({ x, y }, this._bottomRight)) {
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
        this._activeEdgeTile = this._bottomRight;
      } else {
        return {
          changed: false,
          rect: previewRect
        };
      }
    }
    return {
      changed: true,
      rect: previewRect
    };
  }

  _handleAdaptiveEdgeTiling(x, y, previewRect) {
    if (!this._currentLayout)
      return this._handleDefaultEdgeTiling(x, y, previewRect);
    if (isPointInsideRect({ x, y }, this._topCenter)) {
      previewRect.width = this._workArea.width;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._topCenter;
    } else if (isPointInsideRect({ x, y }, this._leftCenter)) {
      const leftColumnTiles = this._getLeftColumnTiles();
      if (leftColumnTiles.length > 0) {
        const minX = Math.min(...leftColumnTiles.map((tile) => tile.x));
        const exactLeftColumnTiles = leftColumnTiles.filter(
          (tile) => Math.abs(tile.x - minX) < 0.01
        );
        const newRect = this._createRectForColumnTiles(
          exactLeftColumnTiles,
          false
        );
        previewRect.x = this._workArea.x + this._workArea.width * minX;
        previewRect.y = newRect.y;
        previewRect.width = newRect.width;
        previewRect.height = newRect.height;
      }
      this._activeEdgeTile = this._leftCenter;
    } else if (isPointInsideRect({ x, y }, this._rightCenter)) {
      const rightColumnTiles = this._getRightColumnTiles();
      if (rightColumnTiles.length > 0) {
        const maxEndX = Math.max(
          ...rightColumnTiles.map((tile) => tile.x + tile.width)
        );
        const exactRightColumnTiles = rightColumnTiles.filter(
          (tile) => Math.abs(tile.x + tile.width - maxEndX) < 0.01
        );
        const newRect = this._createRectForColumnTiles(
          exactRightColumnTiles,
          true
        );
        const rightMostX = Math.min(
          ...exactRightColumnTiles.map((tile) => tile.x)
        );
        previewRect.x = this._workArea.x + this._workArea.width * rightMostX;
        previewRect.y = newRect.y;
        previewRect.width = newRect.width;
        previewRect.height = newRect.height;
      } else {
        previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      }
      this._activeEdgeTile = this._rightCenter;
    } else if (isPointInsideRect({ x, y }, this._topLeft)) {
      const topLeftTile = this._findTileAtCorner("top-left");
      if (topLeftTile) {
        previewRect.width = this._workArea.width * topLeftTile.width;
        previewRect.height = this._workArea.height * topLeftTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * topLeftTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * topLeftTile.y;
      }
      this._activeEdgeTile = this._topLeft;
    } else if (isPointInsideRect({ x, y }, this._bottomLeft)) {
      const bottomLeftTile = this._findTileAtCorner("bottom-left");
      if (bottomLeftTile) {
        previewRect.width = this._workArea.width * bottomLeftTile.width;
        previewRect.height = this._workArea.height * bottomLeftTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * bottomLeftTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * bottomLeftTile.y;
      } else {
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
      }
      this._activeEdgeTile = this._bottomLeft;
    } else if (isPointInsideRect({ x, y }, this._topRight)) {
      const topRightTile = this._findTileAtCorner("top-right");
      if (topRightTile) {
        previewRect.width = this._workArea.width * topRightTile.width;
        previewRect.height = this._workArea.height * topRightTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * topRightTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * topRightTile.y;
      } else {
        previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      }
      this._activeEdgeTile = this._topRight;
    } else if (isPointInsideRect({ x, y }, this._bottomRight)) {
      const bottomRightTile = this._findTileAtCorner("bottom-right");
      if (bottomRightTile) {
        previewRect.width = this._workArea.width * bottomRightTile.width;
        previewRect.height = this._workArea.height * bottomRightTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * bottomRightTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * bottomRightTile.y;
      } else {
        previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
      }
      this._activeEdgeTile = this._bottomRight;
    } else {
      return {
        changed: false,
        rect: previewRect
      };
    }
    return {
      changed: true,
      rect: previewRect
    };
  }

  _handleGranularEdgeTiling(x, y, previewRect) {
    if (!this._currentLayout)
      return this._handleDefaultEdgeTiling(x, y, previewRect);
    if (isPointInsideRect({ x, y }, this._topCenter)) {
      previewRect.width = this._workArea.width;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._topCenter;
    } else if (isPointInsideRect({ x, y }, this._leftCenter)) {
      const leftTile = this._findExactTileAtEdge("left", { x, y });
      if (leftTile) {
        const newRect = this._createRectForSingleTile(leftTile);
        previewRect.x = newRect.x;
        previewRect.y = newRect.y;
        previewRect.width = newRect.width;
        previewRect.height = newRect.height;
      }
      this._activeEdgeTile = this._leftCenter;
    } else if (isPointInsideRect({ x, y }, this._rightCenter)) {
      const rightTile = this._findExactTileAtEdge("right", { x, y });
      if (rightTile) {
        const newRect = this._createRectForSingleTile(rightTile);
        previewRect.x = newRect.x;
        previewRect.y = newRect.y;
        previewRect.width = newRect.width;
        previewRect.height = newRect.height;
      } else {
        previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      }
      this._activeEdgeTile = this._rightCenter;
    } else if (isPointInsideRect({ x, y }, this._topLeft)) {
      const topLeftTile = this._findTileAtCorner("top-left");
      if (topLeftTile) {
        previewRect.width = this._workArea.width * topLeftTile.width;
        previewRect.height = this._workArea.height * topLeftTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * topLeftTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * topLeftTile.y;
      }
      this._activeEdgeTile = this._topLeft;
    } else if (isPointInsideRect({ x, y }, this._bottomLeft)) {
      const bottomLeftTile = this._findTileAtCorner("bottom-left");
      if (bottomLeftTile) {
        previewRect.width = this._workArea.width * bottomLeftTile.width;
        previewRect.height = this._workArea.height * bottomLeftTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * bottomLeftTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * bottomLeftTile.y;
      } else {
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
      }
      this._activeEdgeTile = this._bottomLeft;
    } else if (isPointInsideRect({ x, y }, this._topRight)) {
      const topRightTile = this._findTileAtCorner("top-right");
      if (topRightTile) {
        previewRect.width = this._workArea.width * topRightTile.width;
        previewRect.height = this._workArea.height * topRightTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * topRightTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * topRightTile.y;
      } else {
        previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      }
      this._activeEdgeTile = this._topRight;
    } else if (isPointInsideRect({ x, y }, this._bottomRight)) {
      const bottomRightTile = this._findTileAtCorner("bottom-right");
      if (bottomRightTile) {
        previewRect.width = this._workArea.width * bottomRightTile.width;
        previewRect.height = this._workArea.height * bottomRightTile.height;
        previewRect.x = this._workArea.x + this._workArea.width * bottomRightTile.x;
        previewRect.y = this._workArea.y + this._workArea.height * bottomRightTile.y;
      } else {
        previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
      }
      this._activeEdgeTile = this._bottomRight;
    } else {
      return {
        changed: false,
        rect: previewRect
      };
    }
    return {
      changed: true,
      rect: previewRect
    };
  }

  _getLeftColumnTiles() {
    if (!this._currentLayout) return [];
    return this._currentLayout.tiles.filter(
      (tile) => Math.abs(tile.x) < 0.01
      // Tiles starting at x=0
    );
  }

  _getRightColumnTiles() {
    if (!this._currentLayout) return [];
    return this._currentLayout.tiles.filter(
      (tile) => Math.abs(tile.x + tile.width - 1) < 0.01
      // Tiles ending at x=1
    );
  }

  _createRectForColumnTiles(tiles, isRightSide = false) {
    const rect = buildRectangle();
    rect.y = this._workArea.y;
    if (tiles.length === 0) {
      rect.width = this._workArea.width * QUARTER_PERCENTAGE;
      rect.height = this._workArea.height;
      if (isRightSide)
        rect.x = this._workArea.x + this._workArea.width - rect.width;
      else rect.x = this._workArea.x;
      return rect;
    }
    const minX = Math.min(...tiles.map((tile) => tile.x));
    const maxWidth = Math.max(...tiles.map((tile) => tile.width));
    rect.width = this._workArea.width * maxWidth;
    rect.height = this._workArea.height;
    rect.x = this._workArea.x + this._workArea.width * minX;
    return rect;
  }

  _findTileAtCorner(corner) {
    if (!this._currentLayout) return null;
    switch (corner) {
      case "top-left":
        return this._currentLayout.tiles.find(
          (tile) => Math.abs(tile.x) < 0.01 && Math.abs(tile.y) < 0.01
        );
      case "top-right":
        return this._currentLayout.tiles.find(
          (tile) => Math.abs(tile.x + tile.width - 1) < 0.01 && Math.abs(tile.y) < 0.01
        );
      case "bottom-left":
        return this._currentLayout.tiles.find(
          (tile) => Math.abs(tile.x) < 0.01 && Math.abs(tile.y + tile.height - 1) < 0.01
        );
      case "bottom-right":
        return this._currentLayout.tiles.find(
          (tile) => Math.abs(tile.x + tile.width - 1) < 0.01 && Math.abs(tile.y + tile.height - 1) < 0.01
        );
    }
    return null;
  }

  needMaximize() {
    return this._activeEdgeTile !== null && Settings.TOP_EDGE_MAXIMIZE && this._activeEdgeTile === this._topCenter;
  }

  abortEdgeTiling() {
    this._activeEdgeTile = null;
  }

  _findClosestTileToPosition(pointerPos, candidateTiles) {
    if (!candidateTiles.length) return null;
    const relativeY = (pointerPos.y - this._workArea.y) / this._workArea.height;
    const containingTiles = candidateTiles.filter(
      (tile) => relativeY >= tile.y && relativeY <= tile.y + tile.height
    );
    if (containingTiles.length === 0) {
      return candidateTiles.reduce(
        (closest, tile) => {
          const tileCenter = {
            x: tile.x + tile.width / 2,
            y: tile.y + tile.height / 2
          };
          const tileCenterPx = {
            x: this._workArea.x + tileCenter.x * this._workArea.width,
            y: this._workArea.y + tileCenter.y * this._workArea.height
          };
          const distance = Math.sqrt(
            Math.pow(pointerPos.x - tileCenterPx.x, 2) + Math.pow(pointerPos.y - tileCenterPx.y, 2)
          );
          if (!closest) return tile;
          const closestCenter = {
            x: closest.x + closest.width / 2,
            y: closest.y + closest.height / 2
          };
          const closestCenterPx = {
            x: this._workArea.x + closestCenter.x * this._workArea.width,
            y: this._workArea.y + closestCenter.y * this._workArea.height
          };
          const closestDistance = Math.sqrt(
            Math.pow(pointerPos.x - closestCenterPx.x, 2) + Math.pow(pointerPos.y - closestCenterPx.y, 2)
          );
          return distance < closestDistance ? tile : closest;
        },
        null
      );
    }
    if (containingTiles.length > 1) {
      return containingTiles.reduce(
        (closest, tile) => {
          const tileCenterX = this._workArea.x + (tile.x + tile.width / 2) * this._workArea.width;
          const distance = Math.abs(pointerPos.x - tileCenterX);
          if (!closest) return tile;
          const closestCenterX = this._workArea.x + (closest.x + closest.width / 2) * this._workArea.width;
          const closestDistance = Math.abs(
            pointerPos.x - closestCenterX
          );
          return distance < closestDistance ? tile : closest;
        },
        null
      );
    }
    return containingTiles[0];
  }

  _createRectForSingleTile(tile) {
    const rect = buildRectangle();
    if (!tile) {
      rect.width = this._workArea.width * QUARTER_PERCENTAGE;
      rect.height = this._workArea.height * QUARTER_PERCENTAGE;
      rect.x = this._workArea.x;
      rect.y = this._workArea.y;
      return rect;
    }
    rect.width = this._workArea.width * tile.width;
    rect.height = this._workArea.height * tile.height;
    rect.x = this._workArea.x + this._workArea.width * tile.x;
    rect.y = this._workArea.y + this._workArea.height * tile.y;
    return rect;
  }

  _findTilesAtEdge(edge) {
    if (!this._currentLayout) return [];
    const tiles = this._currentLayout.tiles.filter((tile) => {
      switch (edge) {
        case "left":
          return Math.abs(tile.x) < 0.01;
        case "right":
          return Math.abs(tile.x + tile.width - 1) < 0.01;
        case "top":
          return Math.abs(tile.y) < 0.01;
        case "bottom":
          return Math.abs(tile.y + tile.height - 1) < 0.01;
      }
      return false;
    });
    return tiles;
  }

  _findExactTileAtEdge(edge, pointerPos) {
    const edgeTiles = this._findTilesAtEdge(edge);
    if (edgeTiles.length === 0) return null;
    const relativeX = (pointerPos.x - this._workArea.x) / this._workArea.width;
    const relativeY = (pointerPos.y - this._workArea.y) / this._workArea.height;
    for (const tile of edgeTiles) {
      const tileMinY = tile.y;
      const tileMaxY = tile.y + tile.height;
      const tileMinX = tile.x;
      const tileMaxX = tile.x + tile.width;
      if (edge === "left" || edge === "right") {
        if (relativeY >= tileMinY && relativeY <= tileMaxY) return tile;
      } else if (relativeX >= tileMinX && relativeX <= tileMaxX) {
        return tile;
      }
    }
    return this._findClosestTileToPosition(pointerPos, edgeTiles);
  }
};
registerGObjectClass(_EdgeTilingManager, {
  GTypeName: "EdgeTilingManager",
  Properties: {
    quarterActivationPercentage: GObject.ParamSpec.uint(
      "quarterActivationPercentage",
      "quarterActivationPercentage",
      "Threshold to trigger quarter tiling",
      GObject.ParamFlags.READWRITE,
      1,
      50,
      40
    ),
    edgeTilingOffset: GObject.ParamSpec.uint(
      "edgeTilingOffset",
      "edgeTilingOffset",
      "Offset to trigger edge tiling",
      GObject.ParamFlags.READWRITE,
      1,
      250,
      16
    )
  }
});
let EdgeTilingManager = _EdgeTilingManager;
export {
  EdgeTilingManager as default
};
