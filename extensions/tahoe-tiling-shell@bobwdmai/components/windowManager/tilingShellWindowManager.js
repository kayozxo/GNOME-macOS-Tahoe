var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { registerGObjectClass } from "../../utils/gjs.js";
import SignalHandling from "../../utils/signalHandling.js";
import { GObject, Meta, Clutter, Graphene } from "../../gi/ext.js";

class CachedWindowProperties {
  _is_initialized = false;
  maximized = false;
  constructor(window, manager) {
    this.update(window, manager);
    this._is_initialized = true;
  }

  update(window, manager) {
    const newMaximized = window.maximizedVertically && window.maximizedHorizontally;
    if (this._is_initialized) {
      if (this.maximized && !newMaximized)
        manager.emit("unmaximized", window);
      else if (!this.maximized && newMaximized)
        manager.emit("maximized", window);
    }
    this.maximized = newMaximized;
  }
}

const _TilingShellWindowManager = class _TilingShellWindowManager extends GObject.Object {
  _signals;
  static get() {
    if (!this._instance) this._instance = new _TilingShellWindowManager();
    return this._instance;
  }

  static destroy() {
    if (this._instance) {
      this._instance._signals.disconnect();
      this._instance = null;
    }
  }

  constructor() {
    super();
    this._signals = new SignalHandling();
    global.get_window_actors().forEach((winActor) => {
      winActor.metaWindow.__ts_cached = new CachedWindowProperties(winActor.metaWindow, this);
    });
    this._signals.connect(
      global.display,
      "window-created",
      (_, window) => {
        window.__ts_cached = new CachedWindowProperties(window, this);
      }
    );
    this._signals.connect(
      global.windowManager,
      "minimize",
      (_, actor) => {
        actor.metaWindow.__ts_cached?.update(
          actor.metaWindow,
          this
        );
      }
    );
    this._signals.connect(
      global.windowManager,
      "unminimize",
      (_, actor) => {
        actor.metaWindow.__ts_cached?.update(
          actor.metaWindow,
          this
        );
      }
    );
    this._signals.connect(
      global.windowManager,
      "size-changed",
      (_, actor) => {
        actor.metaWindow.__ts_cached?.update(
          actor.metaWindow,
          this
        );
      }
    );
  }

  static easeMoveWindow(params) {
    const winActor = params.window.get_compositor_private();
    if (!winActor) return;
    const winRect = params.window.get_frame_rect();
    const xExcludingShadow = winRect.x - winActor.get_x();
    const yExcludingShadow = winRect.y - winActor.get_y();
    const staticClone = new Clutter.Clone({
      source: winActor,
      reactive: false,
      scale_x: 1,
      scale_y: 1,
      x: params.from.x,
      y: params.from.y,
      width: params.from.width,
      height: params.from.height,
      pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 })
    });
    global.windowGroup.add_child(staticClone);
    winActor.opacity = 0;
    staticClone.ease({
      x: params.to.x - xExcludingShadow,
      y: params.to.y - yExcludingShadow,
      width: params.to.width + 2 * yExcludingShadow,
      height: params.to.height + 2 * xExcludingShadow,
      duration: params.duration,
      onStopped: () => {
        winActor.opacity = 255;
        winActor.set_scale(1, 1);
        staticClone.destroy();
      }
    });
    winActor.set_pivot_point(0, 0);
    winActor.set_position(params.to.x, params.to.y);
    winActor.set_size(params.to.width, params.to.height);
    const user_op = false;
    if (params.monitorIndex)
      params.window.move_to_monitor(params.monitorIndex);
    params.window.move_frame(user_op, params.to.x, params.to.y);
    params.window.move_resize_frame(
      user_op,
      params.to.x,
      params.to.y,
      params.to.width,
      params.to.height
    );
    winActor.show();
  }
};
registerGObjectClass(_TilingShellWindowManager, {
  GTypeName: "TilingShellWindowManager",
  Signals: {
    unmaximized: {
      param_types: [Meta.Window.$gtype]
    },
    maximized: {
      param_types: [Meta.Window.$gtype]
    }
  }
});
__publicField(_TilingShellWindowManager, "_instance");
let TilingShellWindowManager = _TilingShellWindowManager;
export {
  TilingShellWindowManager as default
};
