import { St, Meta } from "../../gi/ext.js";
import SignalHandling from "../../utils/signalHandling.js";
import Settings from "../../settings/settings.js";
import { getWindows } from "../../utils/ui.js";

class ResizingManager {
  _signals;
  constructor() {
    this._signals = null;
  }

  enable() {
    if (this._signals) this._signals.disconnect();
    this._signals = new SignalHandling();
    this._signals.connect(
      global.display,
      "grab-op-begin",
      (_display, window, grabOp) => {
        const moving = grabOp === Meta.GrabOp.KEYBOARD_MOVING || grabOp === Meta.GrabOp.MOVING;
        if (moving || !Settings.RESIZE_COMPLEMENTING_WINDOWS) return;
        this._onWindowResizingBegin(window, grabOp & ~1024);
      }
    );
    this._signals.connect(
      global.display,
      "grab-op-end",
      (_display, window, grabOp) => {
        const moving = grabOp === Meta.GrabOp.KEYBOARD_MOVING || grabOp === Meta.GrabOp.MOVING;
        if (moving) return;
        this._onWindowResizingEnd(window);
      }
    );
  }

  destroy() {
    if (this._signals) this._signals.disconnect();
  }

  _onWindowResizingBegin(window, grabOp) {
    if (!window || !window.assignedTile || !this._signals)
      return;
    const verticalSide = [false, 0];
    const horizontalSide = [false, 0];
    switch (grabOp) {
      case Meta.GrabOp.RESIZING_N:
      case Meta.GrabOp.RESIZING_NE:
      case Meta.GrabOp.RESIZING_NW:
      case Meta.GrabOp.KEYBOARD_RESIZING_N:
      case Meta.GrabOp.KEYBOARD_RESIZING_NE:
      case Meta.GrabOp.KEYBOARD_RESIZING_NW:
        verticalSide[0] = true;
        verticalSide[1] = St.Side.TOP;
        break;
      case Meta.GrabOp.RESIZING_S:
      case Meta.GrabOp.RESIZING_SE:
      case Meta.GrabOp.RESIZING_SW:
      case Meta.GrabOp.KEYBOARD_RESIZING_S:
      case Meta.GrabOp.KEYBOARD_RESIZING_SE:
      case Meta.GrabOp.KEYBOARD_RESIZING_SW:
        verticalSide[0] = true;
        verticalSide[1] = St.Side.BOTTOM;
        break;
    }
    switch (grabOp) {
      case Meta.GrabOp.RESIZING_E:
      case Meta.GrabOp.RESIZING_NE:
      case Meta.GrabOp.RESIZING_SE:
      case Meta.GrabOp.KEYBOARD_RESIZING_E:
      case Meta.GrabOp.KEYBOARD_RESIZING_NE:
      case Meta.GrabOp.KEYBOARD_RESIZING_SE:
        horizontalSide[0] = true;
        horizontalSide[1] = St.Side.RIGHT;
        break;
      case Meta.GrabOp.RESIZING_W:
      case Meta.GrabOp.RESIZING_NW:
      case Meta.GrabOp.RESIZING_SW:
      case Meta.GrabOp.KEYBOARD_RESIZING_W:
      case Meta.GrabOp.KEYBOARD_RESIZING_NW:
      case Meta.GrabOp.KEYBOARD_RESIZING_SW:
        horizontalSide[0] = true;
        horizontalSide[1] = St.Side.LEFT;
        break;
    }
    if (!verticalSide[0] && !horizontalSide[0]) return;
    const otherTiledWindows = getWindows().filter(
      (otherWindow) => otherWindow && otherWindow.assignedTile && otherWindow !== window && !otherWindow.minimized
    );
    if (otherTiledWindows.length === 0) return;
    const verticalAdjacentWindows = verticalSide[0] ? this._findAdjacent(
      window,
      verticalSide[1],
      new Set(otherTiledWindows)
    ) : [];
    const horizontalAdjacentWindows = horizontalSide[0] ? this._findAdjacent(
      window,
      horizontalSide[1],
      new Set(otherTiledWindows)
    ) : [];
    const windowsMap = /* @__PURE__ */ new Map();
    verticalAdjacentWindows.forEach(([otherWin, sideOtherWin]) => {
      windowsMap.set(otherWin, [
        otherWin,
        otherWin.get_frame_rect().copy(),
        sideOtherWin,
        // resize vertically
        -1
        // resize horizontally
      ]);
    });
    horizontalAdjacentWindows.forEach(([otherWin, sideOtherWin]) => {
      const val = windowsMap.get(otherWin);
      if (val) {
        val[3] = sideOtherWin;
      } else {
        windowsMap.set(otherWin, [
          otherWin,
          otherWin.get_frame_rect().copy(),
          -1,
          // resize vertically
          sideOtherWin
          // resize horizontally
        ]);
      }
    });
    const windowsToResize = Array.from(windowsMap.values());
    this._signals.connect(
      window,
      "size-changed",
      this._onResizingWindow.bind(
        this,
        window,
        window.get_frame_rect().copy(),
        verticalSide[1],
        horizontalSide[1],
        windowsToResize
      )
    );
  }

  _oppositeSide(side) {
    switch (side) {
      case St.Side.TOP:
        return St.Side.BOTTOM;
      case St.Side.BOTTOM:
        return St.Side.TOP;
      case St.Side.LEFT:
        return St.Side.RIGHT;
    }
    return St.Side.LEFT;
  }

  _findAdjacent(window, side, remainingWindows) {
    const result = [];
    const adjacentWindows = [];
    const windowRect = window.get_frame_rect();
    const borderRect = windowRect.copy();
    const innerGaps = Settings.get_inner_gaps();
    if (innerGaps.top === 0) innerGaps.top = 2;
    if (innerGaps.bottom === 0) innerGaps.bottom = 2;
    if (innerGaps.left === 0) innerGaps.left = 2;
    if (innerGaps.right === 0) innerGaps.right = 2;
    const errorFactor = innerGaps.right * 4;
    switch (side) {
      case St.Side.TOP:
        borderRect.height = innerGaps.top + errorFactor;
        borderRect.y -= innerGaps.top + errorFactor;
        break;
      case St.Side.BOTTOM:
        borderRect.y += borderRect.height;
        borderRect.height = innerGaps.bottom + errorFactor;
        break;
      case St.Side.LEFT:
        borderRect.width = innerGaps.left + errorFactor;
        borderRect.x -= innerGaps.left + errorFactor;
        break;
      case St.Side.RIGHT:
        borderRect.x += borderRect.width;
        borderRect.width = innerGaps.right + errorFactor;
        break;
    }
    const oppositeSide = this._oppositeSide(side);
    const newRemainingWindows = /* @__PURE__ */ new Set();
    remainingWindows.forEach((otherWin) => {
      const otherWinRect = otherWin.get_frame_rect();
      let [hasIntersection, intersection] = otherWin.get_frame_rect().intersect(borderRect);
      switch (side) {
        case St.Side.RIGHT:
          hasIntersection && (hasIntersection = intersection.x <= otherWinRect.x);
          break;
        case St.Side.LEFT:
          hasIntersection && (hasIntersection = intersection.x + intersection.width >= otherWinRect.x + otherWinRect.width);
          break;
        case St.Side.BOTTOM:
          hasIntersection && (hasIntersection = intersection.y <= otherWinRect.y);
          break;
        case St.Side.TOP:
          hasIntersection && (hasIntersection = intersection.y + intersection.height >= otherWinRect.y + otherWinRect.height);
          break;
      }
      if (hasIntersection) {
        result.push([otherWin, oppositeSide]);
        adjacentWindows.push(otherWin);
      } else {
        newRemainingWindows.add(otherWin);
      }
    });
    adjacentWindows.forEach((otherWin) => {
      this._findAdjacent(
        otherWin,
        oppositeSide,
        newRemainingWindows
      ).forEach((recursionResult) => {
        result.push(recursionResult);
        newRemainingWindows.delete(recursionResult[0]);
      });
    });
    return result;
  }

  _onWindowResizingEnd(window) {
    if (this._signals) this._signals.disconnect(window);
  }

  _onResizingWindow(window, startingRect, resizeVerticalSide, resizeHorizontalSide, windowsToResize) {
    const currentRect = window.get_frame_rect();
    const resizedRect = {
      x: currentRect.x - startingRect.x,
      y: currentRect.y - startingRect.y,
      width: currentRect.width - startingRect.width,
      height: currentRect.height - startingRect.height
    };
    windowsToResize.forEach(
      ([otherWindow, otherWindowRect, verticalSide, horizontalSide]) => {
        const isSameVerticalSide = verticalSide !== -1 && verticalSide === resizeVerticalSide;
        const isSameHorizontalSide = horizontalSide !== -1 && horizontalSide === resizeHorizontalSide;
        const rect = [
          otherWindowRect.x,
          otherWindowRect.y,
          otherWindowRect.width,
          otherWindowRect.height
        ];
        if (horizontalSide === St.Side.LEFT) {
          rect[2] = otherWindowRect.width - (isSameHorizontalSide ? resizedRect.x : resizedRect.width);
          rect[0] = otherWindowRect.x + (isSameHorizontalSide ? resizedRect.x : resizedRect.width);
        } else if (horizontalSide === St.Side.RIGHT) {
          rect[2] = otherWindowRect.width + (isSameHorizontalSide ? resizedRect.width : resizedRect.x);
        }
        if (verticalSide === St.Side.TOP) {
          rect[3] = otherWindowRect.height - (isSameVerticalSide ? resizedRect.y : resizedRect.height);
          rect[1] = otherWindowRect.y + (isSameVerticalSide ? resizedRect.y : resizedRect.height);
        } else if (verticalSide === St.Side.BOTTOM) {
          rect[3] = otherWindowRect.height + (isSameVerticalSide ? resizedRect.height : resizedRect.y);
        }
        otherWindow.move_resize_frame(
          false,
          Math.max(0, rect[0]),
          Math.max(0, rect[1]),
          Math.max(0, rect[2]),
          Math.max(0, rect[3])
        );
      }
    );
  }
}

export {
  ResizingManager
};
