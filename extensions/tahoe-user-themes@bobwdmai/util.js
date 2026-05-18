// SPDX-FileCopyrightText: 2020 Florian Müllner <fmuellner@gnome.org>
//
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';

const fn = (...args) => GLib.build_filenamev(args);

/**
 * @returns {string[]} - an ordered list of theme directories
 */
export function getThemeDirs() {
    return [
        fn(GLib.get_home_dir(), '.themes'),
        fn(GLib.get_user_data_dir(), 'themes'),
        ...GLib.get_system_data_dirs().map(dir => fn(dir, 'themes')),
    ];
}

/**
 * @returns {string[]} - an ordered list of mode theme directories
 */
export function getModeThemeDirs() {
    return GLib.get_system_data_dirs()
        .map(dir => fn(dir, 'gnome-shell', 'theme'));
}
