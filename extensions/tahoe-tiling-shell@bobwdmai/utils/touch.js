import { Clutter } from "../gi/ext.js";
import { getEventCoords } from "./gnomesupport.js";

class TouchEventHelper {
  TOUCH_SCROLL_THRESHOLD = 10;
  _touchStartY = null;
  _scrollStartY = 0;
  _isDragging = false;
  convertPanToScroll(event, scrollView) {
    if (!scrollView.vadjustment) return Clutter.EVENT_PROPAGATE;
    const eventType = event.type();
    const [, y] = getEventCoords(event);
    switch (eventType) {
      case Clutter.EventType.TOUCH_BEGIN:
        this._touchStartY = y;
        this._scrollStartY = scrollView.vadjustment.value;
        this._isDragging = false;
        return Clutter.EVENT_STOP;
      case Clutter.EventType.TOUCH_UPDATE: {
        if (this._touchStartY === null) return Clutter.EVENT_STOP;
        const deltaY = this._touchStartY - y;
        const newScrollYValue = this._scrollStartY + deltaY;
        const adjustment = scrollView.vadjustment;
        const clampedValue = Math.max(
          0,
          Math.min(
            newScrollYValue,
            adjustment.upper - adjustment.page_size
          )
        );
        adjustment.set_value(clampedValue);
        if (Math.abs(deltaY) > this.TOUCH_SCROLL_THRESHOLD)
          this._isDragging = true;
        return Clutter.EVENT_STOP;
      }
      case Clutter.EventType.TOUCH_END: {
        const wasDragging = this._isDragging;
        this._touchStartY = null;
        this._isDragging = false;
        return wasDragging ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
      }
      default:
        return Clutter.EVENT_PROPAGATE;
    }
  }
}

export {
  TouchEventHelper as default
};
