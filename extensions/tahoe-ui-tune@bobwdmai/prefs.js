'use strict';

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as modsListNames from './src/modsListNames.js'

export default class extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings()

        const page = new Adw.PreferencesPage({
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('settings-mods-list'),
            //description: _('settings-mods-list'),
        });
        page.add(group);

        const mods_list = modsListNames.getNames()
        for (let modNum = 0; modNum < mods_list.length; modNum++) {
            const key = mods_list[modNum]

            const rowNum = modNum + 1

            let row = null
            const value = settings.get_value(key)
            switch (value.get_type_string()) {
                case "s":
                    row = new Adw.ActionRow({
                        title: _(key),
                    })
                    const toggle = new Gtk.Box({halign: Gtk.Align.END, css_classes: ['linked']})
                    const value_enum = settings.get_enum(key)
                    const value_string = settings.get_string(key)

                    const values = settings.get_range(key).deep_unpack()[1].deep_unpack()

                    let btn = null
                    for (let v in values) {
                        btn = new Gtk.ToggleButton({
                            active: value_string === values[v],
                            label : values[v],
                            group : btn
                        })
                        toggle.append(btn)
                        btn.connect('toggled', button => {
                            button.active && settings.set_string(key, values[v])
                        })
                    }
                    row.add_suffix(toggle)
                    break

                default:
                    row = new Adw.SwitchRow({
                        title: _(key),
                        //subtitle: _(key),
                    })
                    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT)
            }

            group.add(row);
        }
    }
}
