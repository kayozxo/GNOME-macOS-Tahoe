import {Mod} from './mod.js'

import {ThumbnailsBox} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js'

export default class extends Mod {
    enable() {
        this.bkp = ThumbnailsBox.prototype._updateShouldShow
        ThumbnailsBox.prototype._updateShouldShow = function() {
            if (!this._shouldShow) {
                this._shouldShow = true;
                this.notify('should-show');
            }
        }
    }

    disable() {
        if (this.bkp) {
            ThumbnailsBox.prototype._updateShouldShow = this.bkp
        }
    }
}
