import { GObject, St, Clutter, Shell, Gio } from "../../gi/ext.js";
import SignalHandling from "../../utils/signalHandling.js";
import { registerGObjectClass } from "../../utils/gjs.js";
import Settings from "../../settings/settings.js";
import {
  buildRectangle,
  enableScalingFactorSupport,
  getMonitorScalingFactor,
  getScalingFactorOf,
  getScalingFactorSupportString
} from "../../utils/ui.js";
Gio._promisify(Shell.Screenshot, "composite_to_stream");
const DEFAULT_BORDER_RADIUS = 11;
const SMART_BORDER_RADIUS_FIRST_FRAME_DELAY = 240;
const _WindowBorder = class _WindowBorder extends St.DrawingArea {
  _signals;
  _window;
  _windowMonitor;
  _bindings;
  _enableScaling;
  _borderRadiusValue;
  _timeout;
  _delayedSmartBorderRadius;
  _scaledBorderWidth;
  constructor(win, enableScaling) {
    super({
      style_class: "window-border"
    });
    this._signals = new SignalHandling();
    this._bindings = [];
    this._scaledBorderWidth = 1;
    this._window = win;
    this._windowMonitor = win.get_monitor();
    this._enableScaling = enableScaling;
    this._delayedSmartBorderRadius = false;
    const smartRadius = Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS;
    this._borderRadiusValue = [
      DEFAULT_BORDER_RADIUS,
      DEFAULT_BORDER_RADIUS,
      smartRadius ? 0 : DEFAULT_BORDER_RADIUS,
      smartRadius ? 0 : DEFAULT_BORDER_RADIUS
    ];
    this.close();
    global.windowGroup.add_child(this);
    this.trackWindow(win, true);
    this.connect("destroy", () => {
      this._bindings.forEach((b) => b.unbind());
      this._bindings = [];
      this._signals.disconnect();
      if (this._timeout) clearTimeout(this._timeout);
      this._timeout = void 0;
    });
  }

  trackWindow(win, force = false) {
    if (!force && this._window === win) return;
    this._bindings.forEach((b) => b.unbind());
    this._bindings = [];
    this._signals.disconnect();
    this._window = win;
    this.close();
    const winActor = this._window.get_compositor_private();
    this._bindings = [
      "scale-x",
      "scale-y",
      "translation_x",
      "translation_y"
    ].map(
      (prop) => winActor.bind_property(
        prop,
        this,
        prop,
        GObject.BindingFlags.DEFAULT
        // if winActor changes, this will change
      )
    );
    if (Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS) {
      const cached_radius = this._window.__ts_cached_radius;
      if (cached_radius) {
        this._borderRadiusValue[St.Corner.TOPLEFT] = cached_radius[St.Corner.TOPLEFT];
        this._borderRadiusValue[St.Corner.TOPRIGHT] = cached_radius[St.Corner.TOPRIGHT];
        this._borderRadiusValue[St.Corner.BOTTOMLEFT] = cached_radius[St.Corner.BOTTOMLEFT];
        this._borderRadiusValue[St.Corner.BOTTOMRIGHT] = cached_radius[St.Corner.BOTTOMRIGHT];
      }
    }
    this.updateStyle();
    const winRect = this._window.get_frame_rect();
    this.set_position(
      winRect.x - this._scaledBorderWidth,
      winRect.y - this._scaledBorderWidth
    );
    this.set_size(
      winRect.width + 2 * this._scaledBorderWidth,
      winRect.height + 2 * this._scaledBorderWidth
    );
    const isMaximized = this._window.maximizedVertically && this._window.maximizedHorizontally;
    if (this._window.is_fullscreen() || isMaximized || this._window.minimized || !winActor.visible)
      this.close();
    else this.open();
    this._signals.connect(global.display, "restacked", () => {
      this.queue_repaint();
      global.windowGroup.set_child_above_sibling(this, null);
    });
    this._signals.connect(this._window, "position-changed", () => {
      if (this._window.maximizedVertically || this._window.maximizedHorizontally || this._window.minimized || this._window.is_fullscreen()) {
        this.remove_all_transitions();
        this.close();
        return;
      }
      if (this._delayedSmartBorderRadius && Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS) {
        this._delayedSmartBorderRadius = false;
        this._runComputeBorderRadiusTimeout(winActor);
      }
      const rect = this._window.get_frame_rect();
      this.set_position(
        rect.x - this._scaledBorderWidth,
        rect.y - this._scaledBorderWidth
      );
      if (this._windowMonitor !== win.get_monitor()) {
        this._windowMonitor = win.get_monitor();
        this.updateStyle();
      }
      this.open();
    });
    this._signals.connect(this._window, "size-changed", () => {
      if (this._window.maximizedVertically || this._window.maximizedHorizontally || this._window.minimized || this._window.is_fullscreen()) {
        this.remove_all_transitions();
        this.close();
        return;
      }
      if (this._delayedSmartBorderRadius && Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS) {
        this._delayedSmartBorderRadius = false;
        this._runComputeBorderRadiusTimeout(winActor);
      }
      const rect = this._window.get_frame_rect();
      this.set_size(
        rect.width + 2 * this._scaledBorderWidth,
        rect.height + 2 * this._scaledBorderWidth
      );
      if (this._windowMonitor !== win.get_monitor()) {
        this._windowMonitor = win.get_monitor();
        this.updateStyle();
      }
      this.open();
    });
    if (Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS) {
      const firstFrameId = winActor.connect_after("first-frame", () => {
        if (this._window.maximizedHorizontally || this._window.maximizedVertically || this._window.is_fullscreen()) {
          this._delayedSmartBorderRadius = true;
          return;
        }
        this._runComputeBorderRadiusTimeout(winActor);
        winActor.disconnect(firstFrameId);
      });
    }
  }

  _runComputeBorderRadiusTimeout(winActor) {
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = void 0;
    this._timeout = setTimeout(() => {
      this._computeBorderRadius(winActor).then(() => this.updateStyle());
      if (this._timeout) clearTimeout(this._timeout);
      this._timeout = void 0;
    }, SMART_BORDER_RADIUS_FIRST_FRAME_DELAY);
  }

  async _computeBorderRadius(winActor) {
    const width = 3;
    const height = winActor.metaWindow.get_frame_rect().height;
    if (height <= 0) return;
    const content = winActor.paint_to_content(
      buildRectangle({
        x: winActor.metaWindow.get_frame_rect().x,
        y: winActor.metaWindow.get_frame_rect().y,
        height,
        width
      })
    );
    if (!content) return;
    const texture = content.get_texture();
    const stream = Gio.MemoryOutputStream.new_resizable();
    const x = 0;
    const y = 0;
    const pixbuf = await Shell.Screenshot.composite_to_stream(
      texture,
      x,
      y,
      width,
      height,
      1,
      null,
      0,
      0,
      1,
      stream
    );
    const pixels = pixbuf.get_pixels();
    const alphaThreshold = 240;
    for (let i = 0; i < height; i++) {
      if (pixels[i * width * 4 + 3] > alphaThreshold) {
        this._borderRadiusValue[St.Corner.TOPLEFT] = i;
        this._borderRadiusValue[St.Corner.TOPRIGHT] = this._borderRadiusValue[St.Corner.TOPLEFT];
        break;
      }
    }
    for (let i = height - 1; i >= height - this._borderRadiusValue[St.Corner.TOPLEFT] - 2; i--) {
      if (pixels[i * width * 4 + 3] > alphaThreshold) {
        this._borderRadiusValue[St.Corner.BOTTOMLEFT] = height - i - 1;
        this._borderRadiusValue[St.Corner.BOTTOMRIGHT] = this._borderRadiusValue[St.Corner.BOTTOMLEFT];
        break;
      }
    }
    stream.close(null);
    const cached_radius = [
      DEFAULT_BORDER_RADIUS,
      DEFAULT_BORDER_RADIUS,
      0,
      0
    ];
    cached_radius[St.Corner.TOPLEFT] = this._borderRadiusValue[St.Corner.TOPLEFT];
    cached_radius[St.Corner.TOPRIGHT] = this._borderRadiusValue[St.Corner.TOPRIGHT];
    cached_radius[St.Corner.BOTTOMLEFT] = this._borderRadiusValue[St.Corner.BOTTOMLEFT];
    cached_radius[St.Corner.BOTTOMRIGHT] = this._borderRadiusValue[St.Corner.BOTTOMRIGHT];
    this._window.__ts_cached_radius = cached_radius;
  }

  updateStyle() {
    const monitorScalingFactor = this._enableScaling ? getMonitorScalingFactor(this._window.get_monitor()) : void 0;
    enableScalingFactorSupport(this, monitorScalingFactor);
    const [alreadyScaled, scalingFactor] = getScalingFactorOf(this);
    const borderWidth = (alreadyScaled ? 1 : scalingFactor) * (Settings.WINDOW_BORDER_WIDTH / (alreadyScaled ? scalingFactor : 1));
    this._scaledBorderWidth = scalingFactor * Settings.WINDOW_BORDER_WIDTH;
    const borderColor = Settings.WINDOW_USE_CUSTOM_BORDER_COLOR ? Settings.WINDOW_BORDER_COLOR : "-st-accent-color";
    const radius = this._borderRadiusValue.map((val) => {
      const valWithBorder = val === 0 ? val : val + borderWidth;
      return (alreadyScaled ? 1 : scalingFactor) * (valWithBorder / (alreadyScaled ? scalingFactor : 1));
    });
    const scalingFactorSupportString = monitorScalingFactor ? `${getScalingFactorSupportString(monitorScalingFactor)};` : "";
    this.set_style(
      `border-color: ${borderColor}; border-radius: ${radius[St.Corner.TOPLEFT]}px ${radius[St.Corner.TOPRIGHT]}px ${radius[St.Corner.BOTTOMRIGHT]}px ${radius[St.Corner.BOTTOMLEFT]}px; ${scalingFactorSupportString}`
    );
  }

  vfunc_repaint() {
    const cr = this.get_context();
    const themeNode = this.get_theme_node();
    const [width, height] = this.get_surface_size();
    if (!width || !height) return;
    const borderWidth = this._scaledBorderWidth;
    const borderColor = themeNode.get_border_color(null);
    const radius = [0, 0, 0, 0];
    radius[St.Corner.TOPLEFT] = themeNode.get_border_radius(St.Corner.TOPLEFT);
    radius[St.Corner.TOPRIGHT] = themeNode.get_border_radius(St.Corner.TOPRIGHT);
    radius[St.Corner.BOTTOMLEFT] = themeNode.get_border_radius(St.Corner.BOTTOMLEFT);
    radius[St.Corner.BOTTOMRIGHT] = themeNode.get_border_radius(St.Corner.BOTTOMRIGHT);
    const x = borderWidth / 2;
    const y = borderWidth / 2;
    const w = width - borderWidth;
    const h = height - borderWidth;
    cr.setSourceRGBA(borderColor.red / 255, borderColor.green / 255, borderColor.blue / 255, borderColor.alpha / 255);
    cr.setLineWidth(borderWidth);
    cr.newPath();
    cr.arc(x + radius[St.Corner.TOPLEFT], y + radius[St.Corner.TOPLEFT], radius[St.Corner.TOPLEFT], Math.PI, Math.PI * 1.5);
    cr.lineTo(x + w - radius[St.Corner.TOPRIGHT], y);
    cr.arc(x + w - radius[St.Corner.TOPRIGHT], y + radius[St.Corner.TOPRIGHT], radius[St.Corner.TOPRIGHT], Math.PI * 1.5, 0);
    cr.lineTo(x + w, y + h - radius[St.Corner.BOTTOMRIGHT]);
    cr.arc(x + w - radius[St.Corner.BOTTOMRIGHT], y + h - radius[St.Corner.BOTTOMRIGHT], radius[St.Corner.BOTTOMRIGHT], 0, Math.PI * 0.5);
    cr.lineTo(x + radius[St.Corner.BOTTOMLEFT], y + h);
    cr.arc(x + radius[St.Corner.BOTTOMLEFT], y + h - radius[St.Corner.BOTTOMLEFT], radius[St.Corner.BOTTOMLEFT], Math.PI * 0.5, Math.PI);
    cr.closePath();
    cr.stroke();
    cr.save();
    const winRect = this._window.get_frame_rect();
    this._window.foreach_transient((_transient) => {
      const transientRect = _transient.get_frame_rect();
      const transientX = transientRect.x - winRect.x + borderWidth;
      const transientY = transientRect.y - winRect.y + borderWidth;
      const transientWidth = transientRect.width;
      const transientHeight = transientRect.height;
      cr.rectangle(transientX, transientY, transientWidth, transientHeight);
      return true;
    });
    cr.clip();
    cr.setOperator(0);
    cr.paint();
    cr.restore();
    cr.$dispose();
  }

  open() {
    if (this.visible) return;
    this.show();
    this.ease({
      opacity: 255,
      duration: 200,
      mode: Clutter.AnimationMode.EASE,
      delay: 130
    });
  }

  close() {
    this.set_opacity(0);
    this.hide();
  }
};
registerGObjectClass(_WindowBorder);
let WindowBorder = _WindowBorder;
export {
  WindowBorder as default
};
