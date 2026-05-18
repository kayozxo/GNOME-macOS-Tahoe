import {Mod} from './mod.js'
import {titles} from './modFirefoxPipInOverview_titles.js'

import {Workspace} from  'resource:///org/gnome/shell/ui/workspace.js'

export default class extends Mod {
    enable() {
        this.bkp_isOverviewWindow = Workspace.prototype._isOverviewWindow
        const _isOverviewWindow = this.bkp_isOverviewWindow
        Workspace.prototype._isOverviewWindow = function(win) {
            if (win.title && titles[win.title]) {
                if (win.get_wm_class && win.get_wm_class().includes("firefox")) return true;
            }
            return _isOverviewWindow.call(this, win);
        }
    }

    disable() {
        if (this.bkp_isOverviewWindow) {
            Workspace.prototype._isOverviewWindow = this.bkp_isOverviewWindow
        }
    }
}