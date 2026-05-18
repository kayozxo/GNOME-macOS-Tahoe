import { St, Meta, Mtk, Clutter } from "../gi/ext.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
const getMonitors = () => Main.layoutManager.monitors;
const isPointInsideRect = (point, rect) => {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
};
const clampPointInsideRect = (point, rect) => {
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  return {
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height)
  };
};
const isTileOnContainerBorder = (tilePos, container) => {
  const almostEqual = (first, second) => Math.abs(first - second) <= 1;
  const isLeft = almostEqual(tilePos.x, container.x);
  const isTop = almostEqual(tilePos.y, container.y);
  const isRight = almostEqual(
    tilePos.x + tilePos.width,
    container.x + container.width
  );
  const isBottom = almostEqual(
    tilePos.y + tilePos.height,
    container.y + container.height
  );
  return {
    isTop,
    isRight,
    isBottom,
    isLeft
  };
};
const buildTileGaps = (tilePos, innerGaps, outerGaps, container, scalingFactor = 1) => {
  const { isTop, isRight, isBottom, isLeft } = isTileOnContainerBorder(
    tilePos,
    container
  );
  const margin = new Clutter.Margin();
  margin.top = (isTop ? outerGaps.top : innerGaps.top / 2) * scalingFactor;
  margin.bottom = (isBottom ? outerGaps.bottom : innerGaps.bottom / 2) * scalingFactor;
  margin.left = (isLeft ? outerGaps.left : innerGaps.left / 2) * scalingFactor;
  margin.right = (isRight ? outerGaps.right : innerGaps.right / 2) * scalingFactor;
  return {
    gaps: margin,
    isTop,
    isRight,
    isBottom,
    isLeft
  };
};
const getMonitorScalingFactor = (monitorIndex) => {
  const scalingFactor = St.ThemeContext.get_for_stage(
    global.get_stage()
  ).get_scale_factor();
  if (scalingFactor === 1)
    return global.display.get_monitor_scale(monitorIndex);
  return scalingFactor;
};
const getScalingFactorOf = (widget) => {
  const [hasReference, scalingReference] = widget.get_theme_node().lookup_length("scaling-reference", true);
  if (!hasReference) return [true, 1];
  const [hasValue, monitorScalingFactor] = widget.get_theme_node().lookup_length("monitor-scaling-factor", true);
  if (!hasValue) return [true, 1];
  return [scalingReference !== 1, monitorScalingFactor / scalingReference];
};
const enableScalingFactorSupport = (widget, monitorScalingFactor) => {
  if (!monitorScalingFactor) return;
  widget.set_style(`${getScalingFactorSupportString(monitorScalingFactor)};`);
};
const getScalingFactorSupportString = (monitorScalingFactor) => {
  return `scaling-reference: 1px; monitor-scaling-factor: ${monitorScalingFactor}px`;
};

function buildMarginOf(value) {
  const margin = new Clutter.Margin();
  margin.top = value;
  margin.bottom = value;
  margin.left = value;
  margin.right = value;
  return margin;
}

function buildMargin(params) {
  const margin = new Clutter.Margin();
  if (params.top) margin.top = params.top;
  if (params.bottom) margin.bottom = params.bottom;
  if (params.left) margin.left = params.left;
  if (params.right) margin.right = params.right;
  return margin;
}

function buildRectangle(params = {}) {
  return new Mtk.Rectangle({
    x: params.x || 0,
    y: params.y || 0,
    width: params.width || 0,
    height: params.height || 0
  });
}

function getTransientOrParent(window) {
  const transient = window.get_transient_for();
  return window.is_attached_dialog() && transient !== null ? transient : window;
}

function filterUnfocusableWindows(windows) {
  return windows.map(getTransientOrParent).filter((win, idx, arr) => {
    return win !== null && !win.skipTaskbar && arr.indexOf(win) === idx;
  });
}

function getWindows(workspace) {
  if (!workspace) workspace = global.workspaceManager.get_active_workspace();
  return filterUnfocusableWindows(
    global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace)
  );
}

function getWindowsOfMonitor(monitor) {
  return global.workspaceManager.get_active_workspace().list_windows().filter(
    (win) => win.get_window_type() === Meta.WindowType.NORMAL && Main.layoutManager.monitors[win.get_monitor()] === monitor
  );
}

function squaredEuclideanDistance(pointA, pointB) {
  return (pointA.x - pointB.x) * (pointA.x - pointB.x) + (pointA.y - pointB.y) * (pointA.y - pointB.y);
}
export {
  buildMargin,
  buildMarginOf,
  buildRectangle,
  buildTileGaps,
  clampPointInsideRect,
  enableScalingFactorSupport,
  filterUnfocusableWindows,
  getMonitorScalingFactor,
  getMonitors,
  getScalingFactorOf,
  getScalingFactorSupportString,
  getWindows,
  getWindowsOfMonitor,
  isPointInsideRect,
  isTileOnContainerBorder,
  squaredEuclideanDistance
};
