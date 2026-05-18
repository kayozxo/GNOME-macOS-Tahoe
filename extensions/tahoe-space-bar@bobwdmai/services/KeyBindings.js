import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Settings } from './Settings.js';
import { Workspaces } from './Workspaces.js';
export class KeyBindings {
    constructor() {
        this._settings = Settings.getInstance();
        this._ws = Workspaces.getInstance();
        this._desktopKeybindings = new Gio.Settings({
            schema: 'org.gnome.desktop.wm.keybindings',
        });
        this._addedKeyBindings = [];
    }
    static init() {
        KeyBindings._instance = new KeyBindings();
        KeyBindings._instance.init();
    }
    static destroy() {
        KeyBindings._instance?.destroy();
        KeyBindings._instance = null;
    }
    static getInstance() {
        return KeyBindings._instance;
    }
    init() {
        this._registerActivateByNumber();
        this._registerMoveToByNumber();
        this._addExtensionKeyBindings();
        KeyBindings._instance = this;
    }
    destroy() {
        for (const name of this._addedKeyBindings) {
            Main.wm.removeKeybinding(name);
        }
        this._addedKeyBindings = [];
    }
    addKeyBinding(name, handler) {
        Shell.ActionMode;
        Main.wm.addKeybinding(name, this._settings.shortcutsSettings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, handler);
        this._addedKeyBindings.push(name);
    }
    removeKeybinding(name) {
        if (this._addedKeyBindings.includes(name)) {
            Main.wm.removeKeybinding(name);
            this._addedKeyBindings.splice(this._addedKeyBindings.indexOf(name), 1);
        }
    }
    _addExtensionKeyBindings() {
        this.addKeyBinding('move-workspace-left', () => this._ws.moveCurrentWorkspace(-1));
        this.addKeyBinding('move-workspace-right', () => this._ws.moveCurrentWorkspace(1));
        this.addKeyBinding('activate-previous-key', () => this._ws.activatePrevious());
        this.addKeyBinding('activate-empty-key', () => this._ws.activateEmptyOrAdd());
    }
    _registerActivateByNumber() {
        this._settings.enableActivateWorkspaceShortcuts.subscribe((value) => {
            for (let i = 0; i < 10; i++) {
                const name = `activate-${i + 1}-key`;
                if (value) {
                    this.addKeyBinding(name, () => {
                        this._ws.switchTo(i, 'keyboard-shortcut');
                    });
                }
                else {
                    this.removeKeybinding(name);
                }
            }
        }, { emitCurrentValue: true });
    }
    _registerMoveToByNumber() {
        this._settings.enableMoveToWorkspaceShortcuts.subscribe((value) => {
            for (let i = 0; i < 10; i++) {
                const name = `move-to-workspace-${i + 1}`;
                if (value) {
                    this._desktopKeybindings.set_strv(name, [`<Super><Shift>${(i + 1) % 10}`]);
                }
                else {
                    this._desktopKeybindings.reset(name);
                }
            }
        });
    }
}
