/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 * author: neuromorph
 */

/* exported Openbar */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Calendar from 'resource:///org/gnome/shell/ui/calendar.js';
import * as LayoutManager from 'resource:///org/gnome/shell/ui/layout.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Quantize from './quantize.js';
import * as AutoThemes from './autothemes.js';
import * as StyleSheets from './stylesheets.js';

Gio._promisify(Gio.File.prototype, "copy_async", "copy_finish");

// ConnectManager class to manage connections for events to trigger Openbar style updates
// This class is modified from Floating Panel extension (Thanks Aylur!)
class ConnectManager{
    constructor(list = []){
        this.connections = [];

        list.forEach(c => {
            let [obj, signal, callback, callback_param] = c;
            this.connect(obj, signal, callback, callback_param);
        });
    }

    connect(obj, signal, callback, callback_param){
        this.connections.push({
            id : obj.connect(signal, (object, signal_param) => {callback(object, signal, signal_param, callback_param)}),
            obj: obj,
            sig: signal
        });
        // Remove obj on destroy except following that don't have destroy signal
        if(!(obj instanceof Gio.Settings || obj instanceof LayoutManager.LayoutManager || obj instanceof Meta.WorkspaceManager | obj instanceof Meta.Display)) {
            obj.connect('destroy', () => {
                this.removeObject(obj)
            });
        }
    }

    // remove an object WITHOUT disconnecting it, use only when you know the object is destroyed
    removeObject(object){
        this.connections = this.connections.filter(({id, obj, sig}) => obj != object);
    }

    disconnect(object, signal){
        let disconnections = this.connections.filter(({id, obj, sig}) => obj == object && sig == signal);
        disconnections.forEach(c => {
            c.obj.disconnect(c.id);
        });
        this.connections = this.connections.filter(({id, obj, sig}) => obj != object || sig != signal);
    }

    disconnectAll(){
        this.connections.forEach(c => {
            // console.log('Disconnect All - c.id: ', c.id);
            if(c.obj && c.id > 0)
                c.obj.disconnect(c.id);
        })
    }
}


// Openbar Extension main class
export default class Openbar extends Extension {
    constructor(metadata) {
        super(metadata);
        this._settings = null;
        this._bgSettings = null;
        this._intSettings = null;
        this._hcSettings = null;
        this._connections = null;
        this._injections = [];
    }

    // Generate a color palette from desktop background image
    getPaletteFromImage(pictureUri) {
        let pictureFile = Gio.File.new_for_uri(pictureUri);

        // Load the image into a pixbuf
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(pictureFile.get_path(), 1000, -1);
        let nChannels = pixbuf.n_channels;

        // Get the width, height and pixel count of the image
        let width = pixbuf.get_width();
        let height = pixbuf.get_height();
        let pixelCount = width*height;
        let offset = 1;

        // Get the pixel data as an array of bytes
        let pixels = pixbuf.get_pixels();

        let pixelArray = [];
        // Loop through the pixels and get the rgba values
        for (let i = 0, index, r, g, b, a; i < pixelCount; i = i + offset) {
            index = i * nChannels;

            // Get the red, green, blue, and alpha values
            r = pixels[index];
            g = pixels[index + 1];
            b = pixels[index + 2];

            a = nChannels==4? pixels[index + 3] : undefined;

            // Save pixles that are not transparent and not full white/black
            if (typeof a === 'undefined' || a >= 125) {
                if (!(r > 250 && g > 250 && b > 250) && !(r < 5 && g < 5 && b < 5)) {
                    pixelArray.push([r, g, b]);
                    // pixelArray.push(Material.argbFromRgb(r, g, b));
                }
            }
        }
        // console.log('pixelCount, pixelarray len ', pixelCount, pixelArray.length);

        // Generate color palette of 12 colors using Quantize to possibly get all colors for color-button
        const cmap12 = Quantize.quantize(pixelArray, 12);
        const palette12 = cmap12? cmap12.palette() : null;
        const count12 = cmap12? cmap12.colorCounts() : null;

        // Sort palette12 and count12 arrays by count descending
        palette12?.sort((a, b) => count12[palette12.indexOf(b)] - count12[palette12.indexOf(a)]);
        count12?.sort((a, b) => b - a);
        // console.log('palette12 sorted ', palette12, 'count12 sorted ', count12);

        return [palette12, count12];
    }

    backgroundPalette() {
        // Get the latest background image file (from picture-uri and picture-uri-dark)
        let pictureUriDark = this._settings.get_string('dark-bguri');
        let pictureUriLight = this._settings.get_string('light-bguri');
        const currentMode = this._intSettings.get_string('color-scheme');
        let darklight, palette12, count12, pictureUri;
        let uriArr = [pictureUriDark, pictureUriLight];
        let sameUri = pictureUriDark == pictureUriLight;

        for(let i = 0; i < uriArr.length; i++) {
            darklight = (i==0) ? 'dark' : 'light';
            pictureUri = uriArr[i];

            if(pictureUri.endsWith('.xml') || pictureUri.endsWith('.XML'))
                continue;

            // Generate palette only once if both URI are same
            if(!sameUri || i == 0) {
                [palette12, count12] = this.getPaletteFromImage(pictureUri);
            }

            // Save palette and counts to settings
            let paletteIdx = 1;
            palette12?.forEach(color => {
                // Save palette to dark/light settings
                this._settings.set_strv(darklight+'-'+'palette'+paletteIdx, [String(color[0]), String(color[1]), String(color[2])]);
                // Copy the palette for current mode to main settings
                if( (sameUri && i == 0) ||
                    (darklight == 'dark' && currentMode == 'prefer-dark') ||
                    (darklight == 'light' && currentMode != 'prefer-dark'))
                    this._settings.set_strv('palette'+paletteIdx, [String(color[0]), String(color[1]), String(color[2])]);
                paletteIdx++;
            });
            let countIdx = 1;
            count12?.forEach(count => {
                this._settings.set_int('count'+countIdx, count12[countIdx-1]);
                countIdx++;
            });

            // Toggle setting 'bg-change' to update the current mode palette in preferences window
            if( (sameUri && i == 0) ||
                (darklight == 'dark' && currentMode == 'prefer-dark') ||
                (darklight == 'light' && currentMode != 'prefer-dark')) {
                let bgchange = this._settings.get_boolean('bg-change');
                if(bgchange)
                    this._settings.set_boolean('bg-change', false);
                else
                    this._settings.set_boolean('bg-change', true);
            }

            // Apply auto theme for new background palette if auto-refresh enabled and theme set for this iteration (darklight)
            const autoRefresh = this._settings.get_boolean('autotheme-refresh');
            let theme;
            if(darklight == 'dark')
                theme = this._settings.get_string('autotheme-dark');
            else
                theme = this._settings.get_string('autotheme-light');
            if(autoRefresh && theme != 'Select Theme') {
                // console.log('Auto theme refresh for ', darklight);
                AutoThemes.autoApplyBGPalette(this, darklight);
            }
        }
    }

    _injectToFunction(parent, name, func) {
        let origin = parent[name];
        parent[name] = function () {
          let ret;
          ret = origin.apply(this, arguments);
          if (ret === undefined) ret = func.apply(this, arguments);
          return ret;
        };
        return origin;
    }

    _removeInjection(object, injection, name) {
        if (injection[name] === undefined) delete object[name];
        else object[name] = injection[name];
    }

    unloadStylesheet() {
        const theme = this.themeContext.get_theme();
        const stylesheet = this.obarRunDir.get_child('stylesheet.css');
        try {
            theme.unload_stylesheet(stylesheet);
        }
        catch (e) {
            console.log('Openbar: Error unloading stylesheet: ', e);
        }
    }

    loadStylesheet() {
        const theme = this.themeContext.get_theme();
        const stylesheet = this.obarRunDir.get_child('stylesheet.css');
        try {
            theme.load_stylesheet(stylesheet);
        }
        catch (e) {
            console.log('Openbar: Error loading stylesheet: ', e);
        }
    }

    reloadStylesheet() {
        // Unload stylesheet
        this.unloadStylesheet();

        // Load stylesheet
        this.loadStylesheet();
    }

    // Add or remove 'openmenu' class
    applyMenuClass(obj, add) {
        if(!obj)
            return;
        if(add) {
            if(obj.add_style_class_name)
                obj.add_style_class_name('openmenu');
        }
        else {
            if(obj.remove_style_class_name)
                obj.remove_style_class_name('openmenu');
        }
    }

    // Add/Remove openmenu class to the object and its children/subchildren
    applyBoxStyles(box, add) {
        this.applyMenuClass(box, add);

        let menuChildren = box.get_children();
        menuChildren.forEach(menuItem => {
            this.applyMenuClass(menuItem, add);
            if(menuItem.menu) {
                this.applyMenuClass(menuItem.menu.box, add);
                menuItem.menu.box.get_children().forEach(child => {
                    this.applyMenuClass(child, add);
                });
            }

            let subChildren = menuItem.get_children(); // Required for submenus, at least in Gnome 42 settings menu
            subChildren.forEach(menuchild => {
                this.applyMenuClass(menuchild, add);
                if(menuchild.menu) {
                    this.applyMenuClass(menuchild.menu.box, add);
                    menuchild.menu.box.get_children().forEach(child => {
                        this.applyMenuClass(child, add);
                    });
                }
            });
        });
    }

    // Add/Remove openmenu class to Notifications and Media message lists
    // as well as to any other lists added by other extensions
    applySectionStyles(list, add) {
        list.get_children().forEach((section, idx) => {
            let msgList = section._list;
            if(add && !this.msgListIds[idx]) {
                this.msgListIds[idx] = msgList?.connect(this.addedSignal, (container, actor) => {
                    this.applyMenuClass(actor.child, add);
                });
                this.msgLists[idx] = msgList;
            }
            else if(!add && this.msgListIds[idx]) {
                msgList?.disconnect(this.msgListIds[idx]);
                this.msgListIds[idx] = null;
                this.msgLists[idx] = null;
            }
            msgList?.get_children().forEach(msg => {
                this.applyMenuClass(msg.child, add);
            });
        });
    }

    // Go through each panel button's menu to add/remove openmenu class to its children
    applyMenuStyles(panel, add) {
        for(const box of this.panelBoxes) {
            for(const btn of box) { // btn is a bin, parent of indicator button
                if(btn.child instanceof PanelMenu.Button || btn.child instanceof PanelMenu.ButtonBox) { // btn.child is the indicator

                    // box pointer case, to update -arrow-rise for bottom panel
                    if(btn.child.menu?._boxPointer) {
                        this.applyMenuClass(btn.child.menu._boxPointer, add);
                    }

                    // special case for Quick Settings Audio Panel, because it changes the layout of the Quick Settings menu
                    if(btn.child.menu?.constructor.name == "PanelGrid") {
                        for(const panel of btn.child.menu._get_panels()) {
                            this.applyBoxStyles(panel, add);
                        }
                    }
                    // general case
                    else if(btn.child.menu?.box) {
                        this.applyBoxStyles(btn.child.menu.box, add);
                    }

                    // special case for Arc Menu, because it removes default menu and creates its own menu
                    if(btn.child.constructor.name === 'ArcMenuMenuButton') {
                        let menu = btn.child.arcMenu;
                        this.applyMenuClass(menu, add);
                        if(menu.box)
                            this.applyBoxStyles(menu.box, add);

                        let ctxMenu = btn.child.arcMenuContextMenu;
                        this.applyMenuClass(ctxMenu, add);
                        if(ctxMenu.box)
                            this.applyBoxStyles(ctxMenu.box, add);
                    }

                    // DateMenu: Notifications (messages and media), DND and Clear buttons
                    //           Calendar Grid, Events, World Clock, Weather
                    if(btn.child.constructor.name === 'DateMenuButton') {
                        const bin = btn.child.menu.box.get_child_at_index(0); // CalendarArea
                        const hbox = bin.get_child_at_index(0); // hbox with left and right sections

                        const msgList = hbox.get_child_at_index(0); // Left Pane/Section with notifications etc
                        this.applyMenuClass(msgList, add);
                        const placeholder = msgList.get_child_at_index(0); // placeholder for 'No Notifications'
                        this.applyMenuClass(placeholder, add);
                        const msgbox = msgList.get_child_at_index(1);
                        const msgScroll = msgbox.get_child_at_index(0);
                        const sectionList = msgScroll.child;
                        if(add) {
                            this._connections.connect(sectionList, this.addedSignal, (container, actor) => {
                                // console.log('section added: ', actor.constructor.name);
                                this.applySectionStyles(sectionList, add);
                            });
                        }
                        else
                            this._connections?.disconnect(sectionList, this.addedSignal);
                        this.applySectionStyles(sectionList, add);

                        const msgHbox = msgbox.get_child_at_index(1); // hbox at botton for dnd and clear buttons
                        let clearBtn;
                        if(this.gnomeVersion < 49) {
                            const dndBtn = msgHbox.get_child_at_index(1);
                            this.applyMenuClass(dndBtn, add);
                            const toggleSwitch = dndBtn.get_child_at_index(0);
                            this.applyMenuClass(toggleSwitch, add);
                            clearBtn = msgHbox.get_child_at_index(2);
                        }
                        else {
                            clearBtn = msgHbox.get_child_at_index(1);
                        }
                        this.applyMenuClass(clearBtn, add);

                        const vbox = hbox.get_child_at_index(1); // Right Pane/Section vbox for calendar etc
                        vbox.get_children().forEach(item => {
                            this.applyMenuClass(item, add);
                            item.get_children().forEach(child => {
                                this.applyMenuClass(child, add);
                                child.get_children().forEach(subch => {
                                    this.applyMenuClass(subch, add);
                                })
                            });

                            if(item.constructor.name === 'Calendar') {
                                this.applyCalendarGridStyle(item, add);
                                this.calendarTimeoutId = setTimeout(() => {
                                    this.applyCalendarGridStyle(item, add);
                                    this.calendarTimeoutId = null;
                                }, 250);
                            }
                        });
                    }

                }
            }
        }
    }

    applyCalendarGridStyle(item, add) { // calendar days grid with week numbers
        for(let i=0; i<8; i++) {
            for(let j=0; j<8; j++) {
                const child = item.layout_manager.get_child_at(i, j);
                this.applyMenuClass(child, add);
             }
        }
    }

    // Add OpenBar style classes to Panel and Panel-Buttons
    setPanelStyle(obj, key, sig_param, callbk_param) {
        // console.log('setPanelStyle: ', String(obj), key, String(sig_param), callbk_param);
        const panel = Main.panel;
        const bartype = this._settings.get_string('bartype');
        const buttonBgWMax = this._settings.get_boolean('buttonbg-wmax');
        const candybar = this._settings.get_boolean('candybar');
        const setOverview = this._settings.get_boolean('set-overview');
        // Add/remove candybar class as per settings
        if(candybar &&
            (setOverview || !panel.has_style_pseudo_class('overview')) &&
            (buttonBgWMax || !panel.has_style_pseudo_class('windowmax')))
            panel.add_style_class_name('candybar');
        else
            panel.remove_style_class_name('candybar');
        // Add/remove trialnds class as per bartype
        if(bartype == 'Trilands')
            panel.add_style_class_name('trilands');
        else
            panel.remove_style_class_name('trilands');

        let i = 0, idx, isFirst, firstIdx, lastIdx;
        for(const box of this.panelBoxes) {
            isFirst = true; idx = 0; firstIdx = 0; lastIdx = 0;
            for(const btn of box) {
                // Screen recording/share indicators use ButtonBox instead of Button
                if(btn.child instanceof PanelMenu.Button || btn.child instanceof PanelMenu.ButtonBox) {
                    if(btn.child.visible) {
                        if(isFirst) {
                            firstIdx = idx;
                            isFirst = false;
                        }
                        lastIdx = idx;
                        // console.log('Visible Child: ', String(btn.child));
                        btn.add_style_class_name('button-container');

                        // Add candybar classes if enabled else remove them
                        if(key == 'enabled' || key == 'candybar' || key == 'showing' || key == 'hiding' || key == 'overview'
                            || key == 'notify::visible' || key == this.addedSignal || key == this.removedSignal) {
                            for(let j=1; j<=16; j++) {
                                btn.child.remove_style_pseudo_class('candy'+j);
                            }
                            i++; i = i%16; i = i==0? 16: i; // Cycle through candybar palette
                            if(candybar) {
                                btn.child.add_style_pseudo_class('candy'+i);
                            }
                        }

                        if(btn.child.constructor.name === 'DateMenuButton') {
                            // Remove padding widget to get rid of empty space on left when Message/DND indicator is on right
                            if(!this.dateMenuLeftPadWidget) {
                                this.dateMenuBtnBox = btn.child.get_first_child();
                                this.dateMenuLeftPadWidget = this.dateMenuBtnBox.get_first_child();
                                this.dateMenuBtnBox.remove_child(this.dateMenuLeftPadWidget);
                            }
                        }
                    }
                }

                idx++;
            }

            // Add trilands pseudo-classes if enabled else remove them
            let btns = box.get_children();
            if(bartype == 'Trilands') {
                for(let k=0; k<btns.length; k++) {
                    if(btns[k].child instanceof PanelMenu.Button || btns[k].child instanceof PanelMenu.ButtonBox) {
                        if(k == firstIdx && k != lastIdx)
                            box.set_child_at_index(btns[k], 0);
                        else if(k == lastIdx && k != firstIdx)
                            box.set_child_at_index(btns[k], btns.length-1);
                    }
                }
            }
            // for(let k=0; k<btns.length; k++) {
            //     if(btns[k].child instanceof PanelMenu.Button || btns[k].child instanceof PanelMenu.ButtonBox) {
            //         // ['one-child', 'left-child', 'right-child', 'mid-child'].forEach(cls => {
            //             // btns[k].child.remove_style_pseudo_class(cls);
            //         // });
            //         btns[k].child.style = ``;
            //         if(bartype == 'Trilands') {
            //             let borderRadius = this._settings.get_double('bradius');
            //             if(k == firstIdx && k == lastIdx)
            //                 btns[k].child.style = ` border-radius: ${borderRadius}px ${borderRadius}px ${borderRadius}px ${borderRadius}px !important; `;
            //                 // btns[k].child.add_style_pseudo_class('one-child');
            //             else if(k == firstIdx)
            //                 btns[k].child.style = ` border-radius: ${borderRadius}px 0px 0px ${borderRadius}px !important; `;
            //                 // btns[k].child.add_style_pseudo_class('left-child');
            //             else if(k == lastIdx)
            //                 btns[k].child.style = ` border-radius: 0px ${borderRadius}px ${borderRadius}px 0px !important; `;
            //                 // btns[k].child.add_style_pseudo_class('right-child');
            //             else
            //                 btns[k].child.style = ` border-radius: 0px !important; `;
            //                 // btns[k].child.add_style_pseudo_class('mid-child');
            //         }
            //     }
            // }
        }
    }

    // Update panel style when Settings change
    updatePanelStyle(obj, key, sig_param, callbk_param) {
        // console.log('update called with ', key, sig_param, callbk_param);
        let panel = Main.panel;

        if(!this._settings)
            return;

        // Nothing to update if it's a color palette setting
        if(key.startsWith('palette') || key.startsWith('prominent') ||
            key.startsWith('dark-') || key.startsWith('light-'))
            return;

        // Generate background color palette
        if(key == 'bgpalette' || key == 'bguri') {
            const importExport = this._settings.get_boolean('import-export');
            if(!importExport) {
                if(key == 'bgpalette')
                    this.updateBguri(this, 'updatePanelStyle');
                else
                    this.backgroundPalette();
            }
            return;
        }

        // Window-Max bar settings
        if(key == 'wmaxbar') {
            this.onWindowMaxBar();
            return;
        }
        if(key == 'cust-margin-wmax' || key == 'margin-wmax') {
            this.setPanelBoxPosWindowMax(this.wmax, key);
            return;
        }
        if(key == 'buttonbg-wmax' && panel.has_style_pseudo_class('windowmax')) {
            const btnBgWMax = this._settings.get_boolean('buttonbg-wmax');
            const candybar = this._settings.get_boolean('candybar');
            if(candybar)
                btnBgWMax?
                panel.add_style_class_name('candybar'):
                panel.remove_style_class_name('candybar');
            return;
        }

        // Generate and save autothemes for Dark and Light modes
        if(key == 'trigger-autotheme') {
            AutoThemes.autoApplyBGPalette(this, 'dark');
            AutoThemes.autoApplyBGPalette(this, 'light');
            return;
        }

        // Update styles on Dark/Light mode change
        if(callbk_param == 'color-scheme') {
            this.onModeChange();
            return;
        }

        // Continue to update triland classes if actor (panel button) removed in trilands mode else return
        let bartype = this._settings.get_string('bartype');
        if(key == this.removedSignal && bartype != 'Trilands')
            return;

        // Generate/Reload stylesheet
        if(key == 'trigger-reload') { // A toggle key to trigger generation and reload of stylesheet
            StyleSheets.reloadStyle(this, this);
            return;
        }
        if(callbk_param == 'high-contrast') { // Reload stylesheet to pick up high contrast icons
            StyleSheets.reloadStyle(this, this);
            return;
        }
        if(key == 'reloadstyle') { // A toggle key to trigger reload of existing stylesheet
            this.reloadStylesheet();
            // continue to style
        }

        // Set bgalpha on change of bartype
        if(key == 'bartype') {
            if(bartype == 'Trilands' || bartype == 'Islands') {
                this._settings.set_double('bgalpha', 0);
            }
            else {
                this._settings.set_double('bgalpha', 0.9);
            }
        }

        // Overview style
        let setOverview = this._settings.get_boolean('set-overview');
        if(key == 'showing' || panel.has_style_pseudo_class('overview')) {
            if(setOverview) {
                if(this.isObarReset) { // Overview style is enabled but obar was reset due to Fullscreen
                    this.loadStylesheet();
                    this.isObarReset = false;
                }
            }
        }
        else if(key == 'hiding') {
            this.setWindowMaxBar('hiding');
            this.onFullScreen(null, 'hiding');
        }

        // Fullscreen style
        if(key == 'set-fullscreen') {
            const fullscreen = this._settings.get_boolean('set-fullscreen');
            if(fullscreen && this.isObarReset) {
                this.loadStylesheet();
                this.isObarReset = false;
            }
            else if(!fullscreen && !this.isObarReset) {
                this.onFullScreen(null, 'fullscreen');
            }
            return;
        }

        // GTK Apps styles
        let gtkKeys = ['apply-gtk', 'headerbar-hint', 'hbar-gtk3only', 'sidebar-hint', 'sbar-gradient', 'card-hint', 'view-hint', 'window-hint', 'winbradius', 'corner-radius',
            'winbcolor', 'winbalpha', 'winbwidth', 'traffic-light', 'menu-radius', 'gtk-transparency', 'gtk-popover', 'mscolor', 'msalpha', 'hscd-color', 'vw-color', 'gtk-shadow'];
        if(gtkKeys.includes(key)) {
            // console.log('Call saveGtkCss from extension for key: ', key);
            this.gtkCSS = true;
            // For mscolor/msalpha, stylesheet will be generated/reloaded and also saveGtkCss will be called (in styleSheets.js)
            // For other keys, call saveGtkCss from here
            if(key != 'mscolor' && key != 'msalpha') {
                StyleSheets.saveGtkCss(this, 'enable');
                const wmaxHbar = this._settings.get_boolean('wmax-hbarhint');
                // Reload styelsheet to match WMax bar with Gtk headerbar
                if((key == 'headerbar-hint' || key == 'hscd-color') && wmaxHbar)
                    StyleSheets.reloadStyle(this, this);
                return;
            }
        }
        // Flatpak overrides
        if(key == 'apply-flatpak') {
            StyleSheets.saveFlatpakOverrides(this, 'enable');
            return;
        }

        // Menu style
        let menustyle = this._settings.get_boolean('menustyle');
        if(['reloadstyle', 'removestyle', 'menustyle'].includes(key) ||
            (key == this.addedSignal && callbk_param != 'message-banner')) {
            this.applyMenuStyles(panel, menustyle);
        }
        if(key == 'menustyle') {
            StyleSheets.reloadStyle(this, this);
        }

        // Auto set closest Gnome Accent color
        if(key == 'mscolor' && this.gnomeVersion >= 47) {
            let closestAccent = AutoThemes.getClosestGnomeAccent(this);
            this._intSettings.set_string('accent-color', closestAccent);
        }
        // Auto set closest Yaru theme
        if(key == 'mscolor' || key == 'set-yarutheme') {
            let setYaruTheme = this._settings.get_boolean('set-yarutheme');
            if(key == 'set-yarutheme') {
                if(setYaruTheme) {
                    this.yaruBackup = this._intSettings.get_string('gtk-theme');
                    this.iconBackup = this._intSettings.get_string('icon-theme');
                }
                else {
                    if(this.yaruBackup)
                        this._intSettings.set_string('gtk-theme', this.yaruBackup);
                    if(this.iconBackup)
                        this._intSettings.set_string('icon-theme', this.iconBackup);
                }
            }
            if(setYaruTheme) {
                let colorScheme = this._intSettings.get_string('color-scheme');
                let modeSuffix = colorScheme == 'prefer-dark' ? '-dark' : '';
                let yaruColor = AutoThemes.getClosestYaruTheme(this);
                yaruColor = (yaruColor == 'default') ? '' : '-'+yaruColor;
                let yaruTheme = 'Yaru' + yaruColor + modeSuffix;
                this._intSettings.set_string('gtk-theme', yaruTheme);
                this._intSettings.set_string('icon-theme', yaruTheme);
            }
        }

        // Set SVG icons update flags
        if(key == 'mscolor') {
            this.msSVG = true;
            this.smfgSVG = true;
        }
        else if(key == 'mfgcolor' || key == 'mbgcolor' || key == 'smbgcolor' || key == 'smbgoverride') {
            this.smfgSVG = true;
        }
        else if(key == 'mhcolor') {
            this.mhSVG = true;
        }

        // Manual override disables Auto theme font
        if(key == 'font') {
            this._settings.set_boolean('autotheme-font', false);
        }

        // Enable/Disable Fitts Widgets
        if(key == 'fitts-widgets') {
            const fittsWidgets = this._settings.get_boolean('fitts-widgets');
            if(fittsWidgets)
                this.enableFittsWidgets();
            else
                this.disableFittsWidgets();
        }

        let menuKeys = ['trigger-reload', 'reloadstyle', 'removestyle', 'menustyle', 'mfgcolor', 'mfgalpha', 'mbgcolor', 'mbgaplha', 'mbcolor', 'mbaplha',
        'mhcolor', 'mhalpha', 'mscolor', 'msalpha', 'mshcolor', 'mshalpha', 'smbgoverride', 'smbgcolor', 'qtoggle-radius', 'slider-height', 'mbg-gradient'];
        let barKeys = ['bgcolor', 'gradient', 'gradient-direction', 'bgcolor2', 'bgalpha', 'bgalpha2', 'fgcolor', 'fgalpha', 'bcolor', 'balpha', 'bradius',
        'bordertype', 'shcolor', 'shalpha', 'iscolor', 'isalpha', 'neon', 'shadow', 'font', 'default-font', 'hcolor', 'halpha', 'heffect', 'bgcolor-wmax',
        'bgalpha-wmax', 'neon-wmax', 'boxcolor', 'boxalpha', 'autofg-bar', 'autofg-menu', 'width-top', 'width-bottom', 'width-left', 'width-right',
        'radius-topleft', 'radius-topright', 'radius-bottomleft', 'radius-bottomright'];
        let keys = [...barKeys, ...menuKeys, 'autotheme-dark', 'autotheme-light', 'autotheme-refresh', 'accent-override', 'accent-color', 'apply-menu-shell',
        'dashdock-style', 'dbgcolor', 'dbgalpha', 'dborder', 'dshadow'];
        if(keys.includes(key)) {
            return;
        }

        // Set PanelBox position
        let position = this._settings.get_string('position');
        let borderWidth = this._settings.get_double('bwidth');
        let height = this._settings.get_double('height');
        let margin = this._settings.get_double('margin');
        let setBottomMargin = this._settings.get_boolean('set-bottom-margin');
        let bottomMargin = this._settings.get_double('bottom-margin');
        if(position == 'Bottom' || key == 'position' || key == 'monitors-changed') {
            // If WMax is On then ignore 'margin' changes (do not set position) else set position
            if(!(this.wmax && (key == 'margin' || key == 'bottom-margin')))
                this.setPanelBoxPosition(position, height, margin, setBottomMargin, bottomMargin, borderWidth, bartype);
        }
        // Reset Fitts Widgets
        const fittsWidgets = this._settings.get_boolean('fitts-widgets');
        if(key == 'position' && fittsWidgets) {
            this.disableFittsWidgets();
            this.enableFittsWidgets();
        }

        // Update background-manager if monitors changed
        if(key == 'monitors-changed')
            this.connectPrimaryBGChanged();

        // Notifications position
        let setNotifications = this._settings.get_boolean('set-notifications');
        let setNotifPos = this._settings.get_boolean('set-notif-position');
        let notifKeys = ['set-notif-position', 'position', 'monitors-changed', 'updated', 'enabled'];
        if(notifKeys.includes(key) && setNotifPos) {
            if(position == 'Bottom')
                Main.messageTray._bannerBin.y_align = Clutter.ActorAlign.END;
            else
                Main.messageTray._bannerBin.y_align = Clutter.ActorAlign.START;
        }
        // Notifications style
        if(key == this.addedSignal && callbk_param == 'message-banner' && setNotifications) {
            Main.messageTray._banner?.add_style_class_name('openmenu');
        }

        this.setPanelStyle(null, key);
    }

    // QSAP: listen for addition of new panels
    // this allows theming QSAP panels when QSAP is enabled after Open Bar
    setupLibpanel(obj, signal, sig_param, menu) {
        if(menu.constructor.name != 'PanelGrid')
            return;

        for(const panelColumn of menu.box.get_children()) {
            this._connections.connect(panelColumn, this.addedSignal, this.updatePanelStyle.bind(this));
        }
        this._connections.connect(menu.box, this.addedSignal, (obj, signal, panelColumn, callbk_param) => {
            this._connections.connect(panelColumn, this.addedSignal, this.updatePanelStyle.bind(this));
        });
    }

    // Find the monitor which has the panel/panelBox
    getPanelMonitor() {
        let panelMonIndex = 0;
        const LM = Main.layoutManager;
        const monitors = LM.monitors;
        const panelBox = LM.panelBox;
        for(let i=0; i<monitors.length; i++) {
            let monitor = monitors[i];
            if(panelBox.x >= monitor.x && panelBox.x < (monitor.x + monitor.width) &&
                panelBox.y >= monitor.y && panelBox.y < (monitor.y + monitor.height)) {
                panelMonIndex = i;
                break;
            }
        }
        return [monitors[panelMonIndex], panelMonIndex];
    }

    setPanelBoxPosition(position, height, margin, setBottomMargin, bottomMargin, borderWidth, bartype) {
        let panelMonitor = this.getPanelMonitor()[0];
        let panelBox = Main.layoutManager.panelBox;
        if(position == 'Top') {
            let topX = panelMonitor.x;
            let topY = panelMonitor.y;
            panelBox.set_position(topX, topY);
            panelBox.set_size(panelMonitor.width, -1);
        }
        else if(position == 'Bottom') {
            margin = (bartype == 'Mainland')? 0: margin;
            borderWidth = (bartype == 'Trilands' || bartype == 'Islands')? 0: borderWidth;
            let windowGap = setBottomMargin? bottomMargin: margin;
            let panelBoxHeight = height + 2*borderWidth + margin + windowGap;
            // Scale height by Display Scaling factor
            panelBoxHeight = this.themeContext.scale_factor * panelBoxHeight;
            let bottomX = panelMonitor.x;
            let bottomY = panelMonitor.y + panelMonitor.height - panelBoxHeight;
            panelBox.set_position(bottomX, bottomY);
            panelBox.set_size(panelMonitor.width, panelBoxHeight);
        }
    }

    // Set panelbox position for window max
    // Need to set panelBox position since bar margins/height can change with WMax
    setPanelBoxPosWindowMax(wmax, signal) {
        const position = this._settings.get_string('position');
        if(position == 'Bottom') {
            if(this.position == position && this.wmax == wmax && !(signal == 'cust-margin-wmax' || signal == 'margin-wmax'))
                return;
            const bartype = this._settings.get_string('bartype');
            const borderWidth = this._settings.get_double('bwidth');
            const custMarginWmax = this._settings.get_boolean('cust-margin-wmax');
            const marginWMax = this._settings.get_double('margin-wmax');
            let margin = this._settings.get_double('margin');
            let bottomMargin = this._settings.get_double('bottom-margin');
            const height = this._settings.get_double('height');
            if(wmax) {
                margin = custMarginWmax? marginWMax: margin;
            }
            this.setPanelBoxPosition(position, height, margin, false, bottomMargin, borderWidth, bartype);
            this.wmax = wmax;
            this.position = position;
        }
        else if(position == 'Top') {
            if(this.position == position)
                return;
            this.setPanelBoxPosition(position);
            this.position = position;
        }
    }

    // Check for maximized window on Panel monitor
    setWindowMaxBar(obj, signal, sig2) {
        // Retain wmax status as-is in Overview (do nothing here)
        if(!this._settings || Main.panel.has_style_pseudo_class('overview'))
            return;

        const wmaxbar = this._settings.get_boolean('wmaxbar');
        if(!wmaxbar) {
            if(Main.panel.has_style_pseudo_class('windowmax')) {
                Main.panel.remove_style_pseudo_class('windowmax');
                this.setPanelBoxPosWindowMax(false, signal);
            }
            return;
        }

        // Find out index of the monitor which has the panel/panelBox
        let panelMonIndex = this.getPanelMonitor()[1];

        // Get valid windows maximized on the monitor with panel
        const workspace = global.workspace_manager.get_active_workspace();
        const windows = workspace.list_windows().filter(window =>
            window.get_monitor() == panelMonIndex &&
            window.showing_on_its_workspace() &&
            !window.is_hidden() &&
            window.get_window_type() !== Meta.WindowType.DESKTOP && // exclude Desktop
            window.get_gtk_application_id() !== "com.rastersoft.ding" && // exclude Desktop Icons NG
            (window.maximized_horizontally || window.maximized_vertically) &&
            !window.fullscreen
        );
        // for(const window of windows)
        //     console.log('window:', window.get_gtk_application_id());

        const btnBgWMax = this._settings.get_boolean('buttonbg-wmax');
        const candybar = this._settings.get_boolean('candybar');
        if(windows.length) {
            Main.panel.add_style_pseudo_class('windowmax');
            if(candybar && !btnBgWMax) // Disable candybar button-colors when in WMax
                Main.panel.remove_style_class_name('candybar');
            this.setPanelBoxPosWindowMax(true, signal);
        }
        else {
            Main.panel.remove_style_pseudo_class('windowmax');
            if(candybar && !btnBgWMax) // Enable candybar button-colors when not in WMax
                Main.panel.add_style_class_name('candybar');
            this.setPanelBoxPosWindowMax(false, signal);
        }
    }

    onWindowAdded(obj, signal, windowActor){
        if(windowActor) {
            this._windowSignals.set(windowActor, [
                windowActor.connect('notify::visible', () => this.setWindowMaxBar('notify-visible') ),
            ]);

            if(windowActor.meta_window) {
                this._windowSignals.set(windowActor.meta_window, [
                    windowActor.meta_window.connect('notify::minimized', () => this.setWindowMaxBar('minimized') ),
                    windowActor.meta_window.connect('size-changed', () => this.setWindowMaxBar('size-changed') ),
                    windowActor.meta_window.connect('shown', () => this.setWindowMaxBar('shown') ),
                ]);
            }
        }
        this.setWindowMaxBar(this.addedSignal);
    }

    onWindowRemoved(obj, signal, windowActor){
        let winSigActors = [windowActor, windowActor.meta_window];
        for(const winSigActor of winSigActors) {
            if(winSigActor) {
                let windowSignals = this._windowSignals.get(winSigActor);
                if(windowSignals) {
                    for (const id of windowSignals){
                            winSigActor.disconnect(id);
                    }
                    this._windowSignals.delete(winSigActor);
                }
            }
        }
        this.setWindowMaxBar(this.removedSignal);
    }

    // Connect/disconnect window signals based on Window-Max bar On/Off
    onWindowMaxBar() {
        let wmaxbar = this._settings.get_boolean('wmaxbar');
        if(wmaxbar) {
            this._windowSignals = new Map();
            const windowActors = this.gnomeVersion < 48? global.get_window_actors() : global.compositor.get_window_actors();
            for(const window of windowActors){
                this.onWindowAdded(null, 'enabled', window);
            }
            this._connections.connect(global.window_group, this.addedSignal, this.onWindowAdded.bind(this));
            this._connections.connect(global.window_group, this.removedSignal, this.onWindowRemoved.bind(this));
        }
        else {
            this._connections.disconnect(global.window_group, this.addedSignal);
            this._connections.disconnect(global.window_group, this.removedSignal);
            this.disconnectWindowSignals();
            Main.panel.remove_style_pseudo_class('windowmax');
            this.setPanelBoxPosWindowMax(false);
        }
    }

    disconnectWindowSignals() {
        if(this._windowSignals) {
            for(const [windowActor, ids] of this._windowSignals) {
                for(const id of ids) {
                    // console.log('disconnectWindowSignals - id: ', id);
                    if(windowActor && id > 0)
                        windowActor.disconnect(id);
                }
            }
        }
        this._windowSignals = null;
    }

    onFullScreen(obj, signal, sig_param, timeout = 0) {
        if(this._settings.get_boolean('set-fullscreen'))
            return;

        // Timeout to allow other extensions to move panel to another monitor
        this.onFullScrTimeoutId =
            setTimeout(() => {
                // Check if panelBox is on the monitor which is in fullscreen
                const LM = Main.layoutManager;
                let panelBoxMonitor = this.getPanelMonitor()[0];
                let panelFullMonFound = false;
                for(const monitor of LM.monitors) {
                    if(monitor.inFullscreen && monitor == panelBoxMonitor) {
                        this.unloadStylesheet();
                        this.isObarReset = true;
                        panelFullMonFound = true;
                        break;
                    }
                }
                if(!panelFullMonFound && this.isObarReset) {
                    this.loadStylesheet();
                    this.isObarReset = false;
                }
                this.onFullScrTimeoutId = null;
            }, timeout);
    }

    onModeChange() {
        this.gtkCSS = true;
        StyleSheets.saveGtkCss(this, 'enable');
        AutoThemes.onModeChange(this);
    }

    updateBguri(obj, signal) {
        // console.log('update bguri called for signal ', signal);
        // If the function is triggered multiple times in succession, ignore till timeout
        if(this.updatingBguri) {
            // console.log('update bguri already in progress');
            return;
        }
        this.updatingBguri = true;
        this.updatingBguriId = setTimeout(() => {
            this.updatingBguri = false;
            this.updatingBguriId = null;
        }, 5000);
        // console.log('==== Going ahead with bguri ====');
        let colorScheme = this._intSettings.get_string('color-scheme');
        if(colorScheme != this.colorScheme) {
            this.colorScheme = colorScheme;
            return;
        }

        this.updateBguriId = setTimeout(() => {
            let bguriDark = this._bgSettings.get_string('picture-uri-dark');
            let bguriLight = this._bgSettings.get_string('picture-uri');
            this._settings.set_string('dark-bguri', bguriDark);
            this._settings.set_string('light-bguri', bguriLight);

            let bguriOld = this._settings.get_string('bguri');
            let bguriNew;
            if(colorScheme == 'prefer-dark')
                bguriNew = bguriDark;
            else
                bguriNew = bguriLight;
            this._settings.set_string('bguri', bguriNew);

            // Gnome45+: if bgnd changed with right click on image file,
            // filepath (bguri) remains same, so manually call updatePanelStyle
            if(bguriOld == bguriNew) {
                // console.log('bguriOld == bguriNew - calling updatePanelStyle for bguri');
                this.updatePanelStyle(this._settings, 'bguri');
            }
            this.updateBguriId = null;
        }, 200);
    }

    // Connect multiple signals to ensure detecting background-change in all Gnome versions
    connectPrimaryBGChanged() {
        const pMonitorIdx = Main.layoutManager.primaryIndex;
        this._connections.connect(Main.layoutManager._bgManagers[pMonitorIdx], 'changed', this.updateBguri.bind(this));
        this._connections.connect(this._bgSettings, 'changed::picture-uri', this.updateBguri.bind(this));
        this._connections.connect(this._bgSettings, 'changed::picture-uri-dark', this.updateBguri.bind(this));
        this._connections.connect(this._intSettings, 'changed::color-scheme', this.updatePanelStyle.bind(this), 'color-scheme');
    }

    createFittsWidget(box, btn) {
        let panel = Main.panel;
        let panelBox = Main.layoutManager.panelBox;
        let position = this._settings.get_string('position');

        if( !btn.FittsWidget &&
            (btn.child instanceof PanelMenu.Button || btn.child instanceof PanelMenu.ButtonBox) &&
            btn.child.visible ) {

            btn.FittsWidget = new St.Widget({
                x: panelBox.x + panel.x + box.x + btn.x,
                width: btn.width,
                y: panelBox.y,
                height: panel.y + btn.child.y,
                reactive: true,
                track_hover: true,
                visible: true,
                // style: 'background-color: rgba(200, 200, 0, 0.35);'
            });
            if(position == 'Bottom')
                btn.FittsWidget.y = panelBox.y + panelBox.height - btn.FittsWidget.height;

            // Connect to btn destroy signal to also destroy its FittsWidget
            btn.destroyFittsId = btn.connect('destroy', () => {this.destroyFittsWidget(btn);});

            // Bind x of FittsWidget to params it depends on: panelBox.x + panel.x + box.x + btn.x
            btn.bind_property_full('x', btn.FittsWidget, 'x', GObject.BindingFlags.SYNC_CREATE,
                (bind, value) => [true, panelBox.x + panel.x + box.x + value], null);
            box.bind_property_full('x', btn.FittsWidget, 'x', GObject.BindingFlags.SYNC_CREATE,
                (bind, value) => [true, panelBox.x + panel.x + value + btn.x], null);
            panel.bind_property_full('x', btn.FittsWidget, 'x', GObject.BindingFlags.SYNC_CREATE,
                (bind, value) => [true, panelBox.x + value + box.x + btn.x], null);
            panelBox.bind_property_full('x', btn.FittsWidget, 'x', GObject.BindingFlags.SYNC_CREATE,
                (bind, value) => [true, value + panel.x + box.x + btn.x], null);

            // Bind width of FittsWidget to params it depends on: btn.width
            btn.bind_property('width', btn.FittsWidget, 'width', GObject.BindingFlags.SYNC_CREATE);

            // Bind y of FittsWidget to params it depends on: Top Panel => panelBox.y OR
            // Bottom Panel => panelBox.y + panelBox.height - btn.FittsWidget.height
            if(position == 'Top')
                panelBox.bind_property('y', btn.FittsWidget, 'y', GObject.BindingFlags.SYNC_CREATE);
            else if(position == 'Bottom') {
                panelBox.bind_property_full('y', btn.FittsWidget, 'y', GObject.BindingFlags.SYNC_CREATE,
                    (bind, value) => [true, value + panelBox.height - btn.FittsWidget.height], null);
                panelBox.bind_property_full('height', btn.FittsWidget, 'y', GObject.BindingFlags.SYNC_CREATE,
                    (bind, value) => [true, panelBox.y + value - btn.FittsWidget.height], null);
                btn.FittsWidget.bind_property_full('height', btn.FittsWidget, 'y', GObject.BindingFlags.SYNC_CREATE,
                    (bind, value) => [true, panelBox.y + panelBox.height - value], null);
            }

            // Bind height of FittsWidget to params it depends on: panel.y + btn.child.y
            panel.bind_property_full('y', btn.FittsWidget, 'height', GObject.BindingFlags.SYNC_CREATE,
                (bind, value) => [true, value + btn.child.y], null);
            btn.child.bind_property_full('y', btn.FittsWidget, 'height', GObject.BindingFlags.SYNC_CREATE,
                    (bind, value) => [true, panel.y + value], null);

            // Connect signals for hover
            btn.FittsWidget.connect('enter-event', (actor, event) => {
                btn.child.add_style_pseudo_class('hover');
                return Clutter.EVENT_PROPAGATE;
            });
            btn.FittsWidget.connect('leave-event', (actor, event) => {
                btn.child.remove_style_pseudo_class('hover');
                return Clutter.EVENT_PROPAGATE;
            });

            // Connect signals for captured-event
            btn.FittsWidget.connect('captured-event', (actor, event) => {
                btn.child.event(event, false);
                return Clutter.EVENT_PROPAGATE;
            });

            Main.layoutManager.addChrome(btn.FittsWidget, {trackFullscreen: true});
        }
    }

    destroyFittsWidget(btn) {
        if(btn.FittsWidget) {
            Main.layoutManager.removeChrome(btn.FittsWidget);
            btn.FittsWidget.destroy();
            delete btn.FittsWidget;
        }
    }

    createFittsCornerWidgets() {
        let panel = Main.panel;
        let panelBox = Main.layoutManager.panelBox;

        for(const idx of [0, 1]) {
            if((idx == 0 && !panel.leftFittsWidget) || (idx == 1 && !panel.rightFittsWidget)) {
                let widget = new St.Widget({
                    x: (idx == 0) ? panelBox.x : panelBox.x + panelBox.width - panel.x - panel._leftBox.x - 2, // 2 for border width
                    width: panel.x + panel._leftBox.x + 2,
                    y: panelBox.y,
                    height: panelBox.height,
                    reactive: true,
                    track_hover: true,
                    visible: true,
                    // style: 'background-color: rgba(200, 100, 0, 0.35);'
                });

                if(idx == 0) { // Bind x of leftFittsWidget to params it depends on: panelBox.x
                    panelBox.bind_property('x', widget, 'x', GObject.BindingFlags.SYNC_CREATE);
                }
                else { // Bind x of rightFittsWidget to params it depends on: panelBox.x + panelBox.width - panel.x - panel._leftBox.x - 2
                    panelBox.bind_property_full('x', widget, 'x', GObject.BindingFlags.SYNC_CREATE,
                        (bind, value) => [true, value + panelBox.width - panel.x - panel._leftBox.x - 2], null);
                    panelBox.bind_property_full('width', widget, 'x', GObject.BindingFlags.SYNC_CREATE,
                        (bind, value) => [true, panelBox.x + value - panel.x - panel._leftBox.x - 2], null);
                    panel.bind_property_full('x', widget, 'x', GObject.BindingFlags.SYNC_CREATE,
                        (bind, value) => [true, panelBox.x + panelBox.width - value - panel._leftBox.x - 2], null);
                    panel._leftBox.bind_property_full('x', widget, 'x', GObject.BindingFlags.SYNC_CREATE,
                        (bind, value) => [true, panelBox.x + panelBox.width - panel.x - value - 2], null);
                }
                // Bind width of FittsWidget to params it depends on: panel.x + panel._leftBox.x + 2
                panel.bind_property_full('x', widget, 'width', GObject.BindingFlags.SYNC_CREATE,
                    (bind, value) => [true, value + panel._leftBox.x + 2], null);
                panel._leftBox.bind_property_full('x', widget, 'width', GObject.BindingFlags.SYNC_CREATE,
                    (bind, value) => [true, panel.x + value + 2], null);
                // Bind y of FittsWidget to params it depends on: panelBox.y
                panelBox.bind_property('y', widget, 'y', GObject.BindingFlags.SYNC_CREATE);
                // Bind height of FittsWidget to params it depends on: panelBox.height
                panelBox.bind_property('height', widget, 'height', GObject.BindingFlags.SYNC_CREATE);

                // Get leftmost or rightmost visible button in the panel
                let btn, box;
                box = (idx == 0) ? this.panelBoxes[0] : this.panelBoxes[2];
                for(const boxBtn of box) {
                    if((boxBtn.child instanceof PanelMenu.Button ||
                        boxBtn.child instanceof PanelMenu.ButtonBox) &&
                        boxBtn.child.visible)
                        btn = boxBtn;
                        if(idx == 0)
                            break;
                }

                // Connect signals for hover
                widget.connect('enter-event', (actor, event) => {
                    btn.child.add_style_pseudo_class('hover');
                    return Clutter.EVENT_PROPAGATE;
                });
                widget.connect('leave-event', (actor, event) => {
                    btn.child.remove_style_pseudo_class('hover');
                    return Clutter.EVENT_PROPAGATE;
                });
                // Connect signals for captured-event
                widget.connect('captured-event', (actor, event) => {
                    btn.child.event(event, false);
                    return Clutter.EVENT_PROPAGATE;
                });

                if(idx == 0) {
                    panel.leftCornerButton = btn;
                    panel.leftFittsWidget = widget;
                }
                else {
                    panel.rightCornerButton = btn;
                    panel.rightFittsWidget = widget;
                }
                Main.layoutManager.addChrome(widget, {trackFullscreen: true});
            }
        }
    }

    destroyFittsCornerWidgets() {
        let panel = Main.panel;
        if(panel.leftFittsWidget) {
            // console.log('Destroy Left Corner', String(panel.leftFittsWidget));
            Main.layoutManager.removeChrome(panel.leftFittsWidget);
            panel.leftFittsWidget.destroy();
            panel.leftFittsWidget = null;
            delete panel.leftFittsWidget;
            panel.leftCornerButton = null;
            delete panel.leftCornerButton;
        }
        if(panel.rightFittsWidget) {
            // console.log('Destroy Right Corner', String(panel.rightFittsWidget));
            Main.layoutManager.removeChrome(panel.rightFittsWidget);
            panel.rightFittsWidget.destroy();
            panel.rightFittsWidget = null;
            delete panel.rightFittsWidget;
            panel.rightCornerButton = null;
            delete panel.rightCornerButton;
        }
    }

    // Add / Remove Fitts Button Widgets and Corner Widgets
    addRemoveFittsWidgets(add) {
        for(const box of this.panelBoxes) {
            for(const btn of box) {
                if(add)
                    this.createFittsWidget(box, btn);
                else {
                    this.destroyFittsWidget(btn);
                    if(btn.destroyFittsId > 0)
                        btn.disconnect(btn.destroyFittsId);
                    delete btn.destroyFittsId;
                }
            }
        }

        if(add) {
            this.createFittsCornerWidgets();
        }
        else
            this.destroyFittsCornerWidgets();
    }

    updateFittsWidgetVisible(btn, child) {
        if(btn.child.visible)
            this.createFittsWidget(btn.get_parent(), btn);
        else
            this.destroyFittsWidget(btn);
    }

    connectFittsWidgetVisible(connect) {
        for(const box of this.panelBoxes) {
            for(const btn of box) {
                if(btn.child instanceof PanelMenu.Button || btn.child instanceof PanelMenu.ButtonBox) {
                    if(connect)
                        this._connections.connect(btn.child, 'notify::visible', this.updateFittsWidgetVisible.bind(this, btn));
                    else
                        this._connections.disconnect(btn.child, 'notify::visible');
                }
            }
        }
    }

    updateFittsWidgetAddRemove(box, key, btn) {
        if(this.fittsCornerTimeoutId) {
            clearTimeout(this.fittsCornerTimeoutId);
            this.fittsCornerTimeoutId = null;
        }
        if(this.disabling) {
            return;
        }

        let panel = Main.panel;
        if( (key == this.addedSignal &&
            (btn == this.panelBoxes[0].get_first_child() || btn == this.panelBoxes[2].get_last_child())) ||
            (key == this.removedSignal &&
            (btn == panel.leftCornerButton || btn == panel.rightCornerButton)) ) {
            this.destroyFittsCornerWidgets();
            // Wait for Panel to update its x, width then create CornerWidgets
            this.fittsCornerTimeoutId = setTimeout(() => {
                this.createFittsCornerWidgets();
                this.fittsCornerTimeoutId = null;
            }, 500);
        }

        if(!(btn.child instanceof PanelMenu.Button || btn.child instanceof PanelMenu.ButtonBox))
            return;

        if(key == this.addedSignal) {
            this._connections.connect(btn.child, 'notify::visible', this.updateFittsWidgetVisible.bind(this, btn));
            if(btn.child.visible)
                this.createFittsWidget(box, btn);
        }
        else if(key == this.removedSignal)
            this.destroyFittsWidget(btn);
    }

    connectFittsWidgetAddRemove(connect) {
        for(const box of this.panelBoxes) {
            if(connect) {
                this._connections.connect(box, this.addedSignal, this.updateFittsWidgetAddRemove.bind(this));
                this._connections.connect(box, this.removedSignal, this.updateFittsWidgetAddRemove.bind(this));
            }
            else {
                this._connections.disconnect(box, this.addedSignal);
                this._connections.disconnect(box, this.removedSignal);
            }
        }
    }

    enableFittsWidgets() {
        this.addRemoveFittsWidgets(true);
        this.connectFittsWidgetVisible(true);
        this.connectFittsWidgetAddRemove(true);
    }

    disableFittsWidgets() {
        this.connectFittsWidgetAddRemove(false);
        this.connectFittsWidgetVisible(false);
        this.addRemoveFittsWidgets(false);
    }

    postStartup() {
        this.postStartupId = setTimeout(() => {
            this.setPanelStyle(null, 'post-startup');
            this.postStartupId = null;
        }, 2000);
    }

    enable() {
        // Get Gnome version
        const [major, minor] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));
        this.gnomeVersion = major;

        // Get the top panel
        let panel = Main.panel;
        this.panelBoxes = [panel._leftBox, panel._centerBox, panel._rightBox];

        this.main = Main;
        this.msSVG = true;
        this.mhSVG = true;
        this.smfgSVG = true;
        this.gtkCSS = true;
        this.position = null;
        this.wmax = null;
        this.isObarReset = false;
        this.addedSignal = this.gnomeVersion > 45? 'child-added': 'actor-added';
        this.removedSignal = this.gnomeVersion > 45? 'child-removed': 'actor-removed';
        this.calendarTimeoutId = null;
        this.bgMgrTimeOutId = null;
        this.onFullScrTimeoutId = null;
        this.msgLists = [];
        this.msgListIds = [];
        this.styleUnloaded = false;
        this.updatingBguri = false;
        this.updatingBguriId = null;
        this.updateBguriId = null;
        this.postStartupId = null;
        this.disabling = false;

        // Settings for desktop background image (set bg-uri as per color scheme)
        this._bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
        this._intSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        this._hcSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.interface' });
        this.colorScheme = this._intSettings.get_string('color-scheme');

        // Get global theme context (for display scaling)
        this.themeContext = St.ThemeContext.get_for_stage(global.stage);

        this._settings = this.getSettings();
        // this.bgalpha = this._settings.get_double('bgalpha');
        this._settings.set_boolean('import-export', false);
        this._settings.set_boolean('pause-reload', false);

        let panelMonitor = this.getPanelMonitor()[0];
        this._settings.set_int('monitor-height', panelMonitor.height);
        this._settings.set_int('monitor-width', panelMonitor.width);

        // Connect to the settings changes
        this._settings.connect('changed', (settings, key) => {
            this.updatePanelStyle(settings, key);
        });

        let connections = [
            [ Main.overview, 'hiding', this.updatePanelStyle.bind(this) ],
            [ Main.overview, 'showing', this.updatePanelStyle.bind(this) ],
            [ Main.layoutManager, 'monitors-changed', this.updatePanelStyle.bind(this) ],
            [ Main.messageTray._bannerBin, this.addedSignal, this.updatePanelStyle.bind(this), 'message-banner' ],
            [ global.display, 'in-fullscreen-changed', this.onFullScreen.bind(this), 100 ],
            [ global.display, 'window-entered-monitor', this.setWindowMaxBar.bind(this), 'window-entered-monitor' ],
            [ global.display, 'window-left-monitor', this.setWindowMaxBar.bind(this), 'window-left-monitor' ],
            [ Main.layoutManager, 'startup-complete', this.postStartup.bind(this) ],
            // [ Main.sessionMode, 'updated', this.updatePanelStyle.bind(this), 'session-mode-updated' ],
        ];
        // Connections for actor-added/removed OR child-added/removed as per Gnome version
        for(const panelBox of this.panelBoxes) {
            connections.push([panelBox, this.addedSignal, this.updatePanelStyle.bind(this)]);
            connections.push([panelBox, this.removedSignal, this.updatePanelStyle.bind(this)]);
        }
        // Connections for panel buttons notify::visible
        for(const box of this.panelBoxes) {
            for(const btn of box) {
                if(btn.child instanceof PanelMenu.Button || btn.child instanceof PanelMenu.ButtonBox) {
                    if(btn.child.constructor.name === 'ATIndicator' || btn.child.constructor.name === 'InputSourceIndicator'
                        || btn.child.constructor.name === 'DwellClickIndicator') {
                        connections.push([btn.child, 'notify::visible', this.setPanelStyle.bind(this)]);
                    }
                }
            }
        }
        // Connection for Toggle Switch status shapes in High Contrast
        if(this.gnomeVersion <= 45) {
            connections.push( [ this._hcSettings, 'changed::high-contrast', this.updatePanelStyle.bind(this), 'high-contrast' ] );
        }
        // Connection specific to QSAP extension (Quick Settings)
        if(this.gnomeVersion > 42) {
            let qSettings = Main.panel.statusArea.quickSettings;
            connections.push( [qSettings, 'menu-set', this.setupLibpanel.bind(this), qSettings.menu] );
        }
        // Connection specific to Workspace indicator dots
        if(this.gnomeVersion > 44) {
            connections.push([global.workspace_manager, 'notify::n-workspaces', this.updatePanelStyle.bind(this)]);
        }

        // Setup all connections
        this._connections = new ConnectManager(connections);

        // Setup connections for addition of new QSAP extension panels
        if(this.gnomeVersion > 42)
            this.setupLibpanel(null, 'enabled', null, Main.panel.statusArea.quickSettings.menu);

        // Connect to background manager (give time for it to be available)
        this.bgMgrTimeOutId = setTimeout(() => {
            this.connectPrimaryBGChanged();
            this.bgMgrTimeOutId = null;
        }, 2000);
        // Set initial bguri as per color-scheme
        const bguri = this._settings.get_string('bguri');
        if(bguri == '')
            this.updateBguri();
        else {
            // If mode was changed (by script/extension) while OpenBar was disabled (screen-lock),
            // detect mode-change and update styles
            let obarScheme = this._settings.get_string('color-scheme');
            if(obarScheme != this.colorScheme)
                this.onModeChange();
        }

        // Update calendar style on Calendar rebuild through fn injection
        const obar = this;
        this._injections["_rebuildCalendar"] = this._injectToFunction(
            Main.panel.statusArea.dateMenu._calendar,
            "_rebuildCalendar",
            function () {
                if(!obar._settings) {
                    return;
                }
                let menustyle = obar._settings.get_boolean('menustyle');
                if(menustyle) {
                    obar.applyCalendarGridStyle(this, menustyle);
                }
            }
        );

        // OpenBar runtime directory
        const userRunDir = GLib.get_user_runtime_dir();
        this.obarRunDir = Gio.File.new_for_path(`${userRunDir}/io.github.neuromorph.openbar`);
        this.obarAssetsDir = Gio.File.new_for_path(`${this.obarRunDir.get_path()}/assets`);
        // Create dirs if missing
        if(!this.obarAssetsDir.query_exists(null)) {
            try {
                this.obarAssetsDir.make_directory_with_parents(null);
            }
            catch(e) {
                console.error('Error creating OpenBar runtime/assets directory: ' + e);
            }
        }
        // Copy static assets (SVGs) to runtime dir
        const assetsSrcDir = Gio.File.new_for_path(`${this.path}/media/assets`);
        const iter = assetsSrcDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        for(const fileInfo of iter) {
            let srcFile = Gio.File.new_for_path(`${assetsSrcDir.get_path()}/${fileInfo.get_name()}`);
            let dstFile = Gio.File.new_for_path(`${this.obarAssetsDir.get_path()}/${fileInfo.get_name()}`);
            srcFile.copy_async(dstFile, Gio.FileCopyFlags.OVERWRITE | Gio.FileCopyFlags.TARGET_DEFAULT_PERMS, GLib.PRIORITY_DEFAULT, null, null);
        }

        // Add 'openbar' class to top panel and panelBox
        panel.add_style_class_name('openbar');
        Main.layoutManager.panelBox.add_style_class_name('openbar');
        // Cause stylesheet to save and reload on Enable (also creates gtk css)
        StyleSheets.reloadStyle(this, this);
        // Add Open Bar Flatpak Overrides
        StyleSheets.saveFlatpakOverrides(this, 'enable');

        // Apply the initial style
        this.updatePanelStyle(null, 'enabled');
        let menustyle = this._settings.get_boolean('menustyle');
        this.applyMenuStyles(panel, menustyle);
        // Refresh to fix any indicators added during initial styling
        this.enableStyleTimeoutId = setTimeout(() => {
            this.updatePanelStyle(null, 'enabled');
            this.applyMenuStyles(panel, menustyle);
            this.enableStyleTimeoutId = null;
        }, 1000);

        // Set initial Window Max Bar
        this.onWindowMaxBar();

        // Set fullscreen mode if in Fullscreen when extension is enabled
        this.onFullScreen(null, 'enabled', null, 100);

        /* Fitts Widgets:
         * Add a widget to PanelBox for each button.
         * Widget x1,x2 as per btn and y1,y2 to extend button interaction to screen-edge.
         * Track widget events and send to button.
         */
        // Do not enable if Dash-to-Panel is On
        this._shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        let enabledExtensions = this._shellSettings.get_strv('enabled-extensions');
        let dtpOn = enabledExtensions.includes('dash-to-panel@jderose9.github.com');
        // Enable button proximity to interact with panel buttons without having to point precisely at them.
        const fittsWidgets = this._settings.get_boolean('fitts-widgets');
        if(fittsWidgets && !dtpOn)
            this.fittsEnableTimeoutId = setTimeout(() => {
                this.enableFittsWidgets();
                this.fittsEnableTimeoutId = null;
            }, 5000);
    }

    disable() {
        this.disabling = true;

        // Get the top panel
        let panel = Main.panel;

        this.disableFittsWidgets();

        this._connections.disconnectAll();
        this._connections = null;

        this.disconnectWindowSignals();

        if(this.calendarTimeoutId > 0) {
            clearTimeout(this.calendarTimeoutId);
            this.calendarTimeoutId = null;
        }
        if(this.updatingBguriId > 0) {
            clearTimeout(this.updatingBguriId);
            this.updatingBguriId = null;
        }
        if(this.updateBguriId > 0) {
            clearTimeout(this.updateBguriId);
            this.updateBguriId = null;
        }
        if(this.bgMgrTimeOutId > 0) {
            clearTimeout(this.bgMgrTimeOutId);
            this.bgMgrTimeOutId = null;
        }
        if(this.onFullScrTimeoutId > 0) {
            clearTimeout(this.onFullScrTimeoutId);
            this.onFullScrTimeoutId = null;
        }
        if(this.postStartupId > 0) {
            clearTimeout(this.postStartupId);
            this.postStartupId = null;
        }
        if(this.enableStyleTimeoutId > 0) {
            clearTimeout(this.enableStyleTimeoutId);
            this.enableStyleTimeoutId = null;
        }
        if(this.fittsEnableTimeoutId > 0) {
            clearTimeout(this.fittsEnableTimeoutId);
            this.fittsEnableTimeoutId = null;
        }
        if(this.fittsCornerTimeoutId > 0) {
            clearTimeout(this.fittsCornerTimeoutId);
            this.fittsCornerTimeoutId = null;
        }

        for(let i=0; i<this.msgLists.length; i++) {
            if(this.msgListIds[i]) {
                // console.log('Disable - msgListIds: ', this.msgListIds[i]);
                if(this.msgLists[i] && this.msgListIds[i] > 0)
                    this.msgLists[i].disconnect(this.msgListIds[i]);
                this.msgListIds[i] = null;
                this.msgLists[i] = null;
            }
        }
        this.msgLists = [];
        this.msgListIds = [];

        this._removeInjection(Calendar.Calendar.prototype, this._injections, "_rebuildCalendar");
        this._injections = [];

        // Remove style class from Panel and PanelBox
        Main.layoutManager.panelBox.remove_style_class_name('openbar');
        panel.remove_style_class_name('openbar');
        panel.remove_style_class_name('candybar');
        panel.remove_style_class_name('trilands');
        // Reset left padding widget into DateMenu button
        if(this.dateMenuLeftPadWidget) {
            this.dateMenuBtnBox.insert_child_at_index(this.dateMenuLeftPadWidget, 0);
            this.dateMenuLeftPadWidget = null;
        }
        // Reset the style for Menus
        this.applyMenuStyles(panel, false);

        // Unload stylesheet
        this.unloadStylesheet();

        // Reset panel and banner position to Top
        this.setPanelBoxPosition('Top');
        Main.messageTray._bannerBin.y_align = Clutter.ActorAlign.START;

        // Clear/Restore Gtk css and Flatpak override
        StyleSheets.saveGtkCss(this, 'disable');
        StyleSheets.saveFlatpakOverrides(this, 'disable');

        this.main = null;
        this._settings = null;
        this._bgSettings = null;
        this._intSettings = null;
        this._hcSettings = null;
        this._shellSettings = null;
    }
}

