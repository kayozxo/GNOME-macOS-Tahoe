import { registerGObjectClass } from "../../utils/gjs.js";
import { Clutter } from "../../gi/ext.js";
const MASONRY_ROW_MIN_HEIGHT_PERCENTAGE = 0.15;
const _MasonryLayoutManager = class _MasonryLayoutManager extends Clutter.LayoutManager {
  _rowCount;
  _spacing;
  _maxRowHeight;
  _rowHeight;
  constructor(spacing, rowHeight, maxRowHeight) {
    super();
    this._rowCount = 0;
    this._spacing = spacing;
    this._maxRowHeight = maxRowHeight;
    this._rowHeight = rowHeight;
  }

  static computePlacements(children, availableWidth, availableHeight, rowHeight) {
    let rowCount = Math.max(1, Math.ceil(Math.sqrt(children.length)) - 1);
    while (rowCount > 1 && rowHeight < availableHeight * MASONRY_ROW_MIN_HEIGHT_PERCENTAGE) {
      rowCount--;
      rowHeight = availableHeight / rowCount;
    }
    const rowWidths = Array(rowCount).fill(0);
    const placements = [];
    for (const child of children) {
      const [_minWidth, natWidth] = child.get_preferred_width(-1);
      const [_minHeight, natHeight] = child.get_preferred_height(-1);
      const aspectRatio = natWidth / natHeight;
      const width = rowHeight * aspectRatio;
      let shortestRow = rowWidths.indexOf(Math.min(...rowWidths));
      if (rowWidths[shortestRow] + width > availableWidth && rowWidths[shortestRow] !== 0) {
        shortestRow = rowCount;
        rowWidths.push(0);
        rowCount++;
      }
      const childWidth = Math.clamp(width, width, availableWidth);
      const childHeight = childWidth / aspectRatio;
      placements.push({
        child,
        row: shortestRow,
        width: childWidth,
        height: childHeight,
        x: rowWidths[shortestRow],
        rowWidth: 0
      });
      if (rowWidths[shortestRow] === 0) rowWidths[shortestRow] = width;
      else rowWidths[shortestRow] += width;
    }
    for (const placement of placements)
      placement.rowWidth = rowWidths[placement.row];
    const sortedRowWidths = [...rowWidths].map((v, i) => [
      v,
      i
    ]);
    sortedRowWidths.sort((a, b) => b[0] - a[0]);
    const rowsOrdering = /* @__PURE__ */ new Map();
    sortedRowWidths.forEach((row, oldIndex) => {
      const index = row[1];
      const newIndex = sortedRowWidths.length <= 2 ? oldIndex : (oldIndex + Math.floor(rowCount / 2)) % rowCount;
      rowsOrdering.set(index, newIndex);
    });
    for (const placement of placements)
      placement.row = rowsOrdering.get(placement.row) ?? placement.row;
    const result = Array(rowCount);
    for (const placement of placements) result[placement.row] = [];
    for (const placement of placements) {
      result[placement.row].push({
        actor: placement.child,
        width: placement.width,
        height: placement.height
      });
    }
    return result;
  }

  vfunc_allocate(container, box) {
    const children = container.get_children();
    if (children.length === 0) return;
    console.log(
      box.get_width(),
      container.width,
      box.get_height(),
      container.height
    );
    const availableWidth = container.width - 2 * this._spacing;
    const availableHeight = container.height - 2 * this._spacing;
    const allocationCache = container._allocationCache || /* @__PURE__ */ new Map();
    container._allocationCache = allocationCache;
    if (!children.find((ch) => !allocationCache.has(ch))) {
      children.forEach((ch) => ch.allocate(allocationCache.get(ch)));
      return;
    }
    allocationCache.clear();
    this._rowCount = Math.ceil(Math.sqrt(children.length)) + 1;
    let rowHeight = 0;
    while (this._rowCount > 1 && rowHeight < availableHeight * MASONRY_ROW_MIN_HEIGHT_PERCENTAGE) {
      this._rowCount--;
      rowHeight = (availableHeight - this._spacing * (this._rowCount - 1)) / this._rowCount;
    }
    rowHeight = Math.min(rowHeight, this._maxRowHeight);
    rowHeight = this._rowHeight;
    const rowWidths = Array(this._rowCount).fill(0);
    const placements = [];
    for (const child of children) {
      const [_minHeight, naturalHeight] = child.get_preferred_height(-1);
      const [_minWidth, naturalWidth] = child.get_preferred_width(naturalHeight);
      const aspectRatio = naturalWidth / naturalHeight;
      const width = rowHeight * aspectRatio;
      let shortestRow = rowWidths.indexOf(Math.min(...rowWidths));
      if (rowWidths[shortestRow] + width > availableWidth && rowWidths[shortestRow] !== 0) {
        shortestRow = this._rowCount;
        rowWidths.push(0);
        this._rowCount++;
      }
      const childWidth = Math.clamp(width, width, availableWidth);
      const childHeight = childWidth / aspectRatio;
      placements.push({
        child,
        row: shortestRow,
        width: childWidth,
        height: childHeight,
        x: rowWidths[shortestRow],
        rowWidth: 0
      });
      if (rowWidths[shortestRow] === 0) rowWidths[shortestRow] = width;
      else rowWidths[shortestRow] += this._spacing + width;
    }
    for (const placement of placements)
      placement.rowWidth = rowWidths[placement.row];
    const sortedRowWidths = [...rowWidths].map((v, i) => [
      v,
      i
    ]);
    sortedRowWidths.sort((a, b) => b[0] - a[0]);
    const rowsOrdering = /* @__PURE__ */ new Map();
    sortedRowWidths.forEach((row, newIndex) => {
      const index = row[1];
      rowsOrdering.set(
        index,
        (newIndex + Math.floor(this._rowCount / 2)) % this._rowCount
      );
    });
    for (const placement of placements)
      placement.row = rowsOrdering.get(placement.row) ?? placement.row;
    const rowYPosition = Array(this._rowCount).fill({ y: 0, height: 0 });
    for (const placement of placements) {
      rowYPosition[placement.row] = {
        y: 0,
        height: placement.height
      };
    }
    rowYPosition[0].y = this._spacing;
    for (let r = 1; r < this._rowCount; r++) {
      rowYPosition[r].y = this._spacing + rowYPosition[r - 1].y + rowYPosition[r - 1].height;
    }
    const contentHeight = rowYPosition[this._rowCount - 1].y + rowYPosition[this._rowCount - 1].height;
    const verticalOffset = this._spacing / 2 + Math.max(0, (availableHeight - contentHeight) / 2);
    for (const placement of placements) {
      const { child, row, width, x, rowWidth, height } = placement;
      const y = box.y1 + rowYPosition[row].y + verticalOffset;
      const horizontalOffset = Math.max(0, (availableWidth - rowWidth) / 2) + this._spacing;
      const xPosition = box.x1 + x + horizontalOffset;
      const newBox = new Clutter.ActorBox({
        x1: xPosition,
        y1: y,
        x2: xPosition + width,
        y2: y + height
      });
      allocationCache.set(child, newBox);
      child.allocate(newBox);
    }
  }

  vfunc_get_preferred_width(container, _forHeight) {
    let maxX = 0;
    container.get_children().forEach((ch) => {
      maxX = Math.max(maxX, ch.x + ch.width);
    });
    return [maxX + this._spacing, maxX + this._spacing];
  }

  vfunc_get_preferred_height(container, _forWidth) {
    let maxY = 0;
    container.get_children().forEach((ch) => {
      maxY = Math.max(maxY, ch.y + ch.height);
    });
    return [maxY + this._spacing, maxY + this._spacing];
  }
};
registerGObjectClass(_MasonryLayoutManager);
let MasonryLayoutManager = _MasonryLayoutManager;
export {
  MasonryLayoutManager as default
};
