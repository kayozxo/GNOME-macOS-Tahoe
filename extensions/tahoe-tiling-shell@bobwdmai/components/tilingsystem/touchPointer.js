import { buildRectangle } from "../../utils/ui.js";

class TouchPointer {
  static _instance = null;
  _x;
  _y;
  _windowPos;
  constructor() {
    this._x = -1;
    this._y = -1;
    this._windowPos = buildRectangle();
  }

  static get() {
    if (!this._instance) this._instance = new TouchPointer();
    return this._instance;
  }

  isTouchDeviceActive() {
    return this._x !== -1 && this._y !== -1 && this._windowPos.x !== -1 && this._windowPos.y !== -1;
  }

  onTouchEvent(x, y) {
    this._x = x;
    this._y = y;
  }

  updateWindowPosition(newSize) {
    this._windowPos.x = newSize.x;
    this._windowPos.y = newSize.y;
  }

  reset() {
    this._x = -1;
    this._y = -1;
    this._windowPos.x = -1;
    this._windowPos.y = -1;
  }

  get_pointer(window) {
    const currPos = window.get_frame_rect();
    this._x += currPos.x - this._windowPos.x;
    this._y += currPos.y - this._windowPos.y;
    this._windowPos.x = currPos.x;
    this._windowPos.y = currPos.y;
    return [this._x, this._y, global.get_pointer()[2]];
  }
}

export {
  TouchPointer as default
};
