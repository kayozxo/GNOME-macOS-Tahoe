import GLib from 'gi://GLib';
export class Timeout {
    constructor() {
        this._timeoutId = null;
    }
    destroy() {
        this.clearTimeout();
    }
    tick() {
        return new Promise((resolve) => {
            this.clearTimeout();
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 0, () => {
                this._timeoutId = null;
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });
    }
    once(milliseconds) {
        return new Promise((resolve) => {
            this.clearTimeout();
            this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
                this._timeoutId = null;
                resolve();
                return GLib.SOURCE_REMOVE;
            });
        });
    }
    clearTimeout() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
    }
}
