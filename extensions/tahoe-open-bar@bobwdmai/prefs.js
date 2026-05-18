/* prefs.js
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

/* exported fillPreferencesWindow*/

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ExtensionPreferences, gettext as _, pgettext} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Retain compatibility with GLib < 2.80, which lacks GioUnix (from GSConnect extension)
let GioUnix;
try {
    GioUnix = (await import('gi://GioUnix?version=2.0')).default;
} catch (e) {
    GioUnix = {
        InputStream: Gio.UnixInputStream,
        OutputStream: Gio.UnixOutputStream,
    };
}

const SCHEMA_PATH = '/org/gnome/shell/extensions/openbar/';

//-----------------------------------------------

export default class OpenbarPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        let prefs = new OpenbarPrefs();
        prefs.fillOpenbarPrefs(window, this);
    }

}
//-----------------------------------------------

class OpenbarPrefs {

    // Trigger creation and application of auto-theme from background
    triggerAutoTheme() {
        // Cause autotheme to apply by toggling 'trigger-autotheme'
        let triggerAutoTheme = this._settings.get_boolean('trigger-autotheme');
        if(triggerAutoTheme)
            this._settings.set_boolean('trigger-autotheme', false);
        else
            this._settings.set_boolean('trigger-autotheme', true);
    }

    // Cause stylesheet to save and reload by toggling 'trigger-reload'
    triggerStyleReload() {
        let triggerReload = this._settings.get_boolean('trigger-reload');
        if(triggerReload)
            this._settings.set_boolean('trigger-reload', false);
        else
            this._settings.set_boolean('trigger-reload', true);
    }

    // Trigger stylesheet save and reload with timeout to cancel quick-successive triggers
    setTimeoutStyleReload() {
        if(this.timeoutId)
            clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.triggerStyleReload();
            this.timeoutId = null;
        }, 400);
    }

    createComboboxWidget(options, gsetting=null) {
        let comboBox = new Gtk.ComboBoxText({halign: Gtk.Align.END});
        options.forEach(option => {
            comboBox.append(option[0], option[1]);
        });

        if(gsetting) {
            this._settings.bind(
                gsetting,
                comboBox,
                'active-id',
                Gio.SettingsBindFlags.DEFAULT
            );
        }
        // comboBox.connect('changed', () => {this.setTimeoutStyleReload();});
        return comboBox;
    }

    hexToRGBA(hex) {
        let bigint = parseInt(hex, 16);
        let r = ((bigint >> 16) & 255) / 255;
        let g = ((bigint >> 8) & 255) / 255;
        let b = (bigint & 255) / 255;

        let rgba = new Gdk.RGBA({
            red: r,
            green: g,
            blue: b,
            alpha: 1.0
        });
        return rgba;
    }

    createDefaultPaletteArray() {
        const  defaultHexColors = [
            "99c1f1", "62a0ea", "3584e4", "1c71d8", "1a5fb4", /* Blue */
            "8ff0a4", "57e389", "33d17a", "2ec27e", "26a269", /* Green */
            "f9f06b", "f8e45c", "f6d32d", "f5c211", "e5a50a", /* Yellow */
            "ffbe6f", "ffa348", "ff7800", "e66100", "c64600", /* Orange */
            "f66151", "ed333b", "e01b24", "c01c28", "a51d2d", /* Red */
            "dc8add", "c061cb", "9141ac", "813d9c", "613583", /* Purple */
            "cdab8f", "b5835a", "986a44", "865e3c", "63452c", /* Brown */
            "ffffff", "f6f5f4", "deddda", "c0bfbc", "9a9996", /* Light */
            "77767b", "5e5c64", "3d3846", "241f31", "000000"  /* Dark */
        ];

        let defaultPaletteArray = [];
        for(const hex of defaultHexColors) {
            defaultPaletteArray.push(this.hexToRGBA(hex));
        }
        // Save default palette array to use when bgPalette is updated
        this.defaultPaletteArray = defaultPaletteArray;

        return defaultPaletteArray;
    }

    createBgPaletteArray() {
        let rgbaArray = [];
        for(let i=1; i<=12; i++) {
            let paletteColor = this._settings.get_strv('palette'+i);
            let rgba = new Gdk.RGBA();
            rgba.red = parseFloat(paletteColor[0])/255;
            rgba.green = parseFloat(paletteColor[1])/255;
            rgba.blue = parseFloat(paletteColor[2])/255;
            rgba.alpha = 1.0;
            rgbaArray.push(rgba);
        }
        return rgbaArray;
    }

    createColorWidget(window, title, tooltip_text="", gsetting) {
        let color = new Gtk.ColorButton({
            title: title,
            halign: Gtk.Align.END,
            tooltip_text: tooltip_text,
        });

        let colorArray = this._settings.get_strv(gsetting);
        let rgba = new Gdk.RGBA();
        rgba.red = parseFloat(colorArray[0]);
        rgba.green = parseFloat(colorArray[1]);
        rgba.blue = parseFloat(colorArray[2]);
        rgba.alpha = 1.0;
        color.set_rgba(rgba);

        color.connect('color-set', (widget) => {
            rgba = widget.get_rgba();
            this._settings.set_strv(gsetting, [
                rgba.red.toFixed(3),
                rgba.green.toFixed(3),
                rgba.blue.toFixed(3),
            ]);
            // In addition to main gsetting, also copy the color to dark/light setting
            let prefix;
            let mode = this._settings.get_string('color-scheme');
            if(mode == 'prefer-dark')
                prefix = 'dark-';
            else
                prefix = 'light-';
            // console.log('saving from key: ' + gsetting + ' to key: ' + `${prefix}${gsetting}`);
            this._settings.set_strv(`${prefix}${gsetting}`, [
                rgba.red.toFixed(3),
                rgba.green.toFixed(3),
                rgba.blue.toFixed(3),
            ]);
            this.triggerStyleReload();
        });

        // Update widget when setting is changed (from import file)
        this._settings.connect(`changed::${gsetting}`, () => {
            const colorArray = this._settings.get_strv(gsetting);
            const rgba = color.get_rgba();
            rgba.red = parseFloat(colorArray[0]);
            rgba.green = parseFloat(colorArray[1]);
            rgba.blue = parseFloat(colorArray[2]);
            rgba.alpha = 1.0;
            color.set_rgba(rgba);
        });

        // First call to add-palette removes existing default array so add it back first
        let defaultArray = this.createDefaultPaletteArray();
        let bgPaletteArray = this.createBgPaletteArray();
        color.add_palette(Gtk.Orientation.VERTICAL, 5, defaultArray);
        color.add_palette(Gtk.Orientation.HORIZONTAL, 6, bgPaletteArray);

        window.colorButtons.push(color);
        return color;
    }

    createScaleWidget(lower, upper, step_increment, digits, gsetting, tooltip_text='') {
        let scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: lower,
                upper: upper,
                step_increment: step_increment,
            }),
            digits: digits,
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            width_request: 50,
            hexpand: true,
            tooltip_text: tooltip_text,
        });
        this._settings.bind(
            gsetting,
            scale.adjustment,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        const gtkScales = ['headerbar-hint', 'sidebar-hint', 'card-hint', 'view-hint', 'window-hint', 'gtk-transparency', 'winbalpha', 'winbradius', 'winbwidth'];
        if(!gtkScales.includes(gsetting))
            scale.connect('change-value', () => {this.setTimeoutStyleReload();});
        return scale;
    }

    createSwitchWidget(gsetting, tooltip_text='') {
        let gtkswitch = new Gtk.Switch({
            halign: Gtk.Align.END,
            tooltip_text: tooltip_text,
        });
        if(this._settings.get_boolean('apply-gtk')) {
            gtkswitch.margin_top = 5;
            gtkswitch.margin_bottom = 5;
            gtkswitch.css_classes = ['openbar-switch'];
        }
        this._settings.bind(
            gsetting,
            gtkswitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        // gtkswitch.connect('state-set', () => {this.setTimeoutStyleReload();});
        return gtkswitch;
    }

    createToggleButton(label, gsetting, tooltip_text='') {
        let toggleBtn = new Gtk.ToggleButton({
            label: label,
            sensitive: true,
            tooltip_text: tooltip_text,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        this._settings.bind(
            gsetting,
            toggleBtn,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        // toggleBtn.connect('toggled', () => {this.setTimeoutStyleReload();});
        return toggleBtn;
    }

    createGridWidget() {
        let grid = new Gtk.Grid({
            margin_top: 14,
            margin_bottom: 14,
            margin_start: 14,
            margin_end: 14,
            column_spacing: 12,
            row_spacing: 12,
            orientation: Gtk.Orientation.VERTICAL,
        });
        return grid;
    }

    createSeparatorWidget() {
        let separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            margin_bottom: 10,
            margin_top: 10,
        });
        return separator;
    }

    rgbToHex(r, g, b) {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
    }

    createPalette(window, paletteBox1, paletteBox2, clipboard) {
        for(let i=1; i<=12; i++) {
            let paletteColor = this._settings.get_strv('palette'+i);
            let hexCol = this.rgbToHex(paletteColor[0],paletteColor[1],paletteColor[2]);
            let paletteLbl = new Gtk.Label({
                label: `<span bgcolor="${hexCol}" font_size="150%">       </span>`,
                sensitive: true,
                use_markup: true,
            });
            let paletteBtn = new Gtk.Button({
                child: paletteLbl,
                sensitive: true,
                tooltip_text: hexCol,
            });
            paletteBtn.connect('clicked', () => {
                let hexCol = paletteLbl.label.match(/bgcolor="(.*?)" font/i)[1];
                clipboard.set(hexCol);
            });
            i<=6? paletteBox1.append(paletteBtn): paletteBox2.append(paletteBtn);
            window.paletteButtons.push(paletteBtn);
        }
    }

    createCandyPalette(window, paletteBox1, paletteBox2) {
        for(let i=1; i<=16; i++) {
            let candyColor = this.createColorWidget(window, 'Candybar Color', '', 'candy'+i);
            if(i <= 8)
                paletteBox1.append(candyColor);
            else
                paletteBox2.append(candyColor);
        }
    }

    updatePalette(window, grey=false) {
        let i = 1;
        window.paletteButtons.forEach(btn => {
            let paletteColor = grey? ['125','125','125'] : this._settings.get_strv('palette'+i);
            let hexCol = this.rgbToHex(paletteColor[0],paletteColor[1],paletteColor[2]);
            btn.child.label = `<span bgcolor="${hexCol}" font_size="150%">       </span>`;
            btn.tooltip_text = hexCol;
            i++;
        });

        if(!grey) {
            window.colorButtons.forEach(color => {
                let defaultArray = this.defaultPaletteArray;
                let bgPaletteArray = this.createBgPaletteArray();
                color.add_palette(Gtk.Orientation.VERTICAL, 0, null);
                color.add_palette(Gtk.Orientation.VERTICAL, 5, defaultArray);
                color.add_palette(Gtk.Orientation.HORIZONTAL, 6, bgPaletteArray);
            });
        }
    }

    triggerBackgroundPalette(window) {
        const importExport = this._settings.get_boolean('import-export');
        if(importExport)
            return;

        // Gray out the palette
        this.updatePalette(window, true);
        // Trigger backgroundPalette() by toggling 'bgpalette'
        let bgpalette = this._settings.get_boolean('bgpalette');
        if(bgpalette)
            this._settings.set_boolean('bgpalette', false);
        else
            this._settings.set_boolean('bgpalette', true);
        // Update palette once it is updated in settings
        setTimeout(() => {this.updatePalette(window, false)}, 500);
    }

    fillOpenbarPrefs(window, openbar) {

        // Get the settings object
        this._settings = openbar.getSettings();

        let mWidth = this._settings.get_int('monitor-width');
        let mHeight = this._settings.get_int('monitor-height');

        window.default_width = 820; // 825
        window.default_height = 940; //910
        let reqWidth = mWidth >= 1000? 815: mWidth - 100;
        let reqHeight = mHeight >= 1000? 935: mHeight - 100;
        window.set_size_request(reqWidth, reqHeight); // 815, 885

        window.paletteButtons = [];
        window.colorButtons = [];

        this.openbar = openbar;

        this.cssProvider = new Gtk.CssProvider();
        this.cssProvider.load_from_path(`${this.openbar.path}/prefs.css`);
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), this.cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        // console.log('fillOpenbarPrefs: loadQuotesFromFile');
        this.loadQuotesFromFile();

        // Get the settings object
        this._settings = openbar.getSettings();
        // Connect settings to update/save/reload stylesheet
        let settEvents = ['bartype', 'position', 'font', 'gradient', 'wmax-hbarhint', 'cust-margin-wmax', 'border-wmax', 'neon-wmax',
        'buttonbg-wmax', 'gradient-direction', 'shadow', 'neon', 'heffect', 'smbgoverride', 'mbg-gradient', 'autofg-bar', 'autofg-menu',
        'width-top', 'width-bottom', 'width-left', 'width-right', 'radius-topleft', 'radius-topright', 'autohg-bar', 'autohg-menu',
        'radius-bottomleft', 'radius-bottomright', 'apply-menu-notif', 'apply-menu-shell', 'apply-accent-shell', 'apply-all-shell',
        'dashdock-style', 'dborder', 'dshadow', 'set-overview', 'set-bottom-margin'];
        settEvents.forEach(event => {
            this._settings.connect('changed::'+event, () => {this.triggerStyleReload();});
        });

        // Update palette in preferences window on background change
        this._settings.connect('changed::bg-change', () => {
            this.updatePalette(window, false);
        });

        // Refresh auto-theme on accent-override switch change, if auto-theme set
        // this._settings.connect('changed::accent-override', () => {
        //     const mode = this._settings.get_string('color-scheme');
        //     let theme;
        //     if(mode == 'prefer-dark')
        //         theme = this._settings.get_string('autotheme-dark');
        //     else
        //         theme = this._settings.get_string('autotheme-light');
        //     if(theme == 'Select Theme')
        //         return;
        //     setTimeout(() => {
        //         this.triggerAutoTheme();
        //     }, 200);
        // });

        this.timeoutId = null;

        ////////////////////////////////////////////////////////////
        // PREFERENCES UI                                         //
        ////////////////////////////////////////////////////////////

        // const navigation = new Adw.NavigationSplitView({
        //     vexpand: true,
        //     hexpand: true
        // });
        // window.set_content(navigation);

        // const mainPage = new Adw.NavigationPage({
        //     title: "Test Page"
        // });

        // let toolbar = new Adw.ToolbarView();
        // let header = new Adw.HeaderBar();
        // toolbar.add_top_bar(header);
        // mainPage.set_child(toolbar);

        // const sidebar = new Adw.NavigationPage({
        //     title: "Sections"
        // });

        // toolbar = new Adw.ToolbarView();
        // header = new Adw.HeaderBar();
        // toolbar.add_top_bar(header);
        // sidebar.set_child(toolbar);

        // navigation.set_content(mainPage);
        // navigation.set_sidebar(sidebar);


        // Create the Settings page
        const settingsPage = new Adw.PreferencesPage({
            name: 'settings',
            title: _('Settings'),
            icon_name: 'emblem-system-symbolic',
        });
        window.add(settingsPage);

        const settingsGroup = new Adw.PreferencesGroup();
        settingsPage.add(settingsGroup);


        // Open Bar Title Grid
        let titlegrid = this.createGridWidget();
        titlegrid.halign = Gtk.Align.START;
        titlegrid.valign = Gtk.Align.CENTER;
        titlegrid.margin_top = 0;
        titlegrid.margin_bottom = 10;
        titlegrid.css_classes = ['openbar-titlegrid'];

        let rowbar = 1;

        // Add a logo image
        const aboutImage = new Gtk.Image({
            file: this.openbar.path + "/media/openbar.svg",
            vexpand: false,
            hexpand: false,
            valign: Gtk.Align.CENTER,
            pixel_size: 90,
            margin_top: 0,
            margin_bottom: 0,
            margin_start: 35,
            margin_end: 145,
            halign: Gtk.Align.START,
            css_classes: ['openbar-image'],
        });
        titlegrid.attach(aboutImage, 1, rowbar, 1, 1);

        let titleClass = 'openbar-title-light';
        let mode = this._settings.get_string('color-scheme');
        if(mode == 'prefer-dark')
            titleClass = 'openbar-title-dark';

        // Add a title label
        let titleLabel = new Gtk.Label({
            label: `<span size="x-large">Top Bar and Beyond      </span>\n\n<span underline="none"><b>${_('Version:')} ${this.openbar.metadata.version}  |  <a href="${this.openbar.metadata.url}">Home</a>  |  © <a href="https://extensions.gnome.org/accounts/profile/neuromorph">neuromorph</a>  |  <a href="${this.openbar.metadata.url}">☆ Star</a>  |  <a href="https://www.buymeacoffee.com/neuromorph"> ☕      </a></b></span>`,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            justify: Gtk.Justification.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        titlegrid.attach(titleLabel, 2, rowbar, 1, 1);


        // Quote Box
        this.quotePause = false;
        const quoteBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            halign: Gtk.Align.CENTER,
            homogeneous: false,
            margin_top: 10,
            css_classes: ['openbar-quotebox'],
        });
        quoteBox.set_size_request(-1, 75);

        // Add a quote image
        const quoteImage = new Gtk.Image({
            file: this.openbar.path + "/media/quote.png",
            vexpand: false,
            hexpand: false,
            valign: Gtk.Align.CENTER,
            pixel_size: 30,
            halign: Gtk.Align.CENTER,
        });

        const quoteBtn = new Gtk.Button({
            child: quoteImage,
            tooltip_text: 'Play/Pause quotes',
            css_classes: ['openbar-quotebtn'],
        });
        quoteBox.append(quoteBtn);

        quoteBtn.connect('clicked', () => {
            this.quotePause = !this.quotePause;
            this.setQuoteLabel(quoteLabel);
        });

        // Add a quote label
        let quoteLabel = new Gtk.Label({
            label: ``,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            width_chars: 78, //72
            vexpand: false,
            css_classes: ['openbar-quote'],
        });
        quoteBox.append(quoteLabel);
        this.setQuoteLabel(quoteLabel);

        //////////////////////////////////////////////////////////////////////////////////

        // WELCOME PAGE

        let welcomegrid = this.createGridWidget();

        rowbar = 1;

        let wecomeLabel = new Gtk.Label({
            label: `\n<span size="large">Welcome to Open Bar!</span>\n`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        welcomegrid.attach(wecomeLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Welcome Info Expander
        const welcomeExpander = new Gtk.Expander({
            label: `<b>Introduction</b>`,
            expanded: false,
            use_markup: true,
            margin_top: 5,
            margin_bottom: 10,
            css_classes: ['openbar-expander'],
        });

        let welcomeNotesLabel = new Gtk.Label({
            label: `<span  allow_breaks="true">\
            \n•  Open Bar allows you to theme the Top Bar, Pop-up Menus, Dash, Dock and rest of the Gnome Shell.\
            \n•  You can also extend the theme to Gtk and Flatpak apps to the extent possible with CSS.\
            \n•  You can choose any color for Accent and for everything else in the shell.\
            \n•  There are a lot of settings to allow full customization and they are grouped as tabs in the left panel.\
            \n•  To make things easier, there is an auto-theme feature that picks colors from the desktop background.\
            \n•  You can start with selecting the Type of bar, then select the desired Auto-Theme and apply.\
            \n•  Floating or Island bars are great on the desktop but when a window is maximized, you must try Window-Max bar.\
            \n•  Next, you can apply styles to Dash/Dock, Shell and Apps as desired for full theming experience.\
            \n•  Lastly, feel free to play with the settings and things will start becoming much easier.\
            \n\n Open the theming bar and let the colors flow!
        </span>`,
            wrap: true,
            use_markup: true,
            halign: Gtk.Align.START,
            width_chars: 55,
        });
        welcomeExpander.set_child(welcomeNotesLabel);
        welcomegrid.attach(welcomeExpander, 1, rowbar, 2, 1);

        //////////////////////////////////////////////////////////////////////////////////

        // AUTO THEMING and BACKGROUND PALETTE

        let palettegrid = this.createGridWidget();

        rowbar = 1;

        let autoThemeLabel = new Gtk.Label({
            label: `\n<span size="large">Automatic Themes from Desktop Background</span>\n`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        palettegrid.attach(autoThemeLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Auto Themes Info Expander
        const themesExpander = new Gtk.Expander({
            label: `<b>Auto Themes Introduction</b>`,
            expanded: false,
            use_markup: true,
            margin_top: 5,
            margin_bottom: 10,
            css_classes: ['openbar-expander'],
        });

        let autoThemeNotesLabel = new Gtk.Label({
            label: `<span  allow_breaks="true">\n•  Auto-themes will use the <b>colors</b> derived from the background image.\n•  Other settings will be set as selected, by the user, in the other tabs.\n•  Styles will apply to the Top Bar, Menus and optionally to the shell.\n•  You may further tweak the styles after applying auto-theme.

        <b><tt>True Color  </tt></b>   :  Palette colors as-is (biased towards dark).
        <b><tt>Pastel Theme</tt></b>   :  Colors are pastelified (biased towards light).
        <b><tt>Dark Theme  </tt></b>   :  Colors are darkened as needed.
        <b><tt>Light Theme </tt></b>   :  Colors are lightened as needed.
        </span>`,
            wrap: true,
            use_markup: true,
            halign: Gtk.Align.START,
            width_chars: 55,
        });

        themesExpander.set_child(autoThemeNotesLabel);
        palettegrid.attach(themesExpander, 1, rowbar, 2, 1);

        rowbar += 1;

        let autoThemeChgLabel = new Gtk.Label({
            label: `<span>Auto-Refresh theme on change of Background</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        palettegrid.attach(autoThemeChgLabel, 1, rowbar, 1, 1);

        let autoThemeChgSwitch = this.createSwitchWidget('autotheme-refresh', 'If enabled, current theme will be overridden with new auto-theme when desktop background is changed');
        palettegrid.attach(autoThemeChgSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        let autoAlphaSetLabel = new Gtk.Label({
            label: `<span>Auto-Set Bar, Margins and Islands BG Alpha</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        palettegrid.attach(autoAlphaSetLabel, 1, rowbar, 1, 1);

        let autoAlphaSetSwitch = this.createSwitchWidget('auto-bgalpha', 'Turn Off to retain user-set values for BG alpha (background opacity)');
        palettegrid.attach(autoAlphaSetSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        let autoFgBarLabel = new Gtk.Label({
            label: `<span>Auto-Set Bar foreground color</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        palettegrid.attach(autoFgBarLabel, 1, rowbar, 1, 1);

        let autoFgBarSwitch = this.createSwitchWidget('autofg-bar', 'Turn Off to retain user-set values for Bar FG (foreground) color');
        palettegrid.attach(autoFgBarSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        let autoFgMenuLabel = new Gtk.Label({
            label: `<span>Auto-Set Menu foreground color</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        palettegrid.attach(autoFgMenuLabel, 1, rowbar, 1, 1);

        let autoFgMenuSwitch = this.createSwitchWidget('autofg-menu', 'Turn Off to retain user-set values for Menu FG (foreground) color');
        palettegrid.attach(autoFgMenuSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Secondary menu color Override
        // Add a secondary color override switch
        let autosmbgOLbl = new Gtk.Label({
            label: `Alternate Secondary Menu BG Color (auto)`,
            halign: Gtk.Align.START,
        });
        palettegrid.attach(autosmbgOLbl, 1, rowbar, 1, 1);

        let autosmbgOSwitch = this.createSwitchWidget('smbgoverride', 'Auto-Theme will choose alternate secondary/sub-menu color instead of deriving from BG color');
        palettegrid.attach(autosmbgOSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add an accent color override switch
        let accentOLbl = new Gtk.Label({
            label: `Override auto-theme Accent Color (as selected below)`,
            halign: Gtk.Align.START,
        });
        palettegrid.attach(accentOLbl, 1, rowbar, 1, 1);

        let accentOSwitch = this.createSwitchWidget('accent-override', 'Use accent color selected below instead of auto-generated one');
        palettegrid.attach(accentOSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a accent override color chooser
        let accentOColorLabel = new Gtk.Label({
            label: 'Accent Color (override)',
            halign: Gtk.Align.START,
        });
        palettegrid.attach(accentOColorLabel, 1, rowbar, 1, 1);

        let accentOColorChooser = this.createColorWidget(window, 'Auto Theme Accent Color', 'Select preferred accent color', 'accent-color');
        palettegrid.attach(accentOColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Auto Themes Modes Expander
        const modesExpander = new Gtk.Expander({
            label: `<b>Auto Themes for Dark/Light Modes</b>`,
            expanded: false,
            use_markup: true,
            margin_top: 15,
            css_classes: ['openbar-expander'],
        });

        let autoThemeModesLabel = new Gtk.Label({
            label: `<span  allow_breaks="true">\n•  Select themes for Dark/Light modes and click Apply.\n•  You may further tweak styles after applying auto-theme.\n•  Color changes made in current mode will be saved for that mode.\n•  Themes can be regenerated by clicking Apply or on background change.</span>`,
            wrap: true,
            use_markup: true,
            halign: Gtk.Align.START,
            width_chars: 55,
        });

        modesExpander.set_child(autoThemeModesLabel);
        palettegrid.attach(modesExpander, 1, rowbar, 2, 1);

        rowbar += 1;

        const themeGrid = this.createGridWidget();
        themeGrid.halign = Gtk.Align.CENTER;
        let rownum = 1;

        // Add a Dark mode label
        let darkModeLabel = new Gtk.Label({
            label: `<b>Gnome Dark Mode:</b>`,
            halign: Gtk.Align.START,
            use_markup: true,
        });
        themeGrid.attach(darkModeLabel, 1, rownum, 1, 1);

        let themeTypeDark = this.createComboboxWidget([ ["Select Theme", _("Select Theme")], ["Color", _("True Color")], ["Pastel", _("Pastel Theme")], ["Dark", _("Dark Theme")], ["Light", _("Light Theme")]]);
        themeTypeDark.set_active_id(this._settings.get_string('autotheme-dark'));
        themeGrid.attach(themeTypeDark, 2, rownum, 1, 1);
        rownum += 1;

        // Add a Light mode label
        let lightModeLabel = new Gtk.Label({
            label: `<b>Gnome Light Mode:</b>`,
            halign: Gtk.Align.START,
            use_markup: true,
        });
        themeGrid.attach(lightModeLabel, 1, rownum, 1, 1);

        let themeTypeLight = this.createComboboxWidget([ ["Select Theme", _("Select Theme")], ["Color", _("True Color")], ["Pastel", _("Pastel Theme")], ["Dark", _("Dark Theme")], ["Light", _("Light Theme")]]);
        themeTypeLight.set_active_id(this._settings.get_string('autotheme-light'));
        themeGrid.attach(themeTypeLight, 2, rownum, 1, 1);
        rownum += 1;

        const applyThemeBtn = new Gtk.Button({
            label: 'Apply',
            tooltip_text: 'Apply selected themes to Dark/Light modes'
        });
        themeGrid.attach(applyThemeBtn, 3, 1, 1, 2);

        palettegrid.attach(themeGrid, 1, rowbar, 2, 1);

        rowbar += 1;

        let applyThemeErrLbl = new Gtk.Label({
            label: ``,
            sensitive: false,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: ['openbar-message']
        });
        palettegrid.attach(applyThemeErrLbl, 1, rowbar, 2, 1);

        applyThemeBtn.connect('clicked', () => {
            let themeDark = themeTypeDark.get_active_id();
            let themeLight = themeTypeLight.get_active_id();
            if(themeDark == 'Select Theme' && themeLight == 'Select Theme') {
                applyThemeErrLbl.label = `<span color="#ff8c00">Please select desired themes to apply.</span>`;
                applyThemeErrLbl.sensitive = true;
                setTimeout(() => { applyThemeErrLbl.label = ``;
                                    applyThemeErrLbl.sensitive = false;}, 3000);
                return;
            }
            else {
                applyThemeErrLbl.label = `<span color="#00ddee">Selected theme will apply in respective mode.</span>`;
                applyThemeErrLbl.sensitive = true;
                setTimeout(() => { applyThemeErrLbl.label = ``;
                                    applyThemeErrLbl.sensitive = false;}, 3000);
            }
            if(themeDark != 'Select Theme')
                this._settings.set_string('autotheme-dark', themeDark);
            if(themeLight != 'Select Theme')
                this._settings.set_string('autotheme-light', themeLight);

            this.triggerAutoTheme();
        });

        rowbar += 1;

        let paletteLabel = new Gtk.Label({
            label: `<span>\n<b>Desktop Background Color Palette</b></span>\n\n<span allow_breaks="true">•  The palette will auto-refresh when the background changes.\n•  Unless the extension is disabled during the change.\n•  Click on 'Get' button to manually refresh the palette.\n•  This palette is available in each color button popup (under default one).</span>`,
            use_markup: true,
            margin_top: 0,
            wrap: true,
            halign: Gtk.Align.START,
        });
        palettegrid.attach(paletteLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        let getPaletteLabel = new Gtk.Label({
            label: `<span>Manual trigger to get/ refresh the palette</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
            margin_top: 10,
        });
        palettegrid.attach(getPaletteLabel, 1, rowbar, 1, 1);

        const getPaletteBtn = new Gtk.Button({
            label: `🔄 Get`,
            halign: Gtk.Align.END,
            margin_top: 10,
            tooltip_text: 'Generate/ Refresh Color Palette from desktop background'
        });
        getPaletteBtn.connect('clicked', () => {
            this.triggerBackgroundPalette(window);
        });

        palettegrid.attach(getPaletteBtn, 2, rowbar, 1, 1);

        rowbar += 1;

        const paletteBox1 = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5,
            margin_top: 5,
            margin_bottom: 1,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            css_classes: ['palette-box'],
        });
        const paletteBox2 = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5,
            margin_top: 1,
            margin_bottom: 1,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            css_classes: ['palette-box'],
        });

        let clipboard = Gdk.Display.get_default().get_clipboard();

        this.createPalette(window, paletteBox1, paletteBox2, clipboard);

        palettegrid.attach(paletteBox1, 1, rowbar, 2, 1);
        rowbar += 1;
        palettegrid.attach(paletteBox2, 1, rowbar, 2, 1);

        //////////////////////////////////////////////////////////////////////////////////

        // BAR PROPERTIES

        let bargrid = this.createGridWidget();

        rowbar = 1;

        // Label for Top Bar Properties
        let topBarLbl = new Gtk.Label({
            label: `<span size="large">Top Bar Properties\n\n</span>`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            css_classes: [titleClass],
        });
        bargrid.attach(topBarLbl, 1, rowbar, 2, 1);
        rowbar += 1;

        //Type of bar
        let barTypeLbl = new Gtk.Label({
            label: 'Type of Bar',
            halign: Gtk.Align.START,
        });
        bargrid.attach(barTypeLbl, 1, rowbar, 1, 1);

        let barType = this.createComboboxWidget([ ["Mainland", _("Mainland")], ["Floating", _("Floating")], ["Trilands", _("Trilands")], ["Islands", _("Islands")]], 'bartype');
        bargrid.attach(barType, 2, rowbar, 1, 1);

        rowbar += 1;

        //Position of bar
        let barPosLbl = new Gtk.Label({
            label: 'Position of Bar',
            halign: Gtk.Align.START,
        });
        bargrid.attach(barPosLbl, 1, rowbar, 1, 1);

        let barPos = this.createComboboxWidget([ ["Top", _("Top")], ["Bottom", _("Bottom")] ], 'position');
        bargrid.attach(barPos, 2, rowbar, 1, 1);

        rowbar += 1;

        //Position of notification popups
        let notifPosLbl = new Gtk.Label({
            label: 'Apply to Notifications',
            halign: Gtk.Align.START,
            tooltip_text: 'Move notification popups as per the bar position (Top/Bottom)'
        });
        bargrid.attach(notifPosLbl, 1, rowbar, 1, 1);

        let notifPos = this.createSwitchWidget('set-notif-position', 'Move notification popups as per the bar position (Top/Bottom)');
        bargrid.attach(notifPos, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a bar height scale
        let heightLabel = new Gtk.Label({
            label: 'Bar Height',
            halign: Gtk.Align.START,
        });
        bargrid.attach(heightLabel, 1, rowbar, 1, 1);

        let height = this.createScaleWidget(10, 100, 1, 0, 'height');
        bargrid.attach(height, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a bar margin scale
        let marginLabel = new Gtk.Label({
            label: 'Bar Margins',
            halign: Gtk.Align.START,
        });
        bargrid.attach(marginLabel, 1, rowbar, 1, 1);

        let margin = this.createScaleWidget(0, 30, 0.2, 1, 'margin', 'Not applicable for Mainland');
        bargrid.attach(margin, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a custom bottom margin switch
        let bottomMarginSwitchLabel = new Gtk.Label({
            label: 'Customize Bottom Margin',
            halign: Gtk.Align.START,
            tooltip_text: 'Turn-On to use custom bottom-margin below. Allows to adjust the gap between top bar and app windows. Especially useful when using tiling extensions.',
        });
        bargrid.attach(bottomMarginSwitchLabel, 1, rowbar, 1, 1);

        let bottomMarginSwitch = this.createSwitchWidget('set-bottom-margin', "Turn-On to use custom bottom-margin below. Allows to adjust the gap between top bar and app windows. Especially useful when using tiling extensions.");
        bargrid.attach(bottomMarginSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a bar bottom margin scale
        let bottomMarginLabel = new Gtk.Label({
            label: 'Custom Bottom Margin',
            halign: Gtk.Align.START,
        });
        bargrid.attach(bottomMarginLabel, 1, rowbar, 1, 1);

        let bottomMargin = this.createScaleWidget(0, 30, 0.2, 1, 'bottom-margin', 'Allows to adjust the gap between top bar and app windows. Especially useful when using tiling extensions.');
        bargrid.attach(bottomMargin, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add an overview switch
        let overviewLabel = new Gtk.Label({
            label: 'Apply in Overview',
            halign: Gtk.Align.START,
        });
        bargrid.attach(overviewLabel, 1, rowbar, 1, 1);

        let overviewSwitch = this.createSwitchWidget('set-overview', 'Turn off to get transparent bar in Overview');
        bargrid.attach(overviewSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a fullscreen switch
        let fullscreenLabel = new Gtk.Label({
            label: 'Apply in Fullscreen',
            halign: Gtk.Align.START,
        });
        bargrid.attach(fullscreenLabel, 1, rowbar, 1, 1);

        let fullscreenSwitch = this.createSwitchWidget('set-fullscreen', "Turn Off only if you face a 'crash' when locking screen while in fullscreen - Mutter issue");
        bargrid.attach(fullscreenSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Proximity - Fitts Widgets switch
        let fittsWidgetsLabel = new Gtk.Label({
            label: 'Enable Buttons Proximity',
            halign: Gtk.Align.START,
            tooltip_text: 'Interact with panel buttons, from the screen-edge proximity, without having to precisely pinpoint them, refer Fitts Law.',
        });
        bargrid.attach(fittsWidgetsLabel, 1, rowbar, 1, 1);

        let fittsWidgetsSwitch = this.createSwitchWidget('fitts-widgets', "Interact with panel buttons, from the screen-edge proximity, without having to precisely pinpoint them, refer Fitts Law.");
        bargrid.attach(fittsWidgetsSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Bar Props Note label
        let barNoteLabel = new Gtk.Label({
            use_markup: true,
            label: `<span allow_breaks="true">\n\nNote:\n•  Horizontal and Vertical paddings can be set in <b>Bar Highlights</b> tab.\n•  Accent color can be set in <b>Popup Menus</b> tab.\n•  Bar rounding radius can be set in <b>Bar Border</b> tab.</span>`,
            halign: Gtk.Align.START,
            wrap: true,
            width_chars: 55,
        });
        bargrid.attach(barNoteLabel, 1, rowbar, 2, 1);

        //////////////////////////////////////////////////////////////////////////////////

        // WMAX BAR PROPERTIES

        let bargridwmax = this.createGridWidget();

        rowbar = 1;

        // Label for WMax Bar Properties
        let wmaxBarPropLabel = new Gtk.Label({
            label: `<span size="large">Window-Max Bar Properties\n\n</span>`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        bargridwmax.attach(wmaxBarPropLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a WMax Bar label
        let wmaxBarLabel = new Gtk.Label({
            use_markup: true,
            label: `<span allow_breaks="true">When Window-Max bar is enabled, the following properties will apply to the Bar when a window is maximized.\n</span>`,
            halign: Gtk.Align.START,
            wrap: true,
            width_chars: 55,
        });
        bargridwmax.attach(wmaxBarLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a WMax Bar switch
        let wmaxLabel = new Gtk.Label({
            label: 'Enable Window-Max Bar',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxLabel, 1, rowbar, 1, 1);

        let wmaxSwitch = this.createSwitchWidget('wmaxbar');
        bargridwmax.attach(wmaxSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a WMax BG Color button
        let wmaxBgLabel = new Gtk.Label({
            label: 'Bar BG Color (WMax)',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxBgLabel, 1, rowbar, 1, 1);

        let wmaxBg = this.createColorWidget(window, 'Background Color', 'Background color for the WMax bar', 'bgcolor-wmax');
        bargridwmax.attach(wmaxBg, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a WMax BG Alpha scale
        let wmaxAlphaLabel = new Gtk.Label({
            label: 'Bar BG Alpha (WMax)',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxAlphaLabel, 1, rowbar, 1, 1);

        let wmaxAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'bgalpha-wmax');
        bargridwmax.attach(wmaxAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Match wmax BG with Gtk Headerbar hint switch
        let wmaxHbarLabel = new Gtk.Label({
            label: 'Match BG with Headerbar',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxHbarLabel, 1, rowbar, 1, 1);

        let wmaxHbarSwitch = this.createSwitchWidget('wmax-hbarhint', 'Match the background color of WMax bar with the Gtk headerbar hint - refer Gtk/Flatpak Apps tab');
        bargridwmax.attach(wmaxHbarSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a WMax custom margin enable switch
        let wmaxCustMarginLabel = new Gtk.Label({
            label: 'Customize Bar Height?',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxCustMarginLabel, 1, rowbar, 1, 1);

        let wmaxCustMarginSwitch = this.createSwitchWidget('cust-margin-wmax');
        bargridwmax.attach(wmaxCustMarginSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a wmax bar margin scale
        let wmaxmarginLabel = new Gtk.Label({
            label: 'Bar Height (WMax)',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxmarginLabel, 1, rowbar, 1, 1);

        let wmaxmargin = this.createScaleWidget(0, 30, 0.2, 1, 'margin-wmax', 'Not applicable for Mainland');
        bargridwmax.attach(wmaxmargin, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a WMax Buttons BG switch
        let wmaxBtnBGLabel = new Gtk.Label({
            label: 'Keep Button Color (Tri/Islands)',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxBtnBGLabel, 1, rowbar, 1, 1);

        let wmaxBtnBGSwitch = this.createSwitchWidget('buttonbg-wmax', 'Keep BG color of buttons. If disabled, buttons will be transparent');
        bargridwmax.attach(wmaxBtnBGSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a WMax border switch
        let wmaxBorderLabel = new Gtk.Label({
            label: 'Keep Border (Tri/Islands)',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxBorderLabel, 1, rowbar, 1, 1);

        let wmaxBorderSwitch = this.createSwitchWidget('border-wmax');
        bargridwmax.attach(wmaxBorderSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a WMax neon switch
        let wmaxNeonLabel = new Gtk.Label({
            label: 'Keep Neon Glow (Tri/Islands)',
            halign: Gtk.Align.START,
        });
        bargridwmax.attach(wmaxNeonLabel, 1, rowbar, 1, 1);

        let wmaxNeonSwitch = this.createSwitchWidget('neon-wmax');
        bargridwmax.attach(wmaxNeonSwitch, 2, rowbar, 1, 1);

        //////////////////////////////////////////////////////////////////////////////////

        // BAR FOREGROUND

        let fggrid = this.createGridWidget();

        rowbar = 1;

        // Add a Bar Foreground label
        let fgLabel = new Gtk.Label({
            label: `<span size="large">Bar Foreground\n\n</span>`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        fggrid.attach(fgLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add an Auto FG color switch for Bar
        let autofgBarLabel = new Gtk.Label({
            label: 'Auto FG Color',
            halign: Gtk.Align.START,
        });
        fggrid.attach(autofgBarLabel, 1, rowbar, 1, 1);

        let autofgBarSwitch = this.createSwitchWidget('autofg-bar', 'Automatically set white/black FG color as per background color of bar/buttons');
        fggrid.attach(autofgBarSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a foreground color chooser
        let fgColorLbl = new Gtk.Label({
            label: 'FG Color',
            halign: Gtk.Align.START,
        });
        fggrid.attach(fgColorLbl, 1, rowbar, 1, 1);

        let fgColor = this.createColorWidget(window, 'Foreground Color', 'Foreground color for the bar', 'fgcolor');
        fggrid.attach(fgColor, 2, rowbar, 1, 1);

        rowbar += 1;
        // Add a foreground alpha scale
        let fgAlphaLbl = new Gtk.Label({
            label: 'FG Alpha',
            halign: Gtk.Align.START,
        });
        fggrid.attach(fgAlphaLbl, 1, rowbar, 1, 1);

        let fgAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'fgalpha');
        fggrid.attach(fgAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a font button
        let fontLabel = new Gtk.Label({
            label: 'Panel Font',
            halign: Gtk.Align.START,
        });
        fggrid.attach(fontLabel, 1, rowbar, 1, 1);

        const fontBtn = new Gtk.FontButton({
            use_font: true,
            tooltip_text: _("Font for Panel text"),
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        let font = this._settings.get_string('font');
        if (font == ""){
            let defaultFont = fontBtn.get_font();
            this._settings.set_string('default-font', defaultFont);
            font = defaultFont;
        }
        fontBtn.set_font(font);
        let obar = this;
        fontBtn.connect(
            "font-set",
            function (w) {
                var value = w.get_font();
                obar._settings.set_string('font', value);
                // obar.triggerStyleReload();
            }
        );

        // Update font widget when font changed from settings (due to import file)
        this._settings.connect('changed::font', () => {
            let font = obar._settings.get_string('font');
            fontBtn.set_font(font);
        });

        fggrid.attach(fontBtn, 2, rowbar, 1, 1);

        const resetFontBtn = new Gtk.Button({
            label: '↺',
            width_request: 10,
            tooltip_text: _("Reset to default font"),
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END
        });
        resetFontBtn.get_style_context().add_class('circular');
        resetFontBtn.connect('clicked', () => {
            obar._settings.reset('font');
            fontBtn.set_font(obar._settings.get_string('default-font'));
            // obar.triggerStyleReload();
        });
        fggrid.attach(resetFontBtn, 3, rowbar, 1, 1);

        ///////////////////////////////////////////////////////////////////

        // BAR BACKGROUND

        let bggrid = this.createGridWidget();

        rowbar = 1;

        // Add a Bar Background label
        let bgLabel = new Gtk.Label({
            label: `<span size="large">Bar Background\n\n</span>`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        bggrid.attach(bgLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Bar BG Note label
        let barBGNoteLabel = new Gtk.Label({
            use_markup: true,
            label: `<span allow_breaks="true">Transparent Bar:\n•  Set Box/Margins Alpha to '0' and also Bar BG Alpha to '0'.\n•  Turn Off Panel Blur in 'Blur My Shell', if applied.\n</span>`,
            halign: Gtk.Align.START,
            wrap: true,
            width_chars: 55,
        });
        bggrid.attach(barBGNoteLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Panel Box background color chooser
        let boxColorLbl = new Gtk.Label({
            label: 'Box/Margins Color',
            halign: Gtk.Align.START,
        });
        bggrid.attach(boxColorLbl, 1, rowbar, 1, 1);

        let boxColor = this.createColorWidget(window, 'Panel-Box Background Color', 'Background color for the panel box / margins', 'boxcolor');
        bggrid.attach(boxColor, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a background alpha scale
        let boxAlphaLbl = new Gtk.Label({
            label: 'Box/Margins Alpha',
            halign: Gtk.Align.START,
        });
        bggrid.attach(boxAlphaLbl, 1, rowbar, 1, 1);

        let boxAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'boxalpha');
        bggrid.attach(boxAlpha, 2, rowbar, 1, 1);

        rowbar += 1;


        // Add a bar background color chooser
        let bgColorLbl = new Gtk.Label({
            label: 'Bar BG Color',
            halign: Gtk.Align.START,
        });
        bggrid.attach(bgColorLbl, 1, rowbar, 1, 1);

        let bgColor = this.createColorWidget(window, 'Background Color', 'Background or gradient start color for the bar', 'bgcolor');
        bggrid.attach(bgColor, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a bar background alpha scale
        let bgAlphaLbl = new Gtk.Label({
            label: 'Bar BG Alpha',
            halign: Gtk.Align.START,
        });
        bggrid.attach(bgAlphaLbl, 1, rowbar, 1, 1);

        let bgAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'bgalpha');
        bggrid.attach(bgAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Islands color chooser
        let islandsColorLabel = new Gtk.Label({
            label: 'Tri/Islands BG Color',
            halign: Gtk.Align.START,
        });
        bggrid.attach(islandsColorLabel, 1, rowbar, 1, 1);

        let islandsColorChooser = this.createColorWidget(window, 'Islands/Trilands Background Color', 'Background or gradient start color for Islands/Trilands', 'iscolor');
        bggrid.attach(islandsColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Islands alpha scale
        let isAlphaLbl = new Gtk.Label({
            label: 'Tri/Islands Alpha',
            halign: Gtk.Align.START,
        });
        bggrid.attach(isAlphaLbl, 1, rowbar, 1, 1);

        let isAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'isalpha');
        bggrid.attach(isAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a gradient switch
        let gradientLbl = new Gtk.Label({
            label: 'BG Gradient',
            halign: Gtk.Align.START,
        });
        bggrid.attach(gradientLbl, 1, rowbar, 1, 1);

        let gradient = this.createSwitchWidget('gradient');
        bggrid.attach(gradient, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a gradient color chooser
        let grColorLbl = new Gtk.Label({
            label: 'Gradient End Color',
            halign: Gtk.Align.START,
        });
        bggrid.attach(grColorLbl, 1, rowbar, 1, 1);

        let grColor = this.createColorWidget(window, 'Gradient End Color', 'Second color of gradient', 'bgcolor2');
        bggrid.attach(grColor, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a gradient 2 alpha scale
        let grAlphaLbl = new Gtk.Label({
            label: 'Gradient End Alpha',
            halign: Gtk.Align.START,
        });
        bggrid.attach(grAlphaLbl, 1, rowbar, 1, 1);

        let grAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'bgalpha2');
        bggrid.attach(grAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Gradient direction
        let grDirecLbl = new Gtk.Label({
            label: 'Gradient Direction',
            halign: Gtk.Align.START,
        });
        bggrid.attach(grDirecLbl, 1, rowbar, 1, 1);

        let grDirection = this.createComboboxWidget([["horizontal", _("Horizontal")], ["vertical", _("Vertical")]], 'gradient-direction');
        bggrid.attach(grDirection, 2, rowbar, 1, 1);

        rowbar += 1;

        // Candybar color palette
        let candybarLbl = new Gtk.Label({
            label: 'Apply Candybar Pallete',
            halign: Gtk.Align.START,
            tooltip_text: 'Click on the color buttons to edit colors',
        });
        bggrid.attach(candybarLbl, 1, rowbar, 1, 1);

        // Add a candybar switch
        let candybar = this.createSwitchWidget('candybar', 'Click on the color buttons to edit colors');
        bggrid.attach(candybar, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add canybar color pallete in boxes
        const candyPaletteBox1 = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5,
            margin_top: 5,
            margin_bottom: 0,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            css_classes: ['palette-box'],
        });
        const candyPaletteBox2 = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5,
            margin_top: 0,
            margin_bottom: 1,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            css_classes: ['palette-box'],
        });
        this.createCandyPalette(window, candyPaletteBox1, candyPaletteBox2);
        bggrid.attach(candyPaletteBox1, 1, rowbar, 2, 1);
        rowbar += 1;
        bggrid.attach(candyPaletteBox2, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a candybar alpha scale
        let candyAlphaLbl = new Gtk.Label({
            label: 'Candy BG Alpha',
            halign: Gtk.Align.START,
        });
        bggrid.attach(candyAlphaLbl, 1, rowbar, 1, 1);

        let candyAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'candyalpha');
        bggrid.attach(candyAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a shadow switch
        let shadowLabel = new Gtk.Label({
            label: `Panel Shadow`,
            halign: Gtk.Align.START,
        });
        bggrid.attach(shadowLabel, 1, rowbar, 1, 1);

        let shadowSwitch = this.createSwitchWidget('shadow', 'Not applicable to Mainland/Floating bar if "neon glow" is On (under Bar Border)');
        bggrid.attach(shadowSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a panel shadow color chooser
        let shColorLabel = new Gtk.Label({
            label: 'Shadow Color',
            halign: Gtk.Align.START,
        });
        bggrid.attach(shColorLabel, 1, rowbar, 1, 1);

        let shColorChooser = this.createColorWidget(window, 'Panel Shadow Color', 'Shadow color for the Panel. Choose light color for dark theme and dark for light.', 'shcolor');
        bggrid.attach(shColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a panel shadow alpha and spread scale
        let shAlphaLbl = new Gtk.Label({
            label: 'Shadow Spread',
            halign: Gtk.Align.START,
        });
        bggrid.attach(shAlphaLbl, 1, rowbar, 1, 1);

        let shAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'shalpha');
        bggrid.attach(shAlpha, 2, rowbar, 1, 1);

        ////////////////////////////////////////////////////////////////////////////

        // BAR HIGHLIGHTS

        let hgrid = this.createGridWidget();

        rowbar = 1;

        // Bar Highlights label
        let highlightsLbl = new Gtk.Label({
            label: `<span size="large">Bar Highlights (Hover - Focus)</span>\n\n`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            css_classes: [titleClass],
        });
        hgrid.attach(highlightsLbl, 1, rowbar, 2, 1);

        rowbar += 1;

        // Bar highlights info label
        let highlightInfo = new Gtk.Label({
            label: '<span>Hover/focus highlight colors and paddings for Panel Buttons.</span>\n',
            use_markup: true,
            halign: Gtk.Align.CENTER,
        });
        hgrid.attach(highlightInfo, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add an Auto highlight color switch for Bar
        let autohgBarLabel = new Gtk.Label({
            label: 'Auto Highlight Color',
            halign: Gtk.Align.START,
        });
        hgrid.attach(autohgBarLabel, 1, rowbar, 1, 1);

        let autohgBarSwitch = this.createSwitchWidget('autohg-bar', 'Automatically set highlight color as per background color of bar/buttons');
        hgrid.attach(autohgBarSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a highlight color chooser
        let highlightColorLabel = new Gtk.Label({
            label: 'Highlight Color',
            halign: Gtk.Align.START,
        });
        hgrid.attach(highlightColorLabel, 1, rowbar, 1, 1);

        let highlightColorChooser = this.createColorWidget(window, 'Highlight Color', 'Highlight color for hover, focus etc.', 'hcolor');
        // highlightColorChooser.connect('color-set', () => {
        //     this.triggerStyleReload();
        // });
        hgrid.attach(highlightColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a highlight alpha scale
        let hgAlphaLbl = new Gtk.Label({
            label: 'Highlight Alpha',
            halign: Gtk.Align.START,
        });
        hgrid.attach(hgAlphaLbl, 1, rowbar, 1, 1);

        let hgAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'halpha');
        hgrid.attach(hgAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a 'hover with border' effect switch
        let hEffectLabel = new Gtk.Label({
            label: `Highlight with Border`,
            halign: Gtk.Align.START,
        });
        hgrid.attach(hEffectLabel, 1, rowbar, 1, 1);

        let hEffectSwitch = this.createSwitchWidget('heffect');
        hgrid.attach(hEffectSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a horizontal button-padding scale
        let hBtnPadLbl = new Gtk.Label({
            label: 'Horizontal Padding',
            halign: Gtk.Align.START,
        });
        hgrid.attach(hBtnPadLbl, 1, rowbar, 1, 1);

        let hBtnPad = this.createScaleWidget(0, 30, 0.5, 1, 'hpad', 'Horizontal padding for panel buttons/highlights');
        hgrid.attach(hBtnPad, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a vertical button-padding scale
        let vBtnPadLbl = new Gtk.Label({
            label: 'Vertical Padding',
            halign: Gtk.Align.START,
        });
        hgrid.attach(vBtnPadLbl, 1, rowbar, 1, 1);

        let vBtnPad = this.createScaleWidget(0, 20, 0.5, 1, 'vpad', 'Vertical padding for panel buttons/highlights');
        hgrid.attach(vBtnPad, 2, rowbar, 1, 1);

        ////////////////////////////////////////////////////////////////////////////

        // BAR BORDER

        let bgrid = this.createGridWidget();

        rowbar = 1;

        // //Type of border
        // let borderTypeLbl = new Gtk.Label({
        //     label: 'Type of Border',
        //     halign: Gtk.Align.START,
        // });
        // bgrid.attach(borderTypeLbl, 1, rowbar, 1, 1);

        // let borderType = new Gtk.ComboBoxText({halign: Gtk.Align.END});
        // borderType.append("solid", _("Solid"));
        // borderType.append("double", _("Double"));
        // borderType.append("dashed", _("Dashed"));
        // bgrid.attach(borderType, 2, rowbar, 1, 1);

        // rowbar += 1;

        // Bar Border label
        let borderBarLabel = new Gtk.Label({
            label: `<span size="large">Bar Border\n\n</span>`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        bgrid.attach(borderBarLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a border width scale
        let borderWidthLabel = new Gtk.Label({
            label: 'Width',
            halign: Gtk.Align.START,
        });
        bgrid.attach(borderWidthLabel, 1, rowbar, 1, 1);

        let borderWidthScale = this.createScaleWidget(0, 10, 0.1, 1, 'bwidth');
        bgrid.attach(borderWidthScale, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add Apply Border-Width label
        let borderWidthApplyLabel = new Gtk.Label({
            label: `Apply Width to`,
            halign: Gtk.Align.START,
        });
        bgrid.attach(borderWidthApplyLabel, 1, rowbar, 1, 1);

        // Width Sides Box
        const widthBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5,
            // margin_top: 5,
            // margin_bottom: 5,
            halign: Gtk.Align.END,
            homogeneous: false,
            css_classes: ['button-box'],
        });
        let widthTop = this.createToggleButton('Top', 'width-top', 'Top Side');
        widthBox.append(widthTop);
        let widthBottom = this.createToggleButton('Bottom', 'width-bottom', 'Bottom Side');
        widthBox.append(widthBottom);
        let widthLeft = this.createToggleButton('Left', 'width-left', 'Left Side');
        widthBox.append(widthLeft);
        let widthRight = this.createToggleButton('Right', 'width-right', 'Right Side');
        widthBox.append(widthRight);
        bgrid.attach(widthBox, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a border radius scale
        let bRadiuslbl = new Gtk.Label({
            label: 'Corner Radius',
            halign: Gtk.Align.START,
        });
        bgrid.attach(bRadiuslbl, 1, rowbar, 1, 1);

        let bRadius = this.createScaleWidget(0, 50, 1, 0, 'bradius', 'Note: There is an internal max limit on Border Radius for "Neon" based on the Bar Height and Border Width');
        bgrid.attach(bRadius, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add Apply Radius to Corner label
        let bRadiusApplyLabel = new Gtk.Label({
            label: `Apply Radius to`,
            halign: Gtk.Align.START,
        });
        bgrid.attach(bRadiusApplyLabel, 1, rowbar, 1, 1);

        // Radius Sides Box
        const radiusBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5,
            // margin_top: 5,
            // margin_bottom: 5,
            halign: Gtk.Align.END,
            homogeneous: false,
            css_classes: ['button-box'],
        });
        let radiusTopLeft = this.createToggleButton('Top-L', 'radius-topleft', 'Top-Left Corner');
        radiusBox.append(radiusTopLeft);
        let radiusTopRight = this.createToggleButton('Top-R', 'radius-topright', 'Top-Right Corner');
        radiusBox.append(radiusTopRight);
        let radiusBottomLeft = this.createToggleButton('Bottom-L', 'radius-bottomleft', 'Bottom-Left Corner');
        radiusBox.append(radiusBottomLeft);
        let radiusBottomRight = this.createToggleButton('Bottom-R', 'radius-bottomright', 'Bottom-Right Corner');
        radiusBox.append(radiusBottomRight);

        bgrid.attach(radiusBox, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a border color chooser
        let borderColorLabel = new Gtk.Label({
            label: 'Color',
            halign: Gtk.Align.START,
        });
        bgrid.attach(borderColorLabel, 1, rowbar, 1, 1);

        let borderColorChooser = this.createColorWidget(window, 'Border Color', 'Border Color', 'bcolor');
        bgrid.attach(borderColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Border alpha scale
        let bAlphaLbl = new Gtk.Label({
            label: 'Alpha',
            halign: Gtk.Align.START,
        });
        bgrid.attach(bAlphaLbl, 1, rowbar, 1, 1);

        let bAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'balpha');
        bgrid.attach(bAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a neon switch
        let neonLbl = new Gtk.Label({
            label: `Neon Glow`,
            halign: Gtk.Align.START,
        });
        bgrid.attach(neonLbl, 1, rowbar, 1, 1);

        let neon = this.createSwitchWidget('neon', 'Adds neon-glow effect. Select bright/neon color for border and dark-opaque background for Bar/Islands');
        bgrid.attach(neon, 2, rowbar, 1, 1);

        ////////////////////////////////////////////////////////////////////

        // POPUP MENUS

        let menugrid = this.createGridWidget();

        rowbar = 1;

        // Popup Menus label
        let popupMenuLabel = new Gtk.Label({
            label: `\n<span size="large">Popup Menus\n\n</span>`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        menugrid.attach(popupMenuLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add Menu style Enable / Disable switch
        let menuStyleLabel = new Gtk.Label({
            label: `Enable Menu Styles`,
            halign: Gtk.Align.START,
        });
        menugrid.attach(menuStyleLabel, 1, rowbar, 1, 1);

        let menuStyleSwitch = this.createSwitchWidget('menustyle', 'Turn Off to disable Open Bar menu styles below and instead retain your installed theme');
        menugrid.attach(menuStyleSwitch, 2, rowbar, 1, 1);

        rowbar += 1

        let separator0 = this.createSeparatorWidget();
        menugrid.attach(separator0, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Auto FG color switch for Menu
        let autofgMenuLabel = new Gtk.Label({
            label: 'Auto FG Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(autofgMenuLabel, 1, rowbar, 1, 1);

        let autofgMenuSwitch = this.createSwitchWidget('autofg-menu', 'Automatically set white/black FG color as per background color of menu widgets');
        menugrid.attach(autofgMenuSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu FG color chooser
        let menuFGColorLabel = new Gtk.Label({
            label: 'FG Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(menuFGColorLabel, 1, rowbar, 1, 1);

        let menuFGColorChooser = this.createColorWidget(window, 'Menu Foreground Color', 'Foreground color for the dropdown menus', 'mfgcolor');
        menugrid.attach(menuFGColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu FG alpha scale
        let mfgAlphaLbl = new Gtk.Label({
            label: 'FG Alpha',
            halign: Gtk.Align.START,
        });
        menugrid.attach(mfgAlphaLbl, 1, rowbar, 1, 1);

        let mfgAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'mfgalpha');
        menugrid.attach(mfgAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu BG color chooser
        let menuBGColorLabel = new Gtk.Label({
            label: 'BG Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(menuBGColorLabel, 1, rowbar, 1, 1);

        let menuBGColorChooser = this.createColorWidget(window, 'Menu Background Color', 'Background color for the dropdown menus', 'mbgcolor');
        menugrid.attach(menuBGColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu BG alpha scale
        let mbgAlphaLbl = new Gtk.Label({
            label: 'BG Alpha',
            halign: Gtk.Align.START,
        });
        menugrid.attach(mbgAlphaLbl, 1, rowbar, 1, 1);

        let mbgAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'mbgalpha');
        menugrid.attach(mbgAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add an SVG menu BG gradient switch
        let mbgGradientLbl = new Gtk.Label({
            label: `Light Gradient`,
            halign: Gtk.Align.START,
        });
        menugrid.attach(mbgGradientLbl, 1, rowbar, 1, 1);

        let mbgGradientSwitch = this.createSwitchWidget('mbg-gradient', 'Light gradient effect from top-left on menu background');
        menugrid.attach(mbgGradientSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Secondary menu color Override
        // Add an override switch
        let smbgOLbl = new Gtk.Label({
            label: `Override Secondary?`,
            halign: Gtk.Align.START,
        });
        menugrid.attach(smbgOLbl, 1, rowbar, 1, 1);

        let smbgOSwitch = this.createSwitchWidget('smbgoverride', 'Override Secondary Menu BG Color?');
        menugrid.attach(smbgOSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a secondary menu BG color chooser
        let smenuBGColorLabel = new Gtk.Label({
            label: 'Override Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(smenuBGColorLabel, 1, rowbar, 1, 1);

        let smenuBGColorChooser = this.createColorWidget(window, 'Secondary Menu Background Color', 'Secondary background color override for the dropdown menus', 'smbgcolor');
        menugrid.attach(smenuBGColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu Border color chooser
        let menubColorLabel = new Gtk.Label({
            label: 'Border Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(menubColorLabel, 1, rowbar, 1, 1);

        let menubColorChooser = this.createColorWidget(window, 'Menu Border Color', 'Border color for the dropdown menus', 'mbcolor');
        menugrid.attach(menubColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu border alpha scale
        let mbAlphaLbl = new Gtk.Label({
            label: 'Border Alpha',
            halign: Gtk.Align.START,
        });
        menugrid.attach(mbAlphaLbl, 1, rowbar, 1, 1);

        let mbAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'mbalpha');
        menugrid.attach(mbAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Auto FG color switch for Menu
        let autohgMenuLabel = new Gtk.Label({
            label: 'Auto Highlight Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(autohgMenuLabel, 1, rowbar, 1, 1);

        let autohgMenuSwitch = this.createSwitchWidget('autohg-menu', 'Automatically set highlight color as per background color of menu widgets');
        menugrid.attach(autohgMenuSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu highlight color chooser
        let menuhColorLabel = new Gtk.Label({
            label: 'Highlight Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(menuhColorLabel, 1, rowbar, 1, 1);

        let menuhColorChooser = this.createColorWidget(window, 'Menu Highlight Color', 'Highlight color for hover/focus on menu items', 'mhcolor');
        menugrid.attach(menuhColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu highlight alpha scale
        let mhAlphaLbl = new Gtk.Label({
            label: 'Highlight Alpha',
            halign: Gtk.Align.START,
        });
        menugrid.attach(mhAlphaLbl, 1, rowbar, 1, 1);

        let mhAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'mhalpha');
        menugrid.attach(mhAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu selection color chooser
        let menusColorLabel = new Gtk.Label({
            label: 'Accent Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(menusColorLabel, 1, rowbar, 1, 1);

        let menusColorChooser = this.createColorWidget(window, 'Menu Active/Accent Color', 'Selected/Active color for the menu items', 'mscolor');
        menugrid.attach(menusColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu selection alpha scale
        let msAlphaLbl = new Gtk.Label({
            label: 'Accent Alpha',
            halign: Gtk.Align.START,
        });
        menugrid.attach(msAlphaLbl, 1, rowbar, 1, 1);

        let msAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'msalpha');
        menugrid.attach(msAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu shadow color chooser
        let menushColorLabel = new Gtk.Label({
            label: 'Shadow Color',
            halign: Gtk.Align.START,
        });
        menugrid.attach(menushColorLabel, 1, rowbar, 1, 1);

        let menushColorChooser = this.createColorWidget(window, 'Menu Shadow Color', 'Shadow color for the dropdown menus. Choose light color for dark theme and dark for light.', 'mshcolor');
        menugrid.attach(menushColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a menu shadow alpha scale
        let mshAlphaLbl = new Gtk.Label({
            label: 'Shadow Alpha',
            halign: Gtk.Align.START,
        });
        menugrid.attach(mshAlphaLbl, 1, rowbar, 1, 1);

        let mshAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'mshalpha');
        menugrid.attach(mshAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Menu Panels radius scale
        let menuRadLbl = new Gtk.Label({
            label: 'Menu Panels Radius',
            halign: Gtk.Align.START,
        });
        menugrid.attach(menuRadLbl, 1, rowbar, 1, 1);

        let menuRad = this.createScaleWidget(0, 50, 1, 0, 'menu-radius', 'Radius for all the Menu panels');
        menugrid.attach(menuRad, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Calendar/Notifications Buttons radius scale
        let notifRadLbl = new Gtk.Label({
            label: 'Calendar Subs Radius',
            halign: Gtk.Align.START,
        });
        menugrid.attach(notifRadLbl, 1, rowbar, 1, 1);

        let notifRad = this.createScaleWidget(0, 50, 1, 0, 'notif-radius', 'Radius for the sub sections of Calendar/Notifications');
        menugrid.attach(notifRad, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Quick Toggle buttons radius scale
        let qToggleRadLbl = new Gtk.Label({
            label: 'Quick Toggle Radius',
            halign: Gtk.Align.START,
        });
        menugrid.attach(qToggleRadLbl, 1, rowbar, 1, 1);

        let qToggleRad = this.createScaleWidget(0, 50, 1, 0, 'qtoggle-radius', 'Radius for the Quick Toggle buttons');
        menugrid.attach(qToggleRad, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a slider height scale
        let mSliderHtLbl = new Gtk.Label({
            label: 'Slider Height',
            halign: Gtk.Align.START,
        });
        menugrid.attach(mSliderHtLbl, 1, rowbar, 1, 1);

        let mSliderHt = this.createScaleWidget(1, 20, 1, 0, 'slider-height', 'Slider height for Volume/Brightness etc');
        menugrid.attach(mSliderHt, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a slider handle border width scale
        let mSliHandBordLbl = new Gtk.Label({
            label: 'Slider Handle Border',
            halign: Gtk.Align.START,
        });
        menugrid.attach(mSliHandBordLbl, 1, rowbar, 1, 1);

        let mSliHandBord = this.createScaleWidget(0, 20, 1, 0, 'handle-border', 'Width of the border of Slider handle. Note: Not supported in Gnome 47+');
        menugrid.attach(mSliHandBord, 2, rowbar, 1, 1);

        ////////////////////////////////////////////////////////////////////

        // DASH / DOCK

        let dashgrid = this.createGridWidget();

        rowbar = 1;

        // Dash / Dock Label
        let dashLbl = new Gtk.Label({
            label: `<span size="large">Dash / Dock Style\n\n</span>`,
            halign: Gtk.Align.CENTER,
            use_markup: true,
            css_classes: [titleClass],
        });
        dashgrid.attach(dashLbl, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a dash to dock info label
        let dashInfoLabel = new Gtk.Label({
            label: `<span allow_breaks="true">Note for Dash-to-Dock:\n•  Enable 'Use built-in theme' in its settings under 'Appearance' tab.\n•  Set 'Icon size limit' as needed in its 'Position and Size' tab.\n </span>`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            wrap: true,
            margin_bottom: 10,
            width_chars: 55,
        });
        dashgrid.attach(dashInfoLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add dash-dock style combo
        let applyDashLbl = new Gtk.Label({
            label: `Dash / Dock Style`,
            halign: Gtk.Align.START,
        });
        dashgrid.attach(applyDashLbl, 1, rowbar, 1, 1);

        let applyDashCombo = this.createComboboxWidget([ ["Default", _("Keep Default Theme")], ["Menu", _("Use Menu Colors")], ["Bar", _("Use Top Bar Colors")], ["Custom", _("Custom Colors (as below)")] ], 'dashdock-style');
        dashgrid.attach(applyDashCombo, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a dash BG color chooser
        let dashBgColorLabel = new Gtk.Label({
            label: 'BG Color',
            halign: Gtk.Align.START,
        });
        dashgrid.attach(dashBgColorLabel, 1, rowbar, 1, 1);

        let dashBgColorChooser = this.createColorWidget(window, 'Dash/Dock BG Color', 'Custom BG color for the Dash/Dock.', 'dbgcolor');
        dashgrid.attach(dashBgColorChooser, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a dash BG alpha scale
        let dashBgAlphaLbl = new Gtk.Label({
            label: 'BG Alpha',
            halign: Gtk.Align.START,
        });
        dashgrid.attach(dashBgAlphaLbl, 1, rowbar, 1, 1);

        let dashBgAlpha = this.createScaleWidget(0, 1, 0.01, 2, 'dbgalpha');
        dashgrid.attach(dashBgAlpha, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a dash border radius scale
        let dashbRadiusLbl = new Gtk.Label({
            label: 'Border Radius',
            halign: Gtk.Align.START,
        });
        dashgrid.attach(dashbRadiusLbl, 1, rowbar, 1, 1);

        let dashbRadius = this.createScaleWidget(0, 100, 1, 0, 'dbradius');
        dashgrid.attach(dashbRadius, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a dash Icon Size scale
        let dashIconSizeLbl = new Gtk.Label({
            label: 'Icon Size',
            halign: Gtk.Align.START,
        });
        dashgrid.attach(dashIconSizeLbl, 1, rowbar, 1, 1);

        let dashIconSize = this.createScaleWidget(16, 96, 1, 0, 'disize');
        dashgrid.attach(dashIconSize, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a border switch
        let dashBorderLbl = new Gtk.Label({
            label: `Enable Border`,
            halign: Gtk.Align.START,
        });
        dashgrid.attach(dashBorderLbl, 1, rowbar, 1, 1);

        let dashBorderSwitch = this.createSwitchWidget('dborder', 'Show dash border.');
        dashgrid.attach(dashBorderSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a shadow switch
        let dashShadowLbl = new Gtk.Label({
            label: `Enable Shadow`,
            halign: Gtk.Align.START,
        });
        dashgrid.attach(dashShadowLbl, 1, rowbar, 1, 1);

        let dashShadowSwitch = this.createSwitchWidget('dshadow', 'Show dash shadow.');
        dashgrid.attach(dashShadowSwitch, 2, rowbar, 1, 1);

        ////////////////////////////////////////////////////////////////////

        // GNOME SHELL STYLES

        let beyondgrid = this.createGridWidget();

        rowbar = 1;

        // Gnome Shell label
        let shellLabel = new Gtk.Label({
            label: `<span size="large">Gnome Shell Styles</span>\n`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            css_classes: [titleClass],
        });
        beyondgrid.attach(shellLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Gnome Shell info label
        let beyondLabel = new Gtk.Label({
            label: `<span allow_breaks="true">Styles primarily derived from panel menus will be applied to shell components as selected:</span>\n`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            wrap: true,
            width_chars: 55,
        });
        beyondgrid.attach(beyondLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add apply Menu to notifications switch
        let appNotifLbl = new Gtk.Label({
            label: `Apply Menu Styles to Notifications`,
            halign: Gtk.Align.START,
        });
        beyondgrid.attach(appNotifLbl, 1, rowbar, 1, 1);

        let appNotifSwitch = this.createSwitchWidget('apply-menu-notif', 'Apply Menu styles to notifications banners');
        beyondgrid.attach(appNotifSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add apply Menu to Shell pop-ups switch
        let appMenuLbl = new Gtk.Label({
            label: `Apply Menu Styles to all Shell Pop-ups`,
            halign: Gtk.Align.START,
        });
        beyondgrid.attach(appMenuLbl, 1, rowbar, 1, 1);

        let appMenuSwitch = this.createSwitchWidget('apply-menu-shell', 'Apply Menu styles to all Shell pop-up menus');
        beyondgrid.attach(appMenuSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add apply Accent to Shell switch
        let appAccentLbl = new Gtk.Label({
            label: `Apply Accent to Shell allover`,
            halign: Gtk.Align.START,
        });
        beyondgrid.attach(appAccentLbl, 1, rowbar, 1, 1);

        let appAccentSwitch = this.createSwitchWidget('apply-accent-shell', 'Apply only Accent color to Shell components');
        beyondgrid.attach(appAccentSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add apply All styles to Shell switch
        let appAllLbl = new Gtk.Label({
            label: `Apply All Styles to Shell allover`,
            halign: Gtk.Align.START,
        });
        beyondgrid.attach(appAllLbl, 1, rowbar, 1, 1);

        let appAllSwitch = this.createSwitchWidget('apply-all-shell', 'Apply Accent, FG, BG colors to Shell components');
        beyondgrid.attach(appAllSwitch, 2, rowbar, 1, 1);

        ////////////////////////////////////////////////////////////////////

        // GTK / FLATPAK APPS

        let appgrid = this.createGridWidget();

        rowbar = 1;

        // GTK FLATPAK label
        let gtkflatpakLabel = new Gtk.Label({
            label: `<span size="large">GTK / Flatpak Apps   🧪</span>\n`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            tooltip_text: 'App theming is experimental',
            css_classes: [titleClass],
        });
        appgrid.attach(gtkflatpakLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Gtk/Flatpak info label
        let appInfoLabel = new Gtk.Label({
            label: `<span>This applies theme Accent Color and below styles to Gtk / Flatpak apps:\n•  Set desired styles and Turn-On 'Apply to Gtk/Flatpak' below.\n•  Reload the apps (or Gnome) for changes to take effect.\n•  You may need to set 'theme' in apps (e.g. Terminal) to 'System' or 'Default'.</span>\n`,
            use_markup: true,
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 10,
            width_chars: 55,
        });
        appgrid.attach(appInfoLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        let gtkSeparator1 = this.createSeparatorWidget();
        appgrid.attach(gtkSeparator1, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a HSCD info label
        let hscdLabel = new Gtk.Label({
            label: `<span><b>Headerbar | Sidebar | Card | Dialog</b></span>`,
            use_markup: true,
            halign: Gtk.Align.START,
            margin_top: 10,
        });
        appgrid.attach(hscdLabel, 1, rowbar, 2, 1);

        rowbar += 1

        // Add a HSCD color button
        let hscdColorLbl = new Gtk.Label({
            label: `Hint Color`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(hscdColorLbl, 1, rowbar, 1, 1);

        let hscdColorBtn = this.createColorWidget(window, 'Headerbar/Sidebar Hint Color', 'Headerbar/Sidebar/Card/Dialog Hint Color', 'hscd-color');
        appgrid.attach(hscdColorBtn, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a headerbar tint scale
        let hbHintLbl = new Gtk.Label({
            label: `Headerbar Hint`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(hbHintLbl, 1, rowbar, 1, 1);

        let hbHintScale = this.createScaleWidget(0, 100, 1, 0, 'headerbar-hint', 'Adds hint of selected color to Headerbars');
        appgrid.attach(hbHintScale, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Headerbar for Gtk3-Only switch
        let hbarGtk3Lbl = new Gtk.Label({
            label: `Headerbar - Gtk3 Only`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(hbarGtk3Lbl, 1, rowbar, 1, 1);

        let hbarGtk3Switch = this.createSwitchWidget('hbar-gtk3only', 'Apply Headerbar Hint only to Gtk3 apps, since new Gtk4 apps tend to prefer split-view without headerbar');
        appgrid.attach(hbarGtk3Switch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a sidebar tint scale
        let sbHintLbl = new Gtk.Label({
            label: `Sidebar Hint`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(sbHintLbl, 1, rowbar, 1, 1);

        let sbHintScale = this.createScaleWidget(0, 100, 1, 0, 'sidebar-hint', 'Adds hint of selected color to Sidebars');
        appgrid.attach(sbHintScale, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add sidebar gradient style combo
        let sbGradComboLbl = new Gtk.Label({
            label: `Sidebar Gradient`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(sbGradComboLbl, 1, rowbar, 1, 1);

        let sbGradCombo = this.createComboboxWidget([ ["none", _("None")], ["to right", _("To Right")], ["to left", _("To Left")], ["to bottom", _("To Bottom")], ["to bottom right", _("To Bottom Right")], ["to bottom left", _("To Bottom Left")]] ,'sbar-gradient');
        appgrid.attach(sbGradCombo, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Card / Dialog tint scale
        let cdHintLbl = new Gtk.Label({
            label: `Card/Dialog Hint`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(cdHintLbl, 1, rowbar, 1, 1);

        let cdHintScale = this.createScaleWidget(0, 100, 1, 0, 'card-hint', 'Adds hint of selected color to Cards and Dialogs');
        appgrid.attach(cdHintScale, 2, rowbar, 1, 1);

        rowbar += 3;

        let gtkSeparator2 = this.createSeparatorWidget();
        appgrid.attach(gtkSeparator2, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a VW info label
        let vwLabel = new Gtk.Label({
            label: `<span><b>View Pane | Window</b></span>`,
            use_markup: true,
            halign: Gtk.Align.START,
            margin_top: 10,
        });
        appgrid.attach(vwLabel, 1, rowbar, 2, 1);

        rowbar += 1

        // Add a vw color button
        let vwColorLbl = new Gtk.Label({
            label: `Hint Color`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(vwColorLbl, 1, rowbar, 1, 1);

        let vwColorBtn = this.createColorWidget(window, 'View/Window Hint Color', 'View/Window Hint Color', 'vw-color');
        appgrid.attach(vwColorBtn, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a view tint scale
        let viewHintLbl = new Gtk.Label({
            label: `View Pane Hint`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(viewHintLbl, 1, rowbar, 1, 1);

        let viewHintScale = this.createScaleWidget(0, 100, 1, 0, 'view-hint', 'Adds hint of selected color to view pane');
        appgrid.attach(viewHintScale, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a window tint scale
        let windowHintLbl = new Gtk.Label({
            label: `Window Hint`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(windowHintLbl, 1, rowbar, 1, 1);

        let windowHintScale = this.createScaleWidget(0, 100, 1, 0, 'window-hint', 'Adds hint of selected color to window');
        appgrid.attach(windowHintScale, 2, rowbar, 1, 1);

        rowbar += 1;

        let gtkSeparator3 = this.createSeparatorWidget();
        appgrid.attach(gtkSeparator3, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Window Border info label
        let wbLabel = new Gtk.Label({
            label: `<span><b>Window Border</b></span>`,
            use_markup: true,
            halign: Gtk.Align.START,
            margin_top: 10,
        });
        appgrid.attach(wbLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a window border color button
        let winBColorLbl = new Gtk.Label({
            label: `Border Color`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(winBColorLbl, 1, rowbar, 1, 1);

        let winBColorBtn = this.createColorWidget(window, 'Window Border Color', 'Window Border Color', 'winbcolor');
        appgrid.attach(winBColorBtn, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a window border alpha scale
        let winBAlphaLbl = new Gtk.Label({
            label: `Border Alpha`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(winBAlphaLbl, 1, rowbar, 1, 1);

        let winBAlphaScale = this.createScaleWidget(0, 1, 0.01, 2, 'winbalpha', 'Window Border Opacity / Alpha');
        appgrid.attach(winBAlphaScale, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a window border width scale
        let winBWidthLbl = new Gtk.Label({
            label: `Border Width`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(winBWidthLbl, 1, rowbar, 1, 1);

        let winBWidthScale = this.createScaleWidget(0, 10, 0.1, 1, 'winbwidth', 'Window Border Width');
        appgrid.attach(winBWidthScale, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a window corner radius switch
        let winBRadSwitchLbl = new Gtk.Label({
            label: `Apply Corner Radius`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(winBRadSwitchLbl, 1, rowbar, 1, 1);

        let winBRadiusSwitch = this.createSwitchWidget('corner-radius', 'Enable custom Window Corner Radius as selected below');
        appgrid.attach(winBRadiusSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a window corner radius scale
        let winBRadiusLbl = new Gtk.Label({
            label: `Corner Radius`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(winBRadiusLbl, 1, rowbar, 1, 1);

        let winBRadiusScale = this.createScaleWidget(0, 25, 1, 0, 'winbradius', 'Window Corner Radius - may not work well for legacy/non-Gtk apps');
        appgrid.attach(winBRadiusScale, 2, rowbar, 1, 1);

        rowbar += 1;

        let gtkSeparator4 = this.createSeparatorWidget();
        appgrid.attach(gtkSeparator4, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a More info label
        let moreLabel = new Gtk.Label({
            label: `<span><b>And More</b></span>`,
            use_markup: true,
            halign: Gtk.Align.START,
            margin_top: 10,
        });
        appgrid.attach(moreLabel, 1, rowbar, 2, 1);

        rowbar += 1

        // Add a Gtk Popover style switch
        let popoverLbl = new Gtk.Label({
            label: `Popover Styles`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(popoverLbl, 1, rowbar, 1, 1);

        let popoverSwitch = this.createSwitchWidget('gtk-popover', 'Apply Top Panel menu styles to app popovers');
        appgrid.attach(popoverSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add window shadow style combo
        let wShadowComboLbl = new Gtk.Label({
            label: `Window Shadow Style`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(wShadowComboLbl, 1, rowbar, 1, 1);

        let wShadowCombo = this.createComboboxWidget([ ["Default", _("Default")], ["Floating", _("Float - Bottom Right")], ["None", _("None")] ] ,'gtk-shadow');
        appgrid.attach(wShadowCombo, 2, rowbar, 1, 1);

        rowbar += 1

        // Add a traffic light switch
        let trfLightLbl = new Gtk.Label({
            label: `Traffic Light Controls`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(trfLightLbl, 1, rowbar, 1, 1);

        let trfLightSwitch = this.createSwitchWidget('traffic-light', 'Apply Traffic Light Window Control Buttons');
        appgrid.attach(trfLightSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a transparency switch
        let winTransLbl = new Gtk.Label({
            label: `⚠ Transparency / Alpha`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(winTransLbl, 1, rowbar, 1, 1);

        let winTransScale = this.createScaleWidget(0, 1, 0.05, 2, 'gtk-transparency', 'Window Transparency - may not work well for legacy/non-Gtk apps');
        appgrid.attach(winTransScale, 2, rowbar, 1, 1);

        rowbar += 1;

        // Add a Yaru Theme Note label
        let yaruNoteLabel = new Gtk.Label({
            use_markup: true,
            label: `<span allow_breaks="true">\nAuto-Set Gtk/Icons Yaru theme that is closest to Open Bar Accent.\nYaru themes need to be installed (default in Ubuntu).</span>`,
            halign: Gtk.Align.START,
            wrap: true,
        });
        appgrid.attach(yaruNoteLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Yaru theme switch
        let yaruThemeLbl = new Gtk.Label({
            label: `Set Yaru Theme`,
            halign: Gtk.Align.START,
        });
        appgrid.attach(yaruThemeLbl, 1, rowbar, 1, 1);

        let yaruThemeSwitch = this.createSwitchWidget('set-yarutheme', 'Auto-set Yaru theme closest to the accent color');
        appgrid.attach(yaruThemeSwitch, 2, rowbar, 1, 1);

        rowbar += 1;

        let gtkSeparator5 = this.createSeparatorWidget();
        appgrid.attach(gtkSeparator5, 1, rowbar, 2, 1);

        rowbar += 2;

        // Add a Apply Styles info label
        let applyLabel = new Gtk.Label({
            label: `<span><b>Apply App Styles</b></span>`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            margin_top: 10,
        });
        appgrid.attach(applyLabel, 1, rowbar, 2, 1);

        rowbar += 1

        // Add a Gtk info label
        let appLabel = new Gtk.Label({
            label: `<span><b>GTK3 / GTK4</b></span>\n\n<span size="small" allow_breaks="true">⚠ It will write to 'gtk.css' under '$XDG_CONFIG_HOME/gtk-3.0/' and 'gtk-4.0'.\n     For existing gtk.css, Open Bar will create a backup and restore it on disable.\n     You are advised to also take a manual backup as a failsafe.</span>`,
            use_markup: true,
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 30,
        });
        appgrid.attach(appLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add apply Accent to Gtk switch
        let appGtkLbl = new Gtk.Label({
            label: `<b>Apply to Gtk Apps</b>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        appgrid.attach(appGtkLbl, 1, rowbar, 1, 1);

        let appGtkSwitch = this.createSwitchWidget('apply-gtk', 'Apply Accent color to Gtk app components');
        appgrid.attach(appGtkSwitch, 2, rowbar, 1, 1);

        rowbar += 2;

        // Add a Flatpak info label
        let flatLabel = new Gtk.Label({
            label: `<span><b>FLATPAK</b></span>\n\n<span size="small" allow_breaks="true">⚠ Applies overrides to provide flatpak apps access to Gtk configs.\n     Overrides will be removed on disable.\n     Requires 'Apply to Gtk Apps' to be turned On.</span>`,
                    use_markup: true,
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 10,
        });
        appgrid.attach(flatLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add an apply to flatpak switch
        let flatpakLabel = new Gtk.Label({
            label: `<b>Apply to Flatpak Apps</b>`,
            use_markup: true,
            halign: Gtk.Align.START,
        });
        appgrid.attach(flatpakLabel, 1, rowbar, 1, 1);

        let flatpakSwitch = this.createSwitchWidget('apply-flatpak', 'Apply to Flatpak app components');
        appgrid.attach(flatpakSwitch, 2, rowbar, 1, 1);

        ////////////////////////////////////////////////////////////////////

        // IMPORT / EXPORT SETTINGS

        let iegrid = this.createGridWidget();
        iegrid.column_spacing = 100;
        iegrid.halign = Gtk.Align.CENTER;

        rowbar = 1;

        // Import Export Label
        let ieLabel = new Gtk.Label({
            label: `<span size="large">Import / Export Settings</span>\n`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            css_classes: [titleClass],
        });
        iegrid.attach(ieLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add an Import Settings button
        let importLbl = new Gtk.Label({
            label: `Import Open Bar Settings from a file`,
            halign: Gtk.Align.START,
        });
        iegrid.attach(importLbl, 1, rowbar, 1, 1);

        // Add button to Import Settings
        const importLabel = new Gtk.Label({
            use_markup: true,
            label: `<span>${_("Import ⚙")}</span>`,
        });
        const importBtn = new Gtk.Button({
            child: importLabel,
            // margin_top: 35,
            tooltip_text: _("Import theme-settings from a file"),
            halign: Gtk.Align.END,
        });
        importBtn.connect('clicked', () => {
            this.importSettings(window);
        });
        iegrid.attach(importBtn, 2, rowbar, 1, 1);

        rowbar += 2;

        // Add an Export Settings button
        let exportLbl = new Gtk.Label({
            label: `Export Open Bar Settings to a file`,
            halign: Gtk.Align.START,
        });
        iegrid.attach(exportLbl, 1, rowbar, 1, 1);

        // Add button to Export Settings
        const exportLabel = new Gtk.Label({
            use_markup: true,
            label: `<span>${_("Export ⚙")}</span>`,
        });
        const exportBtn = new Gtk.Button({
            child: exportLabel,
            // margin_top: 35,
            tooltip_text: _("Export current theme-settings to a file"),
            halign: Gtk.Align.END,
        });
        exportBtn.connect('clicked', () => {
            this.exportSettings(window);
        });
        iegrid.attach(exportBtn, 2, rowbar, 1, 1);

        rowbar += 1;

        // Reset Settings Label
        let resetTitleLabel = new Gtk.Label({
            label: `\n\n\n<span size="large">Reset Settings</span>\n`,
            use_markup: true,
            halign: Gtk.Align.CENTER,
            css_classes: [titleClass],
        });
        iegrid.attach(resetTitleLabel, 1, rowbar, 2, 1);

        rowbar += 1;

        // Add a Reset Settings button
        let resetLbl = new Gtk.Label({
            label: `⚠ Reset all Open Bar settings to default values`,
            halign: Gtk.Align.START,
        });
        iegrid.attach(resetLbl, 1, rowbar, 1, 1);

        // Add button to Reset Settings
        const resetBtnLabel = new Gtk.Label({
            use_markup: true,
            label: `<span>${_("Reset ⚙")}</span>`,
        });
        const resetBtn = new Gtk.Button({
            child: resetBtnLabel,
            // margin_top: 35,
            tooltip_text: _("It will reset all Open Bar settings to their default values"),
            halign: Gtk.Align.END,
        });
        resetBtn.connect('clicked', () => {
            this.resetSettingsDialog(window);
        });
        iegrid.attach(resetBtn, 2, rowbar, 1, 1);

        /////////////////////////////////////////////////////////////////////

        // PREFERENCES LAYOUT:
        // Preferences Window > Prefs Page > Settings Group > Prefs Box
        // Prefs Box  >  Title Grid
        //               Stack Box  >   Sidebar | ScrollWindow > StackPages
        //               Quote Box

        const scrollWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            css_classes: ['openbar-scroll'],
        });

        let stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.NONE,//ROTATE_LEFT_RIGHT,
            hhomogeneous: true,
            vhomogeneous: false,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER,
            // vexpand: true,
            css_classes: ['openbar-stack'],
        });
        // Add pages to the stack
        stack.add_titled(welcomegrid, 'welcome',  '🙏🏻  Welcome');
        stack.add_titled(palettegrid, 'autotheme',  '✨  Auto Theming');
        stack.add_titled(bargrid, 'barprops',       '⚌  Top Bar Properties');
        stack.add_titled(bargridwmax, 'wmaxbar',    '⊞   Window-Max Bar');
        stack.add_titled(fggrid, 'barfg',           '☉   Bar Foreground');
        stack.add_titled(bggrid, 'barbg',           '●   Bar Background');
        stack.add_titled(hgrid, 'highlights',       '✠   Bar Highlights');
        stack.add_titled(bgrid, 'barborder',        '▣   Bar Border');
        stack.add_titled(menugrid, 'menu',          '☰   Popup Menus');
        stack.add_titled(dashgrid, 'dashdock',      '⏏   Dash / Dock');
        stack.add_titled(beyondgrid, 'shell',       'ଳ   Gnome Shell');
        stack.add_titled(appgrid, 'gtkflatpak',     '⌘   Gtk / Flatpak Apps');
        stack.add_titled(iegrid, 'importexport',    '⧉   Settings Admin');

        scrollWindow.set_child(stack);

        let stackBox = new Gtk.Box({css_classes: ['openbar-stack-box']});
        let sideBar = new Gtk.StackSidebar({
            stack: stack,
            css_classes: ['openbar-sidebar'],
            vexpand: true,
        });
        stackBox.append(sideBar);
        stackBox.append(scrollWindow);

        let prefsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ['openbar-prefs-box'],
        });
        prefsBox.append(titlegrid);
        prefsBox.append(stackBox);
        prefsBox.append(quoteBox);

        settingsGroup.add(prefsBox);

        /////////////////////////////////////////////////////////////////////

        window.connect('unrealize', () => {
            if(this.quoteTimeoutId) {
                clearTimeout(this.quoteTimeoutId);
                this.quoteTimeoutId = null;
            }
        });

    }

    resetSettingsDialog(window){
        let dialog = new Gtk.MessageDialog({
          modal: true,
          text: _("Reset Open Bar settings?"),
          secondary_text: _("This will reset all the Open Bar settings to their default values. If needed, you can save the current settings by exporting them to a file before you reset."),
          transient_for: window,
        });
        // add buttons to dialog as 'Delete' and 'Cancel' with 'Cancel' as default
        dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
        dialog.add_button(_("Reset"), Gtk.ResponseType.YES);
        dialog.set_default_response(Gtk.ResponseType.CANCEL);

        dialog.connect("response", (dialog, responseId) => {
          if (responseId == Gtk.ResponseType.YES) {
            this._settings.set_boolean('import-export', true);
            let keys = this._settings.list_keys();
            let keysToKeep = ['import-export', 'default-font', 'bguri', 'dark-bguri', 'light-bguri'];
            keys.forEach(k => { if(!keysToKeep.includes(k)) this._settings.reset(k); });
            this._settings.set_boolean('import-export', false);
          }
          dialog.destroy();
        });

        dialog.show();
    }

    setQuoteLabel(quoteLabel) {
        if(this.quotePause)
            return;
        this.animateQuote(quoteLabel, this.quoteBlank);
        const timeout = this.quoteBlank? 500 : 10500;
        if(this.quoteTimeoutId)
            clearTimeout(this.quoteTimeoutId);
        this.quoteTimeoutId = setTimeout(() => {
            this.setQuoteLabel(quoteLabel);
        }, timeout);
        this.quoteBlank = !this.quoteBlank;
    }

    animateQuote(quoteLabel, blank) {
        if(blank) {
            quoteLabel.label = '';
            return;
        }
        if(this.quoteIdx >= this.quotes.length - 1)
            this.quoteIdx = 0;
        quoteLabel.label = `<span size="medium" allow_breaks="true">${this.quotes[this.quoteIdx][0]}\n${this.quotes[this.quoteIdx++][1]}</span>`;
    }

    shuffleQuotes() {
        // Shuffle this.quotes array randomly
        for (let i = this.quotes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.quotes[i], this.quotes[j]] = [this.quotes[j], this.quotes[i]];
        }
        this.quoteIdx = 0;
    }

    loadQuotesFromFile() {
        const file = Gio.File.new_for_path(this.openbar.path + '/media/OpenBarQuotes.txt');
        const [ok, contents, etag] = file.load_contents(null);
        const decoder = new TextDecoder('utf-8');
        const quotesString = decoder.decode(contents);
        this.quotes = quotesString.split('\n');
        this.quotes = this.quotes.map((quote) => quote.split(/(?=~)/g));
        this.shuffleQuotes();
        // console.log('QUTES: ' + this.quotes);
    }

    importSettings(window) {
        let fileChooser = new Gtk.FileChooserDialog({
            title: _("Import Settings for Open Bar Theme"),
            action: Gtk.FileChooserAction.OPEN,
            transient_for: window,
        });
        fileChooser.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
        fileChooser.add_button(_("Open"), Gtk.ResponseType.ACCEPT);

        fileChooser.connect('response', (self, response) => {
          if (response == Gtk.ResponseType.ACCEPT) {
            this._settings.set_boolean('import-export', true);
            // Save current BG URIs since the one in imported file maybe invalid
            let bguri = this._settings.get_string('bguri');
            let darkBguri =  this._settings.get_string('dark-bguri');
            let lightBguri = this._settings.get_string('light-bguri');

            // Load settings from file
            let filePath = fileChooser.get_file().get_path();
            if (filePath && GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
                let file = Gio.File.new_for_path(filePath);

                let [success_, pid_, stdin, stdout, stderr] =
                    GLib.spawn_async_with_pipes(
                        null,
                        ['dconf', 'load', SCHEMA_PATH],
                        null,
                        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                        null
                    );

                stdin = new GioUnix.OutputStream({fd: stdin, close_fd: true});
                GLib.close(stdout);
                GLib.close(stderr);

                stdin.splice(file.read(null),
                    Gio.OutputStreamSpliceFlags.CLOSE_SOURCE | Gio.OutputStreamSpliceFlags.CLOSE_TARGET, null);

                setTimeout(() => {
                    // Replace BG URIs with saved URIs
                    this._settings.set_string('bguri', bguri);
                    this._settings.set_string('dark-bguri', darkBguri);
                    this._settings.set_string('light-bguri', lightBguri);

                    // Disable import/export pause to enable style reload
                    this._settings.set_boolean('import-export', false);

                    // Trigger stylesheet reload to apply new settings
                    this.triggerStyleReload();
                }, 3000);

            }
          }
          fileChooser.destroy();
        });

        fileChooser.show();
    }

    exportSettings(window) {
        let fileChooser = new Gtk.FileChooserDialog({
            title: _("Export Settings for Open Bar Theme"),
            action: Gtk.FileChooserAction.SAVE,
            transient_for: window,
        });
        fileChooser.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
        fileChooser.add_button(_("Save"), Gtk.ResponseType.ACCEPT);

        fileChooser.connect('response', (self, response) => {
          if (response == Gtk.ResponseType.ACCEPT) {
            this._settings.set_boolean('import-export', true);
            let filePath = fileChooser.get_file().get_path();
            const file = Gio.file_new_for_path(filePath);
            const raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            const out = Gio.BufferedOutputStream.new_sized(raw, 4096);

            // Settings not updated by user (default) aren't caught by dconf, so force update
            let keys = this._settings.list_keys();
            keys.forEach(k => {
                let value = this._settings.get_value(k);
                this._settings.set_value(k, value);
            });

            out.write_all(GLib.spawn_command_line_sync(`dconf dump ${SCHEMA_PATH}`)[1], null);
            out.close(null);
            setTimeout(() => {this._settings.set_boolean('import-export', false)}, 1000);
          }
          fileChooser.destroy();
        });

        fileChooser.show();
    }

}
