import {Mod} from './mod.js'
import * as main from 'resource:///org/gnome/shell/ui/main.js'

import {SecondaryMonitorDisplay} from 'resource:///org/gnome/shell/ui/workspacesView.js'

export default class extends Mod {
    constructor(scaleFactor) {
        super()
        this.scaleFactor = scaleFactor / 100
    }

    enable() {
        let _thumbnailsBox = main.overview._overview._controls._thumbnailsBox;

        // Thumbnails on main monitor
        if (this.scaleFactor === _thumbnailsBox._maxThumbnailScale) {
            return
        }

        this.bkp_MAX_THUMBNAIL_SCALE = _thumbnailsBox._maxThumbnailScale
        _thumbnailsBox._maxThumbnailScale = this.scaleFactor
        
        const __scaleFactor = this.scaleFactor
        this.bkp_SecondaryMonitorDisplay_getThumbnailsHeight = SecondaryMonitorDisplay.prototype._getThumbnailsHeight
        SecondaryMonitorDisplay.prototype._getThumbnailsHeight = function(box) {
            if (!this || !this._thumbnails.visible)
                return 0;
            
            this._thumbnails._maxThumbnailScale = __scaleFactor

            const [width, height] = box.get_size();
            const {expandFraction} = this._thumbnails;
            const [thumbnailsHeight] = this._thumbnails.get_preferred_height(width);
            return Math.min(
                thumbnailsHeight * expandFraction,
                height * this._thumbnails.maxThumbnailScale);
        }
    }

    disable() {
        if (this.bkp_MAX_THUMBNAIL_SCALE) {
            let _thumbnailsBox = main.overview._overview._controls._thumbnailsBox;
            _thumbnailsBox._maxThumbnailScale = this.bkp_MAX_THUMBNAIL_SCALE
        }

        if (this.bkp_SecondaryMonitorDisplay_getThumbnailsHeight) {
            SecondaryMonitorDisplay.prototype._getThumbnailsHeight = this.bkp_SecondaryMonitorDisplay_getThumbnailsHeight
        }
    }
}
