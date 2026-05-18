import {Mod} from './mod.js'

import {WorkspaceThumbnail} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js'
import {BackgroundManager} from  'resource:///org/gnome/shell/ui/background.js'

export default class extends Mod {
    enable() {
        // Thumbnails on main monitor
        this.bkp_thumb_init = WorkspaceThumbnail.prototype._init;
        const _init = this.bkp_thumb_init
        WorkspaceThumbnail.prototype._init = function(metaWorkspace, monitorIndex) {
            _init.call(this, metaWorkspace, monitorIndex)
            this._bgManager = new BackgroundManager({
                monitorIndex: monitorIndex,
                container: this._contents,
                vignette: false
            });
        }

        this.bkp_thumb_onDestroy = WorkspaceThumbnail.prototype._onDestroy;
        const _onDestroy = this.bkp_thumb_onDestroy
        WorkspaceThumbnail.prototype._onDestroy = function() {
            _onDestroy.call(this)
            if (this._bgManager) {
                this._bgManager.destroy();
                this._bgManager = null;
            }
        }
    }

    disable() {
        if (this.bkp_thumb_init) {
            WorkspaceThumbnail.prototype._init = this.bkp_thumb_init
        }

        if (this.bkp_thumb_onDestroy) {
            WorkspaceThumbnail.prototype._onDestroy = this.bkp_thumb_onDestroy
        }
    }
}
