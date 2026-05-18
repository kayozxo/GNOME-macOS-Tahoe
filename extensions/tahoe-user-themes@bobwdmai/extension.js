// SPDX-FileCopyrightText: 2011 John Stowers <john.stowers@gmail.com>
// SPDX-FileCopyrightText: 2011 Giovanni Campagna <gcampagna@src.gnome.org>
// SPDX-FileCopyrightText: 2011 Elad Alfassa <el.il@doom.co.il>
// SPDX-FileCopyrightText: 2014 Florian Müllner <fmuellner@gnome.org>
//
// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {getThemeDirs, getModeThemeDirs} from './util.js';

const SETTINGS_KEY = 'name';

export default class ThemeManager extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._settings.connectObject(`changed::${SETTINGS_KEY}`,
            this._changeTheme.bind(this), this);
        this._changeTheme();
    }

    disable() {
        this._settings?.disconnectObject();
        this._settings = null;

        Main.setThemeStylesheet(null);
        Main.loadTheme();
    }

    _changeTheme() {
        let stylesheet = null;
        let themeName = this._settings.get_string(SETTINGS_KEY);

        if (themeName) {
            const stylesheetPaths = getThemeDirs()
                .map(dir => `${dir}/${themeName}/gnome-shell/gnome-shell.css`);

            stylesheetPaths.push(...getModeThemeDirs()
                .map(dir => `${dir}/${themeName}.css`));

            stylesheet = stylesheetPaths.find(path => {
                let file = Gio.file_new_for_path(path);
                return file.query_exists(null);
            });
        }

        if (stylesheet)
            log(`loading user theme: ${stylesheet}`);
        else
            log('loading default theme (Adwaita)');
        Main.setThemeStylesheet(stylesheet);
        Main.loadTheme();
    }
}
