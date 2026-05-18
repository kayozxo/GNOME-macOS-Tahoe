import {Mod} from './mod.js'

import Clutter from 'gi://Clutter'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'

export default class extends Mod {
    show_search() {
        // Main.overview.searchEntry.show();
        Main.overview.searchEntry.get_parent().ease({
            height  : Main.overview.searchEntry.height,
            mode    : Clutter.AnimationMode.EASE,
            duration: 10,
        })
    }

    hide_search() {
        // Main.overview.searchEntry.hide();
        Main.overview.searchEntry.get_parent().ease({
            height  : 0,
            mode    : Clutter.AnimationMode.EASE,
            duration: 100,
        })
    }

    enable() {
        const onceConnectId = Main.overview.connect('showing', () => {
            this.hide_search()
            Main.overview.disconnect(onceConnectId)
        })

        this.connectedId = Main.overview._overview.controls._searchController.connect('notify::search-active', () => {
            if (Main.overview._overview.controls._searchController.searchActive) {
                this.show_search()
            } else {
                this.hide_search()
            }
        })
    }

    disable() {
        if (this.connectedId) {
            Main.overview._overview.controls._searchController.disconnect(this.connectedId)
        }

        this.show_search()
    }
}
