import Adw from 'gi://Adw';
import { addKeyboardShortcut, addToggle } from './common.js';
export class ShortcutsPage {
    constructor(extensionPreferences) {
        this.page = new Adw.PreferencesPage();
        this._settings = extensionPreferences.getSettings(`org.gnome.shell.extensions.space-bar.shortcuts`);
    }
    init() {
        this.page.set_title('_Shortcuts');
        this.page.useUnderline = true;
        this.page.set_icon_name('preferences-desktop-keyboard-shortcuts-symbolic');
        this._initGroup();
    }
    _initGroup() {
        const group = new Adw.PreferencesGroup();
        group.set_description('Shortcuts might not work if they are already bound elsewhere.');
        this.page.add(group);
        addToggle({
            settings: this._settings,
            group,
            key: 'enable-activate-workspace-shortcuts',
            title: 'Switch to workspace',
            shortcutLabel: '<Super>1...0',
        }).addSubDialog({
            window: this.window,
            title: 'Switch To Workspace',
            populatePage: (page) => {
                const group = new Adw.PreferencesGroup();
                page.add(group);
                group.set_title('Back and forth');
                group.set_description('Switch to the previous workspace by activating the shortcut for the current workspace again.\n\n' +
                    'Switch off "Toggle overview" in behavior settings to also enable this behavior when clicking the workspace using the mouse.');
                addToggle({
                    settings: this._settings,
                    group,
                    key: 'back-and-forth',
                    title: 'Back and forth',
                });
            },
        });
        addToggle({
            settings: this._settings,
            group,
            key: 'enable-move-to-workspace-shortcuts',
            title: 'Move to workspace',
            shortcutLabel: '<Super><Shift>1...0',
            subtitle: 'With the current window',
        });
        addKeyboardShortcut({
            settings: this._settings,
            window: this.window,
            group,
            key: 'move-workspace-left',
            title: 'Move current workspace left',
        });
        addKeyboardShortcut({
            settings: this._settings,
            window: this.window,
            group,
            key: 'move-workspace-right',
            title: 'Move current workspace right',
        });
        addKeyboardShortcut({
            settings: this._settings,
            window: this.window,
            group,
            key: 'activate-previous-key',
            title: 'Switch to previous workspace',
        });
        addKeyboardShortcut({
            settings: this._settings,
            window: this.window,
            group,
            key: 'activate-empty-key',
            title: 'Switch to empty workspace',
            subtitle: 'Adds new workspace if needed',
        });
        addKeyboardShortcut({
            settings: this._settings,
            window: this.window,
            group,
            key: 'open-menu',
            title: 'Open menu',
        });
    }
}
