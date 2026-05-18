import { registerGObjectClass } from "../../utils/gjs.js";
import { Clutter } from "../../gi/ext.js";
import Layout from "../layout/Layout.js";
import { buildRectangle, isPointInsideRect } from "../../utils/ui.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import GlobalState from "../../utils/globalState.js";
import SuggestedWindowPreview from "./suggestedWindowPreview.js";
import Tile from "../../components/layout/Tile.js";
import LayoutWidget from "../../components/layout/LayoutWidget.js";
import SignalHandling from "../../utils/signalHandling.js";
import SuggestionsTilePreview from "../../components/windowsSuggestions/suggestionsTilePreview.js";
import TilingShellWindowManager from "../../components/windowManager/tilingShellWindowManager.js";
import { getEventCoords, unmaximizeWindow } from "../../utils/gnomesupport.js";
import TouchEventHelper from "../../utils/touch.js";
const ANIMATION_SPEED = 200;
const MASONRY_LAYOUT_ROW_HEIGHT = 0.31;
const _TilingLayoutWithSuggestions = class _TilingLayoutWithSuggestions extends LayoutWidget {
  _signals;
  _lastTiledWindow;
  _showing;
  _oldPreviews;
  _touchHelper;
  constructor(innerGaps, outerGaps, containerRect, scalingFactor) {
    super({
      containerRect,
      parent: global.windowGroup,
      layout: new Layout([], ""),
      innerGaps,
      outerGaps,
      scalingFactor
    });
    this.canFocus = true;
    this.reactive = true;
    this._signals = new SignalHandling();
    this._lastTiledWindow = null;
    this._showing = false;
    this._oldPreviews = [];
    this.connect("destroy", () => this._signals.disconnect());
    this._touchHelper = new TouchEventHelper();
  }

  buildTile(parent, rect, gaps, tile) {
    return new SuggestionsTilePreview({
      parent,
      rect,
      gaps,
      tile
    });
  }

  open(tiledWindows, nontiledWindows, window, windowDesiredRect, monitorIndex) {
    if (this._showing) return;
    this._showing = true;
    this._lastTiledWindow = global.display.focusWindow;
    this._showVacantPreviewsOnly(tiledWindows, windowDesiredRect, window);
    this.show();
    this._recursivelyShowPopup(nontiledWindows, monitorIndex);
    this._signals.disconnect();
    this._signals.connect(this, "key-focus-out", () => this.close());
    this._signals.connect(
      this,
      "touch-event",
      (_, event) => {
        if (event.type() === Clutter.EventType.TOUCH_END) {
          this.close();
          return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
      }
    );
    this._signals.connect(this, "button-release-event", () => {
      this.close();
    });
    this._signals.connect(
      global.stage,
      "key-press-event",
      (_, event) => {
        const symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Escape) this.close();
        return Clutter.EVENT_PROPAGATE;
      }
    );
  }

  _showVacantPreviewsOnly(tiledWindows, windowDesiredRect, window) {
    const vacantPreviews = this._previews.map((prev) => {
      const previewRect = buildRectangle({
        x: prev.innerX,
        y: prev.innerY,
        width: prev.innerWidth,
        height: prev.innerHeight
      });
      return !tiledWindows.find(
        (win) => previewRect.overlap(
          win === window ? windowDesiredRect : win.get_frame_rect()
        )
      );
    });
    const newPreviews = [];
    for (let index = 0; index < this._previews.length; index++) {
      if (vacantPreviews[index]) {
        this._previews[index].open();
        newPreviews.push(this._previews[index]);
      } else {
        this._previews[index].close();
        this._oldPreviews.push(this._previews[index]);
      }
    }
    this._previews = newPreviews;
  }

  _recursivelyShowPopup(nontiledWindows, monitorIndex) {
    if (this._previews.length === 0 || nontiledWindows.length === 0) {
      this.close();
      return;
    }
    let preview = this._previews[0];
    this._previews.forEach((prev) => {
      if (prev.x < preview.x) preview = prev;
    });
    const clones = nontiledWindows.map((nonTiledWin) => {
      const winClone = new SuggestedWindowPreview(nonTiledWin);
      const winActor = nonTiledWin.get_compositor_private();
      winActor.set_pivot_point(0.5, 0.5);
      if (!nonTiledWin.minimized) {
        winActor.ease({
          opacity: 0,
          duration: ANIMATION_SPEED,
          scaleX: 0.9,
          scaleY: 0.9,
          mode: Clutter.AnimationMode.EASE_OUT_QUAD,
          onComplete: () => {
            winActor.hide();
            winActor.set_pivot_point(0, 0);
          }
        });
      }
      winClone.connect("destroy", () => {
        if (nonTiledWin.minimized) {
          winActor.set_pivot_point(0, 0);
          return;
        }
        if (winActor.visible) return;
        winActor.set_pivot_point(0.5, 0.5);
        winActor.show();
        winActor.ease({
          opacity: 255,
          duration: ANIMATION_SPEED,
          scaleX: 1,
          scaleY: 1,
          mode: Clutter.AnimationMode.EASE_OUT_QUAD,
          onStopped: () => winActor.set_pivot_point(0, 0)
        });
      });
      winClone.connect(
        "button-release-event",
        (act, event) => {
          return this._onSuggestionPress(
            nonTiledWin,
            winClone,
            event,
            nontiledWindows,
            monitorIndex,
            preview
          );
        }
      );
      winClone.connect(
        "touch-event",
        (act, event) => {
          if (event.type() === Clutter.EventType.TOUCH_END) {
            return this._onSuggestionPress(
              nonTiledWin,
              winClone,
              event,
              nontiledWindows,
              monitorIndex,
              preview
            );
          }
          return Clutter.EVENT_STOP;
        }
      );
      return winClone;
    });
    preview.addWindows(
      clones,
      this._containerRect.height * MASONRY_LAYOUT_ROW_HEIGHT
    );
    clones.forEach((winClone) => {
      winClone.set_opacity(0);
      winClone.set_pivot_point(0.5, 0.5);
      winClone.set_scale(0.6, 0.6);
      winClone.ease({
        opacity: 255,
        duration: Math.floor(ANIMATION_SPEED * 1.8),
        scaleX: 1.03,
        scaleY: 1.03,
        mode: Clutter.AnimationMode.EASE_IN_OUT,
        onComplete: () => {
          winClone.ease({
            delay: 60,
            duration: Math.floor(ANIMATION_SPEED * 2.1),
            scaleX: 1,
            scaleY: 1,
            mode: Clutter.AnimationMode.EASE_IN_OUT
          });
        }
      });
    });
    this.grab_key_focus();
  }

  close() {
    if (!this._showing) return;
    this._showing = false;
    this._signals.disconnect();
    if (this._lastTiledWindow) Main.activateWindow(this._lastTiledWindow);
    this._previews.push(...this._oldPreviews);
    this._oldPreviews = [];
    this._previews.forEach((prev) => prev.removeAllWindows());
    this.ease({
      opacity: 0,
      duration: GlobalState.get().tilePreviewAnimationTime,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onStopped: () => {
        this.hide();
        this._previews.forEach((prev) => prev.open());
      }
    });
  }

  _onSuggestionPress(nonTiledWin, suggestedWin, event, nontiledWindows, monitorIndex, preview) {
    const [eventX, eventY] = getEventCoords(event);
    const cl = suggestedWin.get_window_clone() ?? suggestedWin;
    const [x, y] = cl.get_transformed_position();
    const allocation = cl.get_allocation_box();
    const cloneRect = buildRectangle({
      x,
      y,
      width: allocation.x2 - allocation.x1,
      height: allocation.y2 - allocation.y1
    });
    if (!isPointInsideRect({ x: eventX, y: eventY }, cloneRect))
      return Clutter.EVENT_STOP;
    this._lastTiledWindow = nonTiledWin;
    if (nonTiledWin.maximizedHorizontally || nonTiledWin.maximizedVertically)
      unmaximizeWindow(nonTiledWin);
    if (nonTiledWin.is_fullscreen()) nonTiledWin.unmake_fullscreen();
    if (nonTiledWin.minimized) nonTiledWin.unminimize();
    const winRect = nonTiledWin.get_frame_rect();
    nonTiledWin.originalSize = winRect.copy();
    TilingShellWindowManager.easeMoveWindow({
      window: nonTiledWin,
      from: cloneRect,
      to: buildRectangle({
        x: preview.innerX,
        y: preview.innerY,
        width: preview.innerWidth,
        height: preview.innerHeight
      }),
      duration: ANIMATION_SPEED * 1.8,
      monitorIndex
    });
    nonTiledWin.assignedTile = new Tile({
      ...preview.tile
    });
    suggestedWin.opacity = 0;
    const removed = this._previews.splice(
      this._previews.indexOf(preview),
      1
    );
    this._oldPreviews.push(...removed);
    nontiledWindows.splice(nontiledWindows.indexOf(nonTiledWin), 1);
    preview.close(true);
    this._recursivelyShowPopup(nontiledWindows, monitorIndex);
    return Clutter.EVENT_STOP;
  }
};
registerGObjectClass(_TilingLayoutWithSuggestions);
let TilingLayoutWithSuggestions = _TilingLayoutWithSuggestions;
export {
  TilingLayoutWithSuggestions as default
};
