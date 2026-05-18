import { registerGObjectClass } from "../../utils/gjs.js";
import { Clutter } from "../../gi/ext.js";
import TilePreview from "../tilepreview/tilePreview.js";
import LayoutWidget from "../layout/LayoutWidget.js";
import {
  buildRectangle,
  buildTileGaps,
  isPointInsideRect,
  squaredEuclideanDistance
} from "../../utils/ui.js";
import TileUtils from "../../components/layout/TileUtils.js";
import GlobalState from "../../utils/globalState.js";
import { KeyBindingsDirection } from "../../keybindings.js";
const _DynamicTilePreview = class _DynamicTilePreview extends TilePreview {
  _originalRect;
  _canRestore;
  constructor(params, canRestore) {
    super(params);
    this._canRestore = canRestore || false;
    this._originalRect = this.rect.copy();
  }

  get originalRect() {
    return this._originalRect;
  }

  get canRestore() {
    return this._canRestore;
  }

  restore(ease = false) {
    if (!this._canRestore) return false;
    this._rect = this._originalRect.copy();
    if (this.showing) this.open(void 0, ease);
    return true;
  }
};
registerGObjectClass(_DynamicTilePreview);
let DynamicTilePreview = _DynamicTilePreview;
const _TilingLayout = class _TilingLayout extends LayoutWidget {
  _showing;
  constructor(layout, innerGaps, outerGaps, workarea, scalingFactor) {
    super({
      containerRect: workarea,
      parent: global.windowGroup,
      layout,
      innerGaps,
      outerGaps,
      scalingFactor
    });
    this._showing = false;
    super.relayout();
  }

  _init() {
    super._init();
    this.hide();
  }

  buildTile(parent, rect, gaps, tile) {
    const prev = new DynamicTilePreview({ parent, rect, gaps, tile }, true);
    prev.updateBorderRadius(
      prev.gaps.top > 0,
      prev.gaps.right > 0,
      prev.gaps.bottom > 0,
      prev.gaps.left > 0
    );
    return prev;
  }

  get showing() {
    return this._showing;
  }

  openBelow(window) {
    if (this._showing) return;
    const windowActor = window.get_compositor_private();
    if (!windowActor) return;
    global.windowGroup.set_child_below_sibling(this, windowActor);
    this.open();
  }

  openAbove(_window) {
    if (this._showing) return;
    global.windowGroup.set_child_above_sibling(this, null);
    this.open();
  }

  open(ease = false) {
    if (this._showing) return;
    this.show();
    this._showing = true;
    this.ease({
      x: this.x,
      y: this.y,
      opacity: 255,
      duration: ease ? GlobalState.get().tilePreviewAnimationTime : 0,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD
    });
  }

  close(ease = false) {
    if (!this._showing) return;
    this._showing = false;
    this.ease({
      opacity: 0,
      duration: ease ? GlobalState.get().tilePreviewAnimationTime : 0,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        this.unhoverAllTiles();
        this.hide();
      }
    });
  }

  _isHovered(currPointerPos, preview) {
    return currPointerPos.x >= preview.x && currPointerPos.x <= preview.x + preview.width && currPointerPos.y >= preview.y && currPointerPos.y <= preview.y + preview.height;
  }

  getTileBelow(currPointerPos, reset) {
    let found = this._previews.find(
      (preview) => this._isHovered(currPointerPos, preview.rect)
    );
    if (!found || !found.canRestore && reset) {
      found = this._previews.find(
        (preview) => preview.canRestore && this._isHovered(currPointerPos, preview.originalRect)
      );
    }
    if (!found) return void 0;
    if (reset && found.originalRect) return found.originalRect;
    return found.rect;
  }

  unhoverAllTiles() {
    const newPreviewsArray = [];
    this._previews.forEach((preview) => {
      if (preview.restore(true)) {
        newPreviewsArray.push(preview);
        preview.open(void 0, true);
      } else {
        this.remove_child(preview);
        preview.destroy();
      }
    });
    this._previews = newPreviewsArray;
  }

  hoverTilesInRect(rect, reset) {
    const newPreviewsArray = [];
    this._previews.forEach((preview) => {
      const [hasIntersection, rectangles] = this._subtractRectangles(
        preview.rect,
        rect
      );
      if (hasIntersection) {
        if (rectangles.length > 0) {
          let maxIndex = 0;
          for (let i = 0; i < rectangles.length; i++) {
            if (rectangles[i].area() > rectangles[maxIndex].area())
              maxIndex = i;
          }
          for (let i = 0; i < rectangles.length; i++) {
            if (i === maxIndex) continue;
            const currRect = rectangles[i];
            const gaps = buildTileGaps(
              currRect,
              this._innerGaps,
              this._outerGaps,
              this._containerRect
            ).gaps;
            const innerPreview = new DynamicTilePreview(
              {
                parent: this,
                rect: currRect,
                gaps,
                tile: TileUtils.build_tile(
                  currRect,
                  this._containerRect
                )
              },
              false
            );
            innerPreview.open();
            this.set_child_above_sibling(innerPreview, preview);
            newPreviewsArray.push(innerPreview);
          }
          preview.open(
            rectangles[maxIndex].union(
              preview.rect.intersect(rect)[1]
            ),
            false
          );
          preview.open(rectangles[maxIndex], true);
          newPreviewsArray.push(preview);
        } else {
          preview.close();
          newPreviewsArray.push(preview);
        }
      } else if (reset) {
        if (preview.restore(true)) {
          preview.open(void 0, true);
          newPreviewsArray.push(preview);
        } else {
          this.remove_child(preview);
          preview.destroy();
        }
      } else {
        preview.open(void 0, true);
        newPreviewsArray.push(preview);
      }
    });
    this._previews = newPreviewsArray;
  }

  /*
          Given the source rectangle (made by A, B, C, D and Hole), subtract the hole and obtain A, B, C and D.
          Edge cases:
              - The hole may not be inside the source rect (i.e there is no interstaction).
              It returns false and an array with the source rectangle only
              - The hole intersects the source rectangle, it returns true and an array with A, B, C and D rectangles.
              Some of A, B, C and D may not be returned if they don't exist
              - The hole is equal to the source rectangle, it returns true and an empty array since A, B, C and D
              rectangles do not exist
  
          Example:
          -------------------------
          |          A            |
          |-----------------------|
          |  B  |   hole    |  C  |
          |-----------------------|
          |          D            |
          -------------------------
      */
  _subtractRectangles(sourceRect, holeRect) {
    const [hasIntersection, intersection] = sourceRect.intersect(holeRect);
    if (!hasIntersection) return [false, [sourceRect]];
    if (intersection.area() >= sourceRect.area() * 0.98) return [true, []];
    const results = [];
    const heightA = intersection.y - sourceRect.y;
    if (heightA > 0) {
      results.push(
        buildRectangle({
          x: sourceRect.x,
          y: sourceRect.y,
          width: sourceRect.width,
          height: heightA
        })
      );
    }
    const widthB = intersection.x - sourceRect.x;
    if (widthB > 0 && intersection.height > 0) {
      results.push(
        buildRectangle({
          x: sourceRect.x,
          y: intersection.y,
          width: widthB,
          height: intersection.height
        })
      );
    }
    const widthC = sourceRect.x + sourceRect.width - intersection.x - intersection.width;
    if (widthC > 0 && intersection.height > 0) {
      results.push(
        buildRectangle({
          x: intersection.x + intersection.width,
          y: intersection.y,
          width: widthC,
          height: intersection.height
        })
      );
    }
    const heightD = sourceRect.y + sourceRect.height - intersection.y - intersection.height;
    if (heightD > 0) {
      results.push(
        buildRectangle({
          x: sourceRect.x,
          y: intersection.y + intersection.height,
          width: sourceRect.width,
          height: heightD
        })
      );
    }
    return [true, results];
  }

  // enlarge the side of the direction and search a tile that contains that point
  // clamp to ensure we do not go outside of the container area (e.g. the screen)
  findNearestTileDirection(source, direction, clamp, enlarge) {
    if (direction === KeyBindingsDirection.NODIRECTION) return void 0;
    const sourceCoords = {
      x: source.x + source.width / 2,
      y: source.y + source.height / 2
    };
    switch (direction) {
      case KeyBindingsDirection.RIGHT:
        sourceCoords.x = source.x + source.width + enlarge;
        break;
      case KeyBindingsDirection.LEFT:
        sourceCoords.x = source.x - enlarge;
        break;
      case KeyBindingsDirection.DOWN:
        sourceCoords.y = source.y + source.height + enlarge;
        break;
      case KeyBindingsDirection.UP:
        sourceCoords.y = source.y - enlarge;
        break;
    }
    if (sourceCoords.x < this._containerRect.x || sourceCoords.x > this._containerRect.width + this._containerRect.x || sourceCoords.y < this._containerRect.y || sourceCoords.y > this._containerRect.height + this._containerRect.y) {
      if (!clamp) return void 0;
      sourceCoords.x = Math.clamp(
        sourceCoords.x,
        this._containerRect.x,
        this._containerRect.width + this._containerRect.x
      );
      sourceCoords.y = Math.clamp(
        sourceCoords.y,
        this._containerRect.y,
        this._containerRect.height + this._containerRect.y
      );
    }
    for (let i = 0; i < this._previews.length; i++) {
      const previewFound = this._previews[i];
      if (isPointInsideRect(sourceCoords, previewFound.rect)) {
        return {
          rect: buildRectangle({
            x: previewFound.innerX,
            y: previewFound.innerY,
            width: previewFound.innerWidth,
            height: previewFound.innerHeight
          }),
          tile: previewFound.tile
        };
      }
    }
    return void 0;
  }

  findNearestTile(source) {
    let previewFound;
    let bestDistance = -1;
    const sourceCenter = {
      x: source.x + source.width / 2,
      y: source.x + source.height / 2
    };
    for (let i = 0; i < this._previews.length; i++) {
      const preview = this._previews[i];
      const previewCenter = {
        x: preview.innerX + preview.innerWidth / 2,
        y: preview.innerY + preview.innerHeight / 2
      };
      const euclideanDistance = squaredEuclideanDistance(
        previewCenter,
        sourceCenter
      );
      if (!previewFound || euclideanDistance < bestDistance) {
        previewFound = preview;
        bestDistance = euclideanDistance;
      }
    }
    if (!previewFound) return void 0;
    return {
      rect: buildRectangle({
        x: previewFound.innerX,
        y: previewFound.innerY,
        width: previewFound.innerWidth,
        height: previewFound.innerHeight
      }),
      tile: previewFound.tile
    };
  }
};
registerGObjectClass(_TilingLayout);
let TilingLayout = _TilingLayout;
export {
  TilingLayout as default
};
