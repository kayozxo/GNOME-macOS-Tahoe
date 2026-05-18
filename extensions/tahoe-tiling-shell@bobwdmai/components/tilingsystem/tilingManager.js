import { Clutter, Meta, GLib } from "../../gi/ext.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { logger } from "../../utils/logger.js";
import {
  buildMargin,
  buildRectangle,
  buildTileGaps,
  getMonitorScalingFactor,
  getScalingFactorOf,
  getWindows,
  isPointInsideRect,
  isTileOnContainerBorder,
  squaredEuclideanDistance
} from "../../utils/ui.js";
import TilingLayout from "../../components/tilingsystem/tilingLayout.js";
import SnapAssist from "../snapassist/snapAssist.js";
import SelectionTilePreview from "../tilepreview/selectionTilePreview.js";
import { ActivationKey, EdgeTilingMode } from "../../settings/settings.js";
import Settings from "../../settings/settings.js";
import SignalHandling from "../../utils/signalHandling.js";
import Layout from "../layout/Layout.js";
import Tile from "../layout/Tile.js";
import TileUtils from "../layout/TileUtils.js";
import GlobalState from "../../utils/globalState.js";
import EdgeTilingManager from "./edgeTilingManager.js";
import TouchPointer from "./touchPointer.js";
import { KeyBindingsDirection } from "../../keybindings.js";
import TilingShellWindowManager from "../../components/windowManager/tilingShellWindowManager.js";
import TilingLayoutWithSuggestions from "../windowsSuggestions/tilingLayoutWithSuggestions.js";
import { maximizeWindow, unmaximizeWindow } from "../../utils/gnomesupport.js";
const MINIMUM_DISTANCE_TO_RESTORE_ORIGINAL_SIZE = 90;

class SnapAssistingInfo {
  _snapAssistantLayoutId;
  constructor() {
    this._snapAssistantLayoutId = void 0;
  }

  get layoutId() {
    return this._snapAssistantLayoutId ?? "";
  }

  get isSnapAssisting() {
    return this._snapAssistantLayoutId !== void 0;
  }

  update(layoutId) {
    this._snapAssistantLayoutId = !layoutId || layoutId.length === 0 ? void 0 : layoutId;
  }
}

class TilingManager {
  _monitor;
  _selectedTilesPreview;
  _snapAssist;
  _workspaceTilingLayout;
  _edgeTilingManager;
  _tilingSuggestionsLayout;
  _workArea;
  _enableScaling;
  _isGrabbingWindow;
  _movingWindowTimerDuration = 15;
  _lastCursorPos = null;
  _grabStartPosition = null;
  _wasSpanMultipleTilesActivated;
  _wasTilingSystemActivated;
  _snapAssistingInfo;
  _movingWindowTimerId = null;
  _signals;
  _debug;
  /**
   * Constructs a new TilingManager instance.
   * @param monitor The monitor to manage tiling for.
   */
  constructor(monitor, enableScaling) {
    this._isGrabbingWindow = false;
    this._wasSpanMultipleTilesActivated = false;
    this._wasTilingSystemActivated = false;
    this._snapAssistingInfo = new SnapAssistingInfo();
    this._enableScaling = enableScaling;
    this._monitor = monitor;
    this._signals = new SignalHandling();
    this._debug = logger(`TilingManager ${monitor.index}`);
    this._workArea = Main.layoutManager.getWorkAreaForMonitor(
      this._monitor.index
    );
    this._debug(
      `Work area for monitor ${this._monitor.index}: ${this._workArea.x} ${this._workArea.y} ${this._workArea.width}x${this._workArea.height}`
    );
    this._edgeTilingManager = new EdgeTilingManager(this._workArea);
    this._edgeTilingManager.monitorIndex = this._monitor.index;
    const monitorScalingFactor = this._enableScaling ? getMonitorScalingFactor(monitor.index) : void 0;
    this._workspaceTilingLayout = /* @__PURE__ */ new Map();
    for (let i = 0; i < global.workspaceManager.get_n_workspaces(); i++) {
      const ws = global.workspaceManager.get_workspace_by_index(i);
      if (!ws) continue;
      const innerGaps = buildMargin(Settings.get_inner_gaps());
      const outerGaps = buildMargin(Settings.get_outer_gaps());
      const layout = GlobalState.get().getSelectedLayoutOfMonitor(
        monitor.index,
        ws.index()
      );
      this._workspaceTilingLayout.set(
        ws,
        new TilingLayout(
          layout,
          innerGaps,
          outerGaps,
          this._workArea,
          monitorScalingFactor
        )
      );
    }
    this._tilingSuggestionsLayout = new TilingLayoutWithSuggestions(
      buildMargin(Settings.get_inner_gaps()),
      buildMargin(Settings.get_outer_gaps()),
      this._workArea,
      monitorScalingFactor
    );
    this._selectedTilesPreview = new SelectionTilePreview({
      parent: global.windowGroup
    });
    this._snapAssist = new SnapAssist(
      Main.uiGroup,
      this._workArea,
      this._monitor.index,
      monitorScalingFactor
    );
  }

  /**
   * Enables tiling manager by setting up event listeners:
   *  - handle any window's grab begin.
   *  - handle any window's grab end.
   *  - handle grabbed window's movement.
   */
  enable() {
    this._signals.connect(
      Settings,
      Settings.KEY_SETTING_SELECTED_LAYOUTS,
      () => {
        const ws = global.workspaceManager.get_active_workspace();
        if (!ws) return;
        const layout = GlobalState.get().getSelectedLayoutOfMonitor(
          this._monitor.index,
          ws.index()
        );
        this._workspaceTilingLayout.get(ws)?.relayout({ layout });
      }
    );
    this._signals.connect(
      GlobalState.get(),
      GlobalState.SIGNAL_LAYOUTS_CHANGED,
      () => {
        const ws = global.workspaceManager.get_active_workspace();
        if (!ws) return;
        const layout = GlobalState.get().getSelectedLayoutOfMonitor(
          this._monitor.index,
          ws.index()
        );
        this._workspaceTilingLayout.get(ws)?.relayout({ layout });
      }
    );
    this._signals.connect(Settings, Settings.KEY_INNER_GAPS, () => {
      const innerGaps = buildMargin(Settings.get_inner_gaps());
      this._workspaceTilingLayout.forEach(
        (tilingLayout) => tilingLayout.relayout({ innerGaps })
      );
    });
    this._signals.connect(Settings, Settings.KEY_OUTER_GAPS, () => {
      const outerGaps = buildMargin(Settings.get_outer_gaps());
      this._workspaceTilingLayout.forEach(
        (tilingLayout) => tilingLayout.relayout({ outerGaps })
      );
    });
    this._signals.connect(
      global.display,
      "grab-op-begin",
      (_display, window, grabOp) => {
        const moving = (grabOp & ~1024) === 1;
        if (!moving) return;
        this._onWindowGrabBegin(window, grabOp);
      }
    );
    this._signals.connect(
      global.display,
      "grab-op-end",
      (_display, window) => {
        if (!this._isGrabbingWindow) return;
        this._onWindowGrabEnd(window);
      }
    );
    this._signals.connect(
      this._snapAssist,
      "snap-assist",
      this._onSnapAssist.bind(this)
    );
    this._signals.connect(
      global.workspaceManager,
      "active-workspace-changed",
      () => {
        const ws = global.workspaceManager.get_active_workspace();
        if (this._workspaceTilingLayout.has(ws)) return;
        const monitorScalingFactor = this._enableScaling ? getMonitorScalingFactor(this._monitor.index) : void 0;
        const layout = GlobalState.get().getSelectedLayoutOfMonitor(
          this._monitor.index,
          ws.index()
        );
        const innerGaps = buildMargin(Settings.get_inner_gaps());
        const outerGaps = buildMargin(Settings.get_outer_gaps());
        this._debug("created new tiling layout for active workspace");
        this._workspaceTilingLayout.set(
          ws,
          new TilingLayout(
            layout,
            innerGaps,
            outerGaps,
            this._workArea,
            monitorScalingFactor
          )
        );
      }
    );
    this._signals.connect(
      global.workspaceManager,
      "workspace-removed",
      (_) => {
        const newMap = /* @__PURE__ */ new Map();
        const n_workspaces = global.workspaceManager.get_n_workspaces();
        for (let i = 0; i < n_workspaces; i++) {
          const ws = global.workspaceManager.get_workspace_by_index(i);
          if (!ws) continue;
          const tl = this._workspaceTilingLayout.get(ws);
          if (!tl) continue;
          this._workspaceTilingLayout.delete(ws);
          newMap.set(ws, tl);
        }
        [...this._workspaceTilingLayout.values()].forEach(
          (tl) => tl.destroy()
        );
        this._workspaceTilingLayout.clear();
        this._workspaceTilingLayout = newMap;
        this._debug("deleted workspace");
      }
    );
    this._signals.connect(
      global.display,
      "window-created",
      (_display, window) => {
        if (Settings.ENABLE_AUTO_TILING) this._autoTile(window, true);
      }
    );
    this._signals.connect(
      TilingShellWindowManager.get(),
      "unmaximized",
      (_, window) => {
        if (Settings.ENABLE_AUTO_TILING) this._autoTile(window, false);
      }
    );
    this._signals.connect(
      TilingShellWindowManager.get(),
      "maximized",
      (_, window) => {
        delete window.assignedTile;
      }
    );
  }

  onUntileWindow(window, force) {
    const destination = window.originalSize;
    if (!destination) return;
    this._easeWindowRect(window, destination, false, force);
    window.assignedTile = void 0;
  }

  onKeyboardMoveWindow(window, direction, force, spanFlag, clamp) {
    let destination;
    const isMaximized = window.maximizedHorizontally || window.maximizedVertically;
    if (spanFlag && isMaximized) return false;
    const currentWs = window.get_workspace();
    const tilingLayout = this._workspaceTilingLayout.get(currentWs);
    if (!tilingLayout) return false;
    const windowRectCopy = window.get_frame_rect().copy();
    const extWin = window;
    if (isMaximized) {
      switch (direction) {
        case KeyBindingsDirection.NODIRECTION:
        case KeyBindingsDirection.LEFT:
        case KeyBindingsDirection.RIGHT:
          break;
        case KeyBindingsDirection.DOWN:
          unmaximizeWindow(window);
          return true;
        case KeyBindingsDirection.UP:
          return false;
      }
    }
    if (direction === KeyBindingsDirection.UP && extWin.assignedTile && extWin.assignedTile?.y === 0) {
      maximizeWindow(window);
      return true;
    }
    if (direction === KeyBindingsDirection.NODIRECTION) {
      const rect = buildRectangle({
        x: this._workArea.x + this._workArea.width / 2 - windowRectCopy.width / 2,
        y: this._workArea.y + this._workArea.height / 2 - windowRectCopy.height / 2,
        width: windowRectCopy.width,
        height: windowRectCopy.height
      });
      destination = {
        rect,
        tile: TileUtils.build_tile(rect, this._workArea)
      };
    } else if (window.get_monitor() === this._monitor.index) {
      const enlargeFactor = Math.max(
        64,
        // if the gaps are all 0 we choose 64 instead
        tilingLayout.innerGaps.right,
        tilingLayout.innerGaps.left,
        tilingLayout.innerGaps.right,
        tilingLayout.innerGaps.bottom
      );
      destination = tilingLayout.findNearestTileDirection(
        windowRectCopy,
        direction,
        clamp,
        enlargeFactor
      );
    } else {
      destination = tilingLayout.findNearestTile(windowRectCopy);
    }
    if (window.get_monitor() === this._monitor.index && destination && !window.maximizedHorizontally && !window.maximizedVertically && window.assignedTile && window.assignedTile?.x === destination.tile.x && window.assignedTile?.y === destination.tile.y && window.assignedTile?.width === destination.tile.width && window.assignedTile?.height === destination.tile.height)
      return true;
    if (!destination) {
      if (spanFlag) return false;
      if (direction === KeyBindingsDirection.UP && window.can_maximize()) {
        maximizeWindow(window);
        return true;
      }
      return false;
    }
    if (!window.assignedTile && !isMaximized)
      window.originalSize = windowRectCopy;
    if (spanFlag) {
      destination.rect = destination.rect.union(windowRectCopy);
      destination.tile = TileUtils.build_tile(
        destination.rect,
        this._workArea
      );
    }
    if (isMaximized) unmaximizeWindow(window);
    this._easeWindowRect(window, destination.rect, false, force);
    if (direction !== KeyBindingsDirection.NODIRECTION) {
      window.assignedTile = new Tile({
        ...destination.tile
      });
    }
    return true;
  }

  /**
   * Destroys the tiling manager and cleans up resources.
   */
  destroy() {
    if (this._movingWindowTimerId) {
      GLib.Source.remove(this._movingWindowTimerId);
      this._movingWindowTimerId = null;
    }
    this._signals.disconnect();
    this._isGrabbingWindow = false;
    this._snapAssistingInfo.update(void 0);
    this._edgeTilingManager.abortEdgeTiling();
    this._workspaceTilingLayout.forEach((tl) => tl.destroy());
    this._workspaceTilingLayout.clear();
    this._snapAssist.destroy();
    this._selectedTilesPreview.destroy();
    this._tilingSuggestionsLayout.destroy();
  }

  set workArea(newWorkArea) {
    if (newWorkArea.equal(this._workArea)) return;
    this._workArea = newWorkArea;
    this._debug(
      `new work area for monitor ${this._monitor.index}: ${newWorkArea.x} ${newWorkArea.y} ${newWorkArea.width}x${newWorkArea.height}`
    );
    this._workspaceTilingLayout.forEach(
      (tl) => tl.relayout({ containerRect: this._workArea })
    );
    this._snapAssist.workArea = this._workArea;
    this._edgeTilingManager.workarea = this._workArea;
  }

  _onWindowGrabBegin(window, grabOp) {
    if (this._isGrabbingWindow) return;
    TouchPointer.get().updateWindowPosition(window.get_frame_rect());
    this._signals.connect(
      global.stage,
      "touch-event",
      (_source, event) => {
        const [x, y] = event.get_coords();
        TouchPointer.get().onTouchEvent(x, y);
      }
    );
    this._signals.connect(
      global.stage,
      "captured-event",
      (_source, event) => {
        const device = event.get_source_device();
        if (!device) return;
        const deviceType = device.get_device_type();
        if (deviceType === Clutter.InputDeviceType.TABLET_DEVICE || deviceType === Clutter.InputDeviceType.PEN_DEVICE) {
          const eventType = event.type();
          if (eventType === Clutter.EventType.MOTION) {
            const [x, y] = event.get_coords();
            TouchPointer.get().onTouchEvent(x, y);
            const seat = Clutter.get_default_backend().get_default_seat();
            seat.warp_pointer(x, y);
          }
        }
      }
    );
    if (Settings.ENABLE_BLUR_SNAP_ASSISTANT || Settings.ENABLE_BLUR_SELECTED_TILEPREVIEW) {
      this._signals.connect(window, "position-changed", () => {
        if (Settings.ENABLE_BLUR_SELECTED_TILEPREVIEW) {
          this._selectedTilesPreview.get_effect("blur")?.queue_repaint();
        }
        if (Settings.ENABLE_BLUR_SNAP_ASSISTANT) {
          this._snapAssist.get_first_child()?.get_effect("blur")?.queue_repaint();
        }
      });
    }
    this._isGrabbingWindow = true;
    this._movingWindowTimerId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT_IDLE,
      this._movingWindowTimerDuration,
      this._onMovingWindow.bind(this, window, grabOp)
    );
    this._onMovingWindow(window, grabOp);
  }

  _activationKeyStatus(modifier, key) {
    if (key === ActivationKey.NONE) return true;
    let mask = Clutter.ModifierType.CONTROL_MASK;
    switch (key) {
      case ActivationKey.CTRL:
        mask = Clutter.ModifierType.CONTROL_MASK;
        break;
      case ActivationKey.ALT:
        mask = Clutter.ModifierType.MOD1_MASK;
        break;
      case ActivationKey.SUPER:
        mask = Clutter.ModifierType.SUPER_MASK;
        break;
    }
    return (modifier & mask) === mask;
  }

  _onMovingWindow(window, grabOp) {
    if (!this._isGrabbingWindow) {
      this._movingWindowTimerId = null;
      return GLib.SOURCE_REMOVE;
    }
    const currentWs = window.get_workspace();
    const tilingLayout = this._workspaceTilingLayout.get(currentWs);
    if (!tilingLayout) return GLib.SOURCE_REMOVE;
    this._edgeTilingManager.workspaceIndex = currentWs.index();
    if (!window.allows_resize() || !window.allows_move() || !this._isPointerInsideThisMonitor(window)) {
      tilingLayout.close();
      this._selectedTilesPreview.close(true);
      this._snapAssist.close(true);
      this._snapAssistingInfo.update(void 0);
      this._edgeTilingManager.abortEdgeTiling();
      return GLib.SOURCE_CONTINUE;
    }
    const [x, y, modifier] = TouchPointer.get().isTouchDeviceActive() ? TouchPointer.get().get_pointer(window) : global.get_pointer();
    const extWin = window;
    extWin.assignedTile = void 0;
    const currPointerPos = { x, y };
    if (this._grabStartPosition === null)
      this._grabStartPosition = { x, y };
    if (extWin.originalSize && squaredEuclideanDistance(currPointerPos, this._grabStartPosition) > MINIMUM_DISTANCE_TO_RESTORE_ORIGINAL_SIZE) {
      if (Settings.RESTORE_WINDOW_ORIGINAL_SIZE) {
        const windowRect = window.get_frame_rect();
        const offsetX = (x - windowRect.x) / windowRect.width;
        const offsetY = (y - windowRect.y) / windowRect.height;
        const newSize = buildRectangle({
          x: x - extWin.originalSize.width * offsetX,
          y: y - extWin.originalSize.height * offsetY,
          width: extWin.originalSize.width,
          height: extWin.originalSize.height
        });
        const restartGrab = (
          // @ts-expect-error "grab is available on GNOME 42"
          global.display.end_grab_op && global.display.begin_grab_op
        );
        if (restartGrab) {
          global.display.end_grab_op(global.get_current_time());
        }
        this._easeWindowRect(window, newSize, restartGrab, restartGrab);
        TouchPointer.get().updateWindowPosition(newSize);
        if (restartGrab) {
          extWin.originalSize = void 0;
          global.display.begin_grab_op(
            window,
            grabOp,
            true,
            // pointer already grabbed
            true,
            // frame action
            -1,
            // Button
            modifier,
            global.get_current_time(),
            x,
            y
          );
        }
      }
      extWin.originalSize = void 0;
      this._grabStartPosition = null;
    }
    const isSpanMultiTilesActivated = this._activationKeyStatus(
      modifier,
      Settings.SPAN_MULTIPLE_TILES_ACTIVATION_KEY
    );
    const isTilingSystemActivated = this._activationKeyStatus(
      modifier,
      Settings.TILING_SYSTEM_ACTIVATION_KEY
    );
    const deactivationKey = Settings.TILING_SYSTEM_DEACTIVATION_KEY;
    const isTilingSystemDeactivated = deactivationKey === ActivationKey.NONE ? false : this._activationKeyStatus(modifier, deactivationKey);
    const allowSpanMultipleTiles = Settings.SPAN_MULTIPLE_TILES && isSpanMultiTilesActivated;
    const showTilingSystem = Settings.TILING_SYSTEM && isTilingSystemActivated && !isTilingSystemDeactivated;
    const changedSpanMultipleTiles = Settings.SPAN_MULTIPLE_TILES && isSpanMultiTilesActivated !== this._wasSpanMultipleTilesActivated;
    const changedShowTilingSystem = Settings.TILING_SYSTEM && isTilingSystemActivated !== this._wasTilingSystemActivated;
    if (!changedSpanMultipleTiles && !changedShowTilingSystem && currPointerPos.x === this._lastCursorPos?.x && currPointerPos.y === this._lastCursorPos?.y)
      return GLib.SOURCE_CONTINUE;
    this._lastCursorPos = currPointerPos;
    this._wasTilingSystemActivated = isTilingSystemActivated;
    this._wasSpanMultipleTilesActivated = isSpanMultiTilesActivated;
    if (!showTilingSystem) {
      if (tilingLayout.showing) {
        tilingLayout.close();
        this._selectedTilesPreview.close(true);
      }
      if (Settings.ACTIVE_SCREEN_EDGES && !this._snapAssistingInfo.isSnapAssisting && this._edgeTilingManager.canActivateEdgeTiling(currPointerPos)) {
        const { changed, rect } = this._edgeTilingManager.startEdgeTiling(currPointerPos);
        if (changed)
          this._showEdgeTiling(window, rect, x, y, tilingLayout);
        this._snapAssist.close(true);
      } else {
        if (this._edgeTilingManager.isPerformingEdgeTiling()) {
          this._selectedTilesPreview.close(true);
          this._edgeTilingManager.abortEdgeTiling();
        }
        if (Settings.SNAP_ASSIST) {
          this._snapAssist.onMovingWindow(
            window,
            currPointerPos,
            true
          );
        }
      }
      return GLib.SOURCE_CONTINUE;
    }
    if (!tilingLayout.showing) {
      tilingLayout.openAbove(window);
      this._snapAssist.close(true);
      if (this._edgeTilingManager.isPerformingEdgeTiling()) {
        this._selectedTilesPreview.close(true);
        this._edgeTilingManager.abortEdgeTiling();
      }
    }
    if (this._snapAssistingInfo.isSnapAssisting) {
      this._selectedTilesPreview.close(true);
      this._snapAssistingInfo.update(void 0);
    }
    if (!changedSpanMultipleTiles && isPointInsideRect(currPointerPos, this._selectedTilesPreview.rect))
      return GLib.SOURCE_CONTINUE;
    let selectionRect = tilingLayout.getTileBelow(
      currPointerPos,
      changedSpanMultipleTiles && !allowSpanMultipleTiles
    );
    if (!selectionRect) return GLib.SOURCE_CONTINUE;
    selectionRect = selectionRect.copy();
    if (allowSpanMultipleTiles && this._selectedTilesPreview.showing) {
      selectionRect = selectionRect.union(
        this._selectedTilesPreview.rect
      );
    }
    tilingLayout.hoverTilesInRect(selectionRect, !allowSpanMultipleTiles);
    this.openSelectionTilePreview(selectionRect, true, true, window);
    return GLib.SOURCE_CONTINUE;
  }

  _onWindowGrabEnd(window) {
    this._isGrabbingWindow = false;
    this._grabStartPosition = null;
    this._signals.disconnect(window);
    TouchPointer.get().reset();
    const currentWs = window.get_workspace();
    const tilingLayout = this._workspaceTilingLayout.get(currentWs);
    if (tilingLayout) tilingLayout.close();
    const desiredWindowRect = buildRectangle({
      x: this._selectedTilesPreview.innerX,
      y: this._selectedTilesPreview.innerY,
      width: this._selectedTilesPreview.innerWidth,
      height: this._selectedTilesPreview.innerHeight
    });
    const selectedTilesRect = this._selectedTilesPreview.rect.copy();
    this._selectedTilesPreview.close(true);
    this._snapAssist.close(true);
    this._lastCursorPos = null;
    const isTilingSystemActivated = this._activationKeyStatus(
      global.get_pointer()[2],
      Settings.TILING_SYSTEM_ACTIVATION_KEY
    );
    if (!isTilingSystemActivated && !this._snapAssistingInfo.isSnapAssisting && !this._edgeTilingManager.isPerformingEdgeTiling())
      return;
    const wasSnapAssistingLayout = this._snapAssistingInfo.isSnapAssisting ? GlobalState.get().layouts.find(
      (lay) => lay.id === this._snapAssistingInfo.layoutId
    ) : void 0;
    this._snapAssistingInfo.update(void 0);
    if (this._edgeTilingManager.isPerformingEdgeTiling() && this._edgeTilingManager.needMaximize() && window.can_maximize())
      maximizeWindow(window);
    const wasEdgeTiling = this._edgeTilingManager.isPerformingEdgeTiling();
    this._edgeTilingManager.abortEdgeTiling();
    const canShowTilingSuggestions = wasSnapAssistingLayout && Settings.ENABLE_SNAP_ASSISTANT_WINDOWS_SUGGESTIONS || wasEdgeTiling && Settings.ENABLE_SCREEN_EDGES_WINDOWS_SUGGESTIONS || isTilingSystemActivated && Settings.ENABLE_TILING_SYSTEM_WINDOWS_SUGGESTIONS;
    if (!this._isPointerInsideThisMonitor(window)) return;
    if (desiredWindowRect.width <= 0 || desiredWindowRect.height <= 0)
      return;
    if (window.maximizedHorizontally || window.maximizedVertically) return;
    window.originalSize = window.get_frame_rect().copy();
    window.assignedTile = new Tile({
      ...TileUtils.build_tile(selectedTilesRect, this._workArea)
    });
    this._easeWindowRect(window, desiredWindowRect);
    if (wasSnapAssistingLayout && Settings.SNAP_ASSIST_SYNC_LAYOUT) {
      GlobalState.get().setSelectedLayoutOfMonitor(
        wasSnapAssistingLayout.id,
        this._monitor.index
      );
    }
    if (!tilingLayout || !canShowTilingSuggestions) return;
    const layout = wasEdgeTiling ? Settings.EDGE_TILING_MODE === EdgeTilingMode.DEFAULT ? new Layout(
      [
        new Tile({ x: 0, y: 0, height: 0.5, width: 0.5, groups: [] }),
        new Tile({ x: 0.5, y: 0, height: 0.5, width: 0.5, groups: [] }),
        new Tile({ x: 0, y: 0.5, height: 0.5, width: 0.5, groups: [] }),
        new Tile({ x: 0.5, y: 0.5, height: 0.5, width: 0.5, groups: [] })
      ],
      "quarters"
    ) : GlobalState.get().getSelectedLayoutOfMonitor(
      this._monitor.index,
      window.get_workspace().index()
    ) : wasSnapAssistingLayout ? wasSnapAssistingLayout : GlobalState.get().getSelectedLayoutOfMonitor(
      this._monitor.index,
      window.get_workspace().index()
    );
    this._openWindowsSuggestions(
      window,
      desiredWindowRect,
      window.get_monitor(),
      layout,
      tilingLayout.innerGaps,
      tilingLayout.outerGaps,
      tilingLayout.scalingFactor
    );
  }

  _openWindowsSuggestions(window, windowDesiredRect, monitorIndex, layout, innerGaps, outerGaps, scalingFactor) {
    const tiledWindows = [];
    const nontiledWindows = [];
    getWindows().forEach((extWin) => {
      if (extWin && !extWin.minimized && extWin.assignedTile)
        tiledWindows.push(extWin);
      else nontiledWindows.push(extWin);
    });
    if (nontiledWindows.length === 0) return;
    this._tilingSuggestionsLayout.destroy();
    this._tilingSuggestionsLayout = new TilingLayoutWithSuggestions(
      innerGaps,
      outerGaps,
      this._workArea,
      scalingFactor
    );
    this._tilingSuggestionsLayout.relayout({ layout });
    this._tilingSuggestionsLayout.open(
      tiledWindows,
      nontiledWindows,
      window,
      windowDesiredRect,
      monitorIndex
    );
  }

  _easeWindowRect(window, destRect, user_op = false, force = false) {
    const windowActor = window.get_compositor_private();
    const beforeRect = window.get_frame_rect();
    if (destRect.x === beforeRect.x && destRect.y === beforeRect.y && destRect.width === beforeRect.width && destRect.height === beforeRect.height)
      return;
    windowActor.remove_all_transitions();
    Main.wm._prepareAnimationInfo(
      global.windowManager,
      windowActor,
      beforeRect.copy(),
      Meta.SizeChange.UNMAXIMIZE
    );
    window.move_to_monitor(this._monitor.index);
    if (force) window.move_frame(user_op, destRect.x, destRect.y);
    window.move_resize_frame(
      user_op,
      destRect.x,
      destRect.y,
      destRect.width,
      destRect.height
    );
  }

  _onSnapAssist(_, tile, layoutId) {
    if (tile.width === 0 || tile.height === 0) {
      this._selectedTilesPreview.close(true);
      this._snapAssistingInfo.update(void 0);
      return;
    }
    const scaledRect = TileUtils.apply_props(tile, this._workArea);
    if (scaledRect.x + scaledRect.width > this._workArea.x + this._workArea.width) {
      scaledRect.width -= scaledRect.x + scaledRect.width - this._workArea.x - this._workArea.width;
    }
    if (scaledRect.y + scaledRect.height > this._workArea.y + this._workArea.height) {
      scaledRect.height -= scaledRect.y + scaledRect.height - this._workArea.y - this._workArea.height;
    }
    const currentWs = global.workspaceManager.get_active_workspace();
    const tilingLayout = this._workspaceTilingLayout.get(currentWs);
    if (!tilingLayout) return;
    this._selectedTilesPreview.get_parent()?.set_child_above_sibling(this._selectedTilesPreview, null);
    this.openSelectionTilePreview(scaledRect, false, true, void 0);
    this._snapAssistingInfo.update(layoutId);
  }

  openSelectionTilePreview(position, isAboveLayout, ease, window) {
    const currentWs = global.workspaceManager.get_active_workspace();
    const tilingLayout = this._workspaceTilingLayout.get(currentWs);
    if (!tilingLayout) return;
    this._selectedTilesPreview.gaps = buildTileGaps(
      position,
      tilingLayout.innerGaps,
      tilingLayout.outerGaps,
      this._workArea,
      this._enableScaling ? getScalingFactorOf(tilingLayout)[1] : void 0
    ).gaps;
    this._selectedTilesPreview.get_parent()?.set_child_above_sibling(this._selectedTilesPreview, null);
    const gaps = this._selectedTilesPreview.gaps;
    if (isAboveLayout) {
      this._selectedTilesPreview.updateBorderRadius(
        gaps.top > 0,
        gaps.right > 0,
        gaps.bottom > 0,
        gaps.left > 0
      );
    } else {
      const { isTop, isRight, isBottom, isLeft } = isTileOnContainerBorder(
        buildRectangle({
          x: position.x + gaps.left,
          y: position.y + gaps.top,
          width: position.width - gaps.left - gaps.right,
          height: position.height - gaps.top - gaps.bottom
        }),
        this._workArea
      );
      this._selectedTilesPreview.updateBorderRadius(
        !isTop,
        !isRight,
        !isBottom,
        !isLeft
      );
    }
    if (window)
      this._selectedTilesPreview.openAbove(window, position, ease);
    else this._selectedTilesPreview.open(position, ease);
  }

  /**
   * Checks if pointer is inside the current monitor
   * @returns true if the pointer is inside the current monitor, false otherwise
   */
  _isPointerInsideThisMonitor(window) {
    const [x, y] = TouchPointer.get().isTouchDeviceActive() ? TouchPointer.get().get_pointer(window) : global.get_pointer();
    const pointerMonitorIndex = global.display.get_monitor_index_for_rect(
      buildRectangle({
        x,
        y,
        width: 1,
        height: 1
      })
    );
    return this._monitor.index === pointerMonitorIndex;
  }

  _showEdgeTiling(window, edgeTile, pointerX, pointerY, tilingLayout) {
    this._selectedTilesPreview.gaps = buildTileGaps(
      edgeTile,
      tilingLayout.innerGaps,
      tilingLayout.outerGaps,
      this._workArea,
      this._enableScaling ? getScalingFactorOf(tilingLayout)[1] : void 0
    ).gaps;
    if (!this._selectedTilesPreview.showing) {
      const { left, right, top, bottom } = this._selectedTilesPreview.gaps;
      const initialRect = buildRectangle({
        x: pointerX,
        y: pointerY,
        width: left + right + 8,
        // width without gaps will be 8
        height: top + bottom + 8
        // height without gaps will be 8
      });
      initialRect.x -= initialRect.width / 2;
      initialRect.y -= initialRect.height / 2;
      this._selectedTilesPreview.open(initialRect, false);
    }
    this.openSelectionTilePreview(edgeTile, false, true, window);
  }

  _easeWindowRectFromTile(tile, window, skipAnimation = false) {
    const currentWs = window.get_workspace();
    const tilingLayout = this._workspaceTilingLayout.get(currentWs);
    if (!tilingLayout) return;
    const scaledRect = TileUtils.apply_props(tile, this._workArea);
    if (scaledRect.x + scaledRect.width > this._workArea.x + this._workArea.width) {
      scaledRect.width -= scaledRect.x + scaledRect.width - this._workArea.x - this._workArea.width;
    }
    if (scaledRect.y + scaledRect.height > this._workArea.y + this._workArea.height) {
      scaledRect.height -= scaledRect.y + scaledRect.height - this._workArea.y - this._workArea.height;
    }
    const gaps = buildTileGaps(
      scaledRect,
      tilingLayout.innerGaps,
      tilingLayout.outerGaps,
      this._workArea,
      this._enableScaling ? getScalingFactorOf(tilingLayout)[1] : void 0
    ).gaps;
    const destinationRect = buildRectangle({
      x: scaledRect.x + gaps.left,
      y: scaledRect.y + gaps.top,
      width: scaledRect.width - gaps.left - gaps.right,
      height: scaledRect.height - gaps.top - gaps.bottom
    });
    if (destinationRect.width <= 0 || destinationRect.height <= 0) return;
    const isMaximized = window.maximizedHorizontally || window.maximizedVertically;
    const rememberOriginalSize = !isMaximized;
    if (isMaximized) unmaximizeWindow(window);
    if (rememberOriginalSize && !window.assignedTile) {
      window.originalSize = window.get_frame_rect().copy();
    }
    window.assignedTile = TileUtils.build_tile(
      buildRectangle({
        x: scaledRect.x,
        y: scaledRect.y,
        width: scaledRect.width,
        height: scaledRect.height
      }),
      this._workArea
    );
    if (skipAnimation) {
      window.move_resize_frame(
        false,
        destinationRect.x,
        destinationRect.y,
        destinationRect.width,
        destinationRect.height
      );
    } else {
      this._easeWindowRect(window, destinationRect);
    }
  }

  onTileFromWindowMenu(tile, window) {
    this._easeWindowRectFromTile(tile, window);
  }

  onSpanAllTiles(window) {
    this._easeWindowRectFromTile(
      new Tile({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        groups: []
      }),
      window
    );
  }

  _autoTile(window, windowCreated) {
    if (window.get_monitor() !== this._monitor.index) return;
    if (window === null || window.windowType !== Meta.WindowType.NORMAL || window.get_transient_for() !== null || window.is_attached_dialog() || window.minimized || window.maximizedHorizontally || window.maximizedVertically)
      return;
    window.assignedTile = void 0;
    const vacantTile = this._findEmptyTile(window);
    if (!vacantTile) return;
    if (windowCreated) {
      const windowActor = window.get_compositor_private();
      const id = windowActor.connect("first-frame", () => {
        if (!window.minimized && !window.maximizedHorizontally && !window.maximizedVertically && window.get_transient_for() === null && !window.is_attached_dialog())
          this._easeWindowRectFromTile(vacantTile, window, true);
        windowActor.disconnect(id);
      });
    } else {
      this._easeWindowRectFromTile(vacantTile, window, true);
    }
  }

  _findEmptyTile(window) {
    const tiledWindows = getWindows().filter((otherWindow) => {
      return otherWindow && otherWindow.assignedTile && !otherWindow.minimized && !otherWindow.maximizedVertically && !otherWindow.maximizedHorizontally;
    }).map((w) => w);
    const tiles = GlobalState.get().getSelectedLayoutOfMonitor(
      window.get_monitor(),
      global.workspaceManager.get_active_workspace_index()
    ).tiles;
    const workArea = Main.layoutManager.getWorkAreaForMonitor(
      window.get_monitor()
    );
    const vacantTiles = tiles.filter((t) => {
      const tileRect = TileUtils.apply_props(t, workArea);
      return !tiledWindows.find(
        (win) => tileRect.overlap(win.get_frame_rect())
      );
    });
    if (vacantTiles.length === 0) return void 0;
    vacantTiles.sort((a, b) => a.x - b.x);
    let bestTileIndex = 0;
    let bestDistance = Math.abs(
      0.5 - vacantTiles[bestTileIndex].x + vacantTiles[bestTileIndex].width / 2
    );
    for (let index = 1; index < vacantTiles.length; index++) {
      const distance = Math.abs(
        0.5 - (vacantTiles[index].x + vacantTiles[index].width / 2)
      );
      if (bestDistance > distance) {
        bestTileIndex = index;
        bestDistance = distance;
      }
    }
    if (bestTileIndex < 0 || bestTileIndex >= vacantTiles.length)
      return void 0;
    return vacantTiles[bestTileIndex];
  }
}

export {
  TilingManager
};
