import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { DropDownChoice } from './DropDownChoice.js';
class PreferencesRow {
    constructor(_settings, _row, _key, _setEnabledInner) {
        this._settings = _settings;
        this._row = _row;
        this._key = _key;
        this._setEnabledInner = _setEnabledInner;
    }
    enableIf({ key, predicate, page }) {
        const updateEnabled = () => {
            const value = this._settings.get_value(key);
            this._row.set_sensitive(predicate(value));
        };
        updateEnabled();
        const changed = this._settings.connect(`changed::${key}`, updateEnabled);
        page.connect('unmap', () => this._settings.disconnect(changed));
    }
    addResetButton({ window }) {
        const button = new Gtk.Button({
            iconName: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            hasFrame: false,
            marginStart: 10,
        });
        button.connect('clicked', () => this._settings.reset(this._key));
        const updateButton = () => {
            const buttonEnabled = this._settings.get_user_value(this._key) !== null;
            button.set_sensitive(buttonEnabled);
        };
        updateButton();
        const changed = this._settings.connect(`changed::${this._key}`, updateButton);
        window.connect('unmap', () => this._settings.disconnect(changed));
        this._row.add_suffix(button);
    }
    /**
     * Adds a toggle button to the row that enables / disables the setting.
     *
     * When disabled, the setting is reset to its default value.
     *
     * When enabled, the setting is set to the value of <key>-user. The value <key>-user is updated
     * to the current value as long as the setting is enabled.
     */
    addToggleButton({ window }) {
        const activeKey = this._key + '-active';
        const userKey = this._key + '-user';
        const toggleEdit = (active) => {
            this._settings.set_boolean(activeKey, active);
            updateRow();
            updateValue();
        };
        const updateRow = () => {
            const active = this._settings.get_boolean(activeKey);
            this._setEnabled(active);
        };
        const updateValue = () => {
            const active = this._settings.get_boolean(activeKey);
            if (active) {
                const userValue = this._settings.get_value(userKey);
                this._settings.set_value(this._key, userValue);
            }
            else {
                this._settings.reset(this._key);
            }
        };
        const updateUserValue = () => {
            const active = this._settings.get_boolean(activeKey);
            if (active) {
                const value = this._settings.get_value(this._key);
                this._settings.set_value(userKey, value);
            }
        };
        const changed = this._settings.connect(`changed::${this._key}`, updateUserValue);
        window.connect('unmap', () => this._settings.disconnect(changed));
        updateRow();
        const button = new Gtk.ToggleButton({
            iconName: 'document-edit-symbolic',
            valign: Gtk.Align.CENTER,
            hasFrame: false,
            marginStart: 10,
        });
        button.connect('toggled', (toggle) => toggleEdit(toggle.active));
        this._row.add_suffix(button);
    }
    linkValue({ linkedKey, activeKey = this._key + '-active', window, }) {
        const toggleEdit = (active) => {
            this._settings.set_boolean(activeKey, active);
            updateRow();
            updateLinkedValue();
        };
        const updateRow = () => {
            const active = this._settings.get_boolean(activeKey);
            this._setEnabled(active);
        };
        const updateLinkedValue = () => {
            const active = this._settings.get_boolean(activeKey);
            if (!active) {
                const linkedValue = this._settings.get_user_value(linkedKey);
                if (linkedValue) {
                    this._settings.set_value(this._key, linkedValue);
                }
                else {
                    this._settings.reset(this._key);
                }
            }
        };
        const changed = this._settings.connect(`changed::${linkedKey}`, updateLinkedValue);
        window.connect('unmap', () => this._settings.disconnect(changed));
        updateRow();
        const button = new Gtk.ToggleButton({
            iconName: 'document-edit-symbolic',
            valign: Gtk.Align.CENTER,
            hasFrame: false,
            marginStart: 10,
        });
        button.connect('toggled', (toggle) => toggleEdit(toggle.active));
        this._row.add_suffix(button);
    }
    addSubDialog({ window, title, populatePage, enableIf, iconName = 'applications-system-symbolic', }) {
        function showDialog() {
            const dialog = new Gtk.Dialog({
                title,
                modal: true,
                useHeaderBar: 1,
                transientFor: window,
                widthRequest: 350,
                defaultWidth: 500,
            });
            const page = new Adw.PreferencesPage();
            populatePage(page);
            dialog.set_child(page);
            dialog.show();
        }
        const button = new Gtk.Button({
            iconName,
            valign: Gtk.Align.CENTER,
            hasFrame: false,
        });
        button.connect('clicked', () => showDialog());
        this._row.add_suffix(new Gtk.Separator({
            marginStart: 12,
            marginEnd: 4,
            marginTop: 12,
            marginBottom: 12,
        }));
        this._row.add_suffix(button);
        if (enableIf) {
            const updateEnabled = () => {
                const value = this._settings.get_value(enableIf.key);
                button.set_sensitive(enableIf.predicate(value));
            };
            updateEnabled();
            const changed = this._settings.connect(`changed::${enableIf.key}`, updateEnabled);
            enableIf.page.connect('unmap', () => this._settings.disconnect(changed));
        }
    }
    _setEnabled(value) {
        this._setEnabledInner?.(value);
    }
}
export function addToggle({ group, key, title, subtitle = null, settings, shortcutLabel, }) {
    const row = new Adw.ActionRow({ title, subtitle: subtitle });
    group.add(row);
    if (shortcutLabel) {
        const gtkShortcutLabel = new Gtk.ShortcutLabel({
            accelerator: shortcutLabel,
            valign: Gtk.Align.CENTER,
        });
        row.add_prefix(gtkShortcutLabel);
    }
    const toggle = new Gtk.Switch({
        active: settings.get_boolean(key),
        valign: Gtk.Align.CENTER,
    });
    settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(toggle);
    row.activatableWidget = toggle;
    return new PreferencesRow(settings, row, key, (enabled) => toggle.set_sensitive(enabled));
}
export function addLinkButton({ group, title, subtitle = null, uri, }) {
    const row = new Adw.ActionRow({ title, subtitle: subtitle });
    group.add(row);
    const icon = new Gtk.Image({ iconName: 'adw-external-link-symbolic' });
    row.set_activatable(true);
    row.connect('activated', () => Gtk.show_uri(null, uri, Gdk.CURRENT_TIME));
    row.add_suffix(icon);
}
export function addTextEntry({ group, key, title, subtitle = null, settings, window, shortcutLabel, }) {
    const row = new Adw.ActionRow({ title, subtitle: subtitle });
    group.add(row);
    if (shortcutLabel) {
        const gtkShortcutLabel = new Gtk.ShortcutLabel({
            accelerator: shortcutLabel,
            valign: Gtk.Align.CENTER,
        });
        row.add_prefix(gtkShortcutLabel);
    }
    const entry = new Gtk.Entry({
        text: settings.get_string(key),
        valign: Gtk.Align.CENTER,
    });
    const focusController = new Gtk.EventControllerFocus();
    focusController.connect('leave', () => {
        settings.set_string(key, entry.get_buffer().text);
    });
    entry.add_controller(focusController);
    const changed = settings.connect(`changed::${key}`, () => {
        entry.set_text(settings.get_string(key));
    });
    window.connect('unmap', () => settings.disconnect(changed));
    row.add_suffix(entry);
    row.activatableWidget = entry;
    return new PreferencesRow(settings, row, key, (enabled) => entry.set_sensitive(enabled));
}
export function addCombo({ group, key, title, subtitle = null, options, settings, window, }) {
    const model = Gio.ListStore.new(DropDownChoice);
    for (const id in options) {
        model.append(new DropDownChoice({ id, title: options[id] }));
    }
    const row = new Adw.ComboRow({
        title,
        subtitle: subtitle,
        model,
        expression: Gtk.PropertyExpression.new(DropDownChoice, null, 'title'),
    });
    group.add(row);
    row.connect('notify::selected-item', () => {
        // This may trigger without user interaction, so we only update the value when it differs
        // from the the default value or a user value has been set before.
        const value = row.selectedItem.id;
        if (settings.get_user_value(key) !== null || settings.get_string(key) !== value) {
            settings.set_string(key, value);
        }
    });
    function updateComboRowState() {
        row.selected =
            findItemPositionInModel(model, (item) => item.id === settings.get_string(key)) ?? Gtk.INVALID_LIST_POSITION;
    }
    const changed = settings.connect(`changed::${key}`, () => updateComboRowState());
    window.connect('unmap', () => settings.disconnect(changed));
    updateComboRowState();
    const suffixes = row.get_first_child()?.get_last_child();
    const comboBoxElements = [suffixes?.get_first_child(), suffixes?.get_last_child()];
    return new PreferencesRow(settings, row, key, (enabled) => {
        row.set_activatable(enabled);
        const opacity = enabled ? 1 : 0.5;
        comboBoxElements.forEach((el) => el?.set_opacity(opacity));
    });
}
export function addSpinButton({ group, key, title, subtitle = null, settings, lower, upper, step = 1, }) {
    const row = new Adw.ActionRow({ title, subtitle: subtitle });
    group.add(row);
    const spinner = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            stepIncrement: step ?? 1,
            lower,
            upper,
        }),
        value: settings.get_int(key),
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
    });
    settings.bind(key, spinner, 'value', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(spinner);
    row.activatableWidget = spinner;
    return new PreferencesRow(settings, row, key, (enabled) => {
        spinner.set_sensitive(enabled);
    });
}
export function addColorButton({ group, key, title, subtitle = null, settings, window, }) {
    const row = new Adw.ActionRow({ title, subtitle: subtitle });
    group.add(row);
    const colorButton = new Gtk.ColorButton({
        valign: Gtk.Align.CENTER,
        useAlpha: true,
    });
    const updateColorButton = () => {
        const color = new Gdk.RGBA();
        color.parse(settings.get_string(key));
        colorButton.set_rgba(color);
    };
    updateColorButton();
    colorButton.connect('color-set', () => {
        const color = colorButton.rgba.to_string();
        settings.set_string(key, color);
    });
    const changed = settings.connect(`changed::${key}`, updateColorButton);
    window.connect('unmap', () => settings.disconnect(changed));
    row.add_suffix(colorButton);
    row.activatableWidget = colorButton;
    return new PreferencesRow(settings, row, key, (enabled) => colorButton.set_sensitive(enabled));
}
export function addKeyboardShortcut({ window, group, key, title, subtitle = null, settings, }) {
    const row = new Adw.ActionRow({
        title,
        subtitle: subtitle,
        activatable: true,
    });
    group.add(row);
    const shortcutLabel = new Gtk.ShortcutLabel({
        accelerator: settings.get_strv(key)[0] ?? null,
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(shortcutLabel);
    const disabledLabel = new Gtk.Label({
        label: 'Disabled',
        cssClasses: ['dim-label'],
    });
    row.add_suffix(disabledLabel);
    if (settings.get_strv(key).length > 0) {
        disabledLabel.hide();
    }
    else {
        shortcutLabel.hide();
    }
    function showDialog() {
        const dialog = new Gtk.Dialog({
            title: 'Set Shortcut',
            modal: true,
            useHeaderBar: 1,
            transientFor: window,
            widthRequest: 400,
            heightRequest: 200,
        });
        const dialogBox = new Gtk.Box({
            marginBottom: 12,
            marginEnd: 12,
            marginStart: 12,
            marginTop: 12,
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
        });
        const dialogLabel = new Gtk.Label({
            label: 'Enter new shortcut to change <b>' + title + '</b>.',
            useMarkup: true,
            marginBottom: 12,
        });
        dialogBox.append(dialogLabel);
        const dialogDimLabel = new Gtk.Label({
            label: 'Press Esc to cancel or Backspace to disable the keyboard shortcut.',
            cssClasses: ['dim-label'],
        });
        dialogBox.append(dialogDimLabel);
        const keyController = new Gtk.EventControllerKey({
            propagationPhase: Gtk.PropagationPhase.CAPTURE,
        });
        dialog.add_controller(keyController);
        keyController.connect('key-pressed', (keyController, keyval, keycode, modifier) => {
            modifier = fixModifiers(modifier);
            const accelerator = getAccelerator(keyval, modifier);
            if (accelerator) {
                if (keyval === Gdk.KEY_Escape && !modifier) {
                    // Just close the dialog
                }
                else if (keyval === Gdk.KEY_BackSpace && !modifier) {
                    shortcutLabel.hide();
                    disabledLabel.show();
                    settings.set_strv(key, []);
                }
                else {
                    shortcutLabel.accelerator = accelerator;
                    shortcutLabel.show();
                    disabledLabel.hide();
                    settings.set_strv(key, [accelerator]);
                }
                dialog.close();
            }
        });
        dialog.set_child(dialogBox);
        dialog.show();
    }
    row.connect('activated', () => showDialog());
}
function getAccelerator(keyval, modifiers) {
    const isValid = Gtk.accelerator_valid(keyval, modifiers);
    if (isValid) {
        const acceleratorName = Gtk.accelerator_name(keyval, modifiers);
        return acceleratorName;
    }
    else {
        return null;
    }
}
// From https://gitlab.com/rmnvgr/nightthemeswitcher-gnome-shell-extension/-/blob/main/src/utils.js
function findItemPositionInModel(model, predicate) {
    for (let i = 0; i < model.get_n_items(); i++) {
        if (predicate(model.get_item(i))) {
            return i;
        }
    }
    return undefined;
}
/**
 * Removes invalid modifier bits.
 */
function fixModifiers(modifiers) {
    return (modifiers &
        // Set by Xorg when holding the Super key in addition to the valid Meta modifier.
        ~64 &
        // Set when num lock is enabled.
        ~16);
}
